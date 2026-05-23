---
title: "RAUC: Robust Auto-Update Controller Security Analysis"
date: 2021-01-01
description: "Security analysis of RAUC — the robust auto-update mechanism used in embedded Linux systems — focusing on update chain integrity and attack surface"
tags: ["embedded", "RAUC", "firmware-update", "Linux", "IoT", "security-analysis"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Overview

RAUC (Robust Auto-Update Controller) is a widely used firmware update framework for embedded Linux systems. It provides an A/B partition switching mechanism, cryptographic bundle signing, and bootloader integration. This post documents the process of integrating RAUC into a Petalinux build targeting the Xilinx Zynq ZC7000 board and the security-relevant configuration surface exposed by that integration.

---

## Adding the RAUC Layer

1. Navigate to the Petalinux project directory.
2. Clone the RAUC meta layer pinned to the `dunfell` release:

```bash
git clone -b dunfell https://github.com/rauc/meta-rauc.git
```

3. Register the layer in `bblayers.conf`:

```bash
petalinux-config
```

Under **Yocto Settings → User Layers**, add the path to `meta-rauc`.

---

## RAUC Configuration

### local.conf

```
IMAGE_INSTALL_append = " rauc"
EXTRA_IMAGE_FEATURES += "package-management"
```

### system.conf

Create `project-spec/meta-user/recipes-core/rauc/files/system.conf`:

```ini
[system]
compatible=Zynq-ZC7000-RAUC
bootloader=uboot

[keyring]
path=/etc/rauc/ca.cert.pem

[slot.rootfs.0]
device=/dev/mmcblk0p2
type=ext4
bootname=A

[slot.rootfs.1]
device=/dev/mmcblk0p3
type=ext4
bootname=B
```

The `compatible` string is compared against the bundle's manifest at install time. A mismatch causes RAUC to reject the bundle outright — this is a first line of defense against cross-device bundle replay.

The `[keyring]` section points to the CA certificate used to verify bundle signatures. The security of the entire update chain depends on this file being integrity-protected in the root filesystem.

### bbappend Recipe

Create `project-spec/meta-user/recipes-core/rauc/rauc_%.bbappend`:

```
FILESEXTRAPATHS_prepend := "${THISDIR}/files:"
SRC_URI += "file://system.conf"

do_install_append() {
    install -m 0644 ${WORKDIR}/system.conf ${D}${sysconfdir}/rauc/system.conf
}
```

---

## U-Boot Integration

Modify `project-spec/meta-user/recipes-bsp/u-boot/files/platform-top.h`:

```c
#define CONFIG_BOOTCOMMAND
    "setenv bootargs console=ttyPS0,115200 root=/dev/mmcblk0p2 rw rootwait;"
    "fatload mmc 0 ${kernel_addr_r} uImage;"
    "fatload mmc 0 ${fdt_addr_r} devicetree.dtb;"
    "bootm ${kernel_addr_r} - ${fdt_addr_r}"
```

The `bootname=A` and `bootname=B` slot names in `system.conf` must correspond to environment variable names that U-Boot uses to track the active partition. RAUC writes to these variables via DBus on a successful update.

---

## Build and Troubleshooting

### Building

```bash
petalinux-build
```

### Common Issues

**Issue: RAUC dependency errors**

Add missing packages to `local.conf`:

```
IMAGE_INSTALL_append = " openssl libgcc"
```

**Issue: U-Boot environment variables not applied**

Edit the U-Boot source directly and rebuild:

```bash
petalinux-config -c u-boot
```

**Issue: RAUC slot recognition failure**

Add partition information to the device tree file so the kernel exposes the correct block devices to RAUC.

---

## Bundle Generation and Installation

### Creating a signed bundle

```bash
rauc bundle \
    --cert=/path/to/cert.pem \
    --key=/path/to/key.pem \
    update-bundle.raucb \
    rootfs.img
```

The bundle is a SquashFS archive containing the rootfs image and a signed manifest. The manifest records the `compatible` string and per-slot checksums.

### Installing on target

```bash
rauc install update-bundle.raucb
```

RAUC verifies the bundle signature against the on-device keyring, checks the `compatible` string, validates slot checksums, writes the image to the inactive partition, and updates the bootloader environment to switch to the new slot on the next boot.

---

## Security Surface

| Component | Attack Surface |
|---|---|
| CA certificate (`ca.cert.pem`) | If writable or replaceable, bundle signature verification is defeated |
| `system.conf` | If the `compatible` string can be manipulated, a bundle for a different device can be accepted |
| U-Boot environment | If writable from userspace, an attacker can redirect the bootloader to the wrong slot or inject arbitrary boot arguments |
| Bundle transport | Bundles delivered over unencrypted channels can be replaced in transit (signature verification still applies, but a DoS is possible by corrupting the bundle) |
| DBus interface | RAUC exposes a DBus service; access control to this socket determines whether unprivileged processes can trigger installs |

The most critical invariant is the integrity of the keyring and `system.conf`. Both reside in the active root filesystem. If the running system is compromised, a persistent attacker can replace the CA certificate with their own and subsequently sign malicious bundles that pass verification.

RAUC does not provide its own mechanism to protect the running system. That trust boundary must be enforced by the platform — for example, via a read-only root filesystem partition, measured boot with TPM attestation, or secure boot with verified kernel and initramfs.
