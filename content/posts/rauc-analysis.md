---
title: 'RAUC: An Analysis of the Embedded Linux Firmware Update Framework'
date: 2021-01-01T00:00:00.000Z
excerpt: A security analysis of RAUC, a robust auto-update mechanism used in embedded Linux systems, focusing on update-chain integrity and attack surface.
tags:
  - embedded
  - rauc
  - firmware-update
  - linux
  - iot
  - security-analysis
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

RAUC (Robust Auto-Update Controller) is a widely used firmware update framework for embedded Linux systems. It provides an A/B partition switching mechanism, encrypted bundle signing, and bootloader integration. This post documents the process of integrating RAUC into a Petalinux build targeting a Xilinx Zynq ZC7000 board, and the security-relevant configuration surface exposed by that integration.

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

Under **Yocto Settings -> User Layers**, add the `meta-rauc` path.

---

## Configuring RAUC

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

The `compatible` string is compared against the bundle's manifest at install time. On a mismatch, RAUC rejects the bundle outright. This is the first line of defense against cross-device bundle replay.

The `[keyring]` section points to the CA certificate used to verify bundle signatures. **The security of the entire update chain depends on the integrity of this file being protected.**

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

The `bootname=A` and `bootname=B` slot names in `system.conf` must match the environment variable names U-Boot uses to track the active partition. RAUC writes these variables via DBus on a successful update.

---

## Build and Troubleshooting

### Build

```bash
petalinux-build
```

### Common Issues

**Issue: RAUC dependency errors**

Add the missing packages to `local.conf`:

```
IMAGE_INSTALL_append = " openssl libgcc"
```

**Issue: U-Boot environment variables not applied**

Modify the U-Boot source directly and rebuild:

```bash
petalinux-config -c u-boot
```

**Issue: RAUC fails to recognize slots**

Add partition information to the device tree so the kernel exposes the correct block devices to RAUC.

---

## Bundle Creation and Installation

### Creating a Signed Bundle

```bash
rauc bundle \
    --cert=/path/to/cert.pem \
    --key=/path/to/key.pem \
    update-bundle.raucb \
    rootfs.img
```

A bundle is a SquashFS archive containing the rootfs image and a signed manifest. The manifest records the `compatible` string and per-slot checksums.

### Installing on the Target

```bash
rauc install update-bundle.raucb
```

RAUC verifies the bundle signature against the on-device keyring, checks the `compatible` string, validates the slot checksums, writes the image to the inactive partition, and updates the bootloader environment to switch to the new slot on the next boot.

---

## Attack Surface Analysis

| Component | Attack Surface |
|---|---|
| CA certificate (`ca.cert.pem`) | If writable or replaceable, bundle signature verification is defeated |
| `system.conf` | If the `compatible` string can be tampered with, a bundle intended for a different device can be accepted |
| U-Boot environment | If writable from userspace, an attacker can redirect the bootloader to the wrong slot or inject arbitrary boot arguments |
| Bundle transport | A bundle delivered over an unencrypted channel can be replaced in transit (signature verification still applies, but DoS via bundle corruption is possible) |
| DBus interface | RAUC exposes a DBus service; access control on this socket determines whether an unprivileged process can trigger an installation |

The most critical invariant is **the integrity of the keyring and `system.conf`**. Both files reside on the active root filesystem. If the running system is compromised, a persistent attacker could replace the CA certificate with their own and subsequently sign malicious bundles that pass verification.

RAUC does not provide its own mechanism to protect the running system. That trust boundary must be enforced by the platform -- for example, through a read-only root filesystem partition, measured boot via TPM attestation, or secure boot with a verified kernel and initramfs.

---

## Security Considerations Summary

The following should be considered when integrating RAUC into an embedded system:

**Key Management**
- Manage the CA private key in an HSM (Hardware Security Module) or an offline environment
- Clearly separate the key used for bundle signing from the CA certificate stored on the device
- Establish a response procedure in advance for key compromise (certificate revocation, new CA distribution)

**Filesystem Protection**
- Consider mounting the root filesystem containing `/etc/rauc/ca.cert.pem` as read-only
- Ensure filesystem integrity via dm-verity or IMA (Integrity Measurement Architecture)

**Bootloader Security**
- Restrict userspace write access to the U-Boot environment variable partition
- Enable secure boot to prevent execution of unsigned images

**DBus Access Control**
- Restrict access to the RAUC DBus interface via polkit or a similar mechanism
- Ensure unprivileged users cannot trigger updates

**Update Channel Security**
- Apply TLS to the bundle transport channel to prevent bundle replacement in transit (DoS)
- Verify the server certificate before downloading a bundle
</content>
