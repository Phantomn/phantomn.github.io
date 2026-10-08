---
title: 'IoT Firmware Dynamic Analysis: Emulating Embedded Linux Firmware with FIRMADYNE'
date: 2021-01-01T00:00:00.000Z
excerpt: >-
  A research summary covering automated dynamic analysis techniques for Linux-based embedded
  firmware. Explains FIRMADYNE's emulation strategy, peripheral modeling, and vulnerability
  discovery methodology.
tags:
  - iot
  - firmware
  - fuzzing
  - dynamic-analysis
  - embedded
  - router
  - research
  - qemu
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

Analyzing embedded firmware at scale is one of the harder problems in security research. Unlike desktop software, IoT firmware runs on heterogeneous hardware, depends on proprietary peripherals, and is built without debugging in mind. Running a router's web interface on a regular PC without the actual NVRAM chip, the specific SoC, or the manufacturer's custom kernel requires a non-trivial emulation stack.

This post summarizes the paper *"Towards Automated Dynamic Analysis for Linux-based Embedded Firmware,"* presented at NDSS 2016. The paper introduces **FIRMADYNE**, a system for automatically emulating and analyzing Linux-based embedded firmware, targeting 23,035 firmware images from 42 manufacturers. FIRMADYNE discovered 14 previously unknown vulnerabilities and confirmed 74 previously known vulnerabilities across 887 reachable firmware images.

---

## Problem Statement: Why IoT Firmware Analysis Is Hard

The core challenge is **hardware dependency.** Embedded firmware is compiled for a specific SoC, expects specific peripherals (NVRAM, MTD partitions, watchdog timers), and boots on top of a kernel modified by the manufacturer. Running a firmware binary as-is on a generic QEMU instance fails for the following reasons:

1. The original kernel targets specific hardware, causing crashes on a generic platform.
2. When userspace processes call NVRAM functions (`nvram_get`, `nvram_set`), they receive NULL, causing crashes during boot.
3. Manufacturer-specific device nodes (`/dev/mtdX`, `/dev/mem` mappings) don't exist.
4. Real hardware's network interface names (`ra0`, `ath0`) differ from the emulation platform's names (`eth0`).

A comparison of common approaches to IoT firmware analysis:

| Approach | Example | Limitation |
|---|---|---|
| Static analysis | Binary diffing, taint propagation | Cannot detect runtime logic flaws |
| Symbolic execution | Firmalice (angr-based) | Requires manual security policies, doesn't scale |
| Emulator-based fuzzing | Avatar, FIRMADYNE | Peripheral emulation gaps cause boot failures |
| Comprehensive testing | Static taint + dynamic fuzzing | Cannot fully simulate hardware-dependent images |

FIRMADYNE opts for full-system emulation, and attempts to solve the peripheral gap problem through a combination of an instrumented kernel and a userspace shim library.

---

## Architecture Overview

FIRMADYNE is a pipeline consisting of four stages: **crawling, extraction, emulation, and dynamic analysis.**

### 1. Firmware Crawling

A Scrapy-based crawler downloads firmware from the support pages of 42 manufacturers. Manufacturers with dynamic websites (D-Link, ZyXEL) were crawled via FTP mirrors instead. For each image, structured metadata was collected, including product name, version, release date, changelog, and links to MIB files. A total of 23,035 images were collected, including routers, NAS devices, IP cameras, cable modems, smart TVs, and access points.

### 2. Filesystem Extraction

FIRMADYNE uses a custom extraction utility built on the `binwalk` API, but doesn't use binwalk's default recursive extraction (Matryoshka) approach. Instead, it terminates extraction as soon as it finds the root filesystem, to avoid wasting resources.

Improvements over plain binwalk:
- Priority-based signature matching: matches firmware headers before generic GZIP data, reducing false-positive extraction attempts.
- Uses third-party tools `jefferson` (JFFS2) and `sasquatch` (SquashFS) instead of the standard `jffsdump`/`unsquashfs`. Manufacturer-modified filesystems frequently fail to process with standard tools.
- Blacklists non-firmware inputs such as PE32, ELF, Universal Binary, PDF, and Office documents.

The root filesystem is validated by checking for the presence of at least 4 standard FHS directories.

### 3. Emulation

This is the technically most interesting part of the paper.

**Kernel replacement.** Instead of booting the original manufacturer kernel (compiled for specific hardware and prone to immediate crashes), FIRMADYNE builds custom kernels for the ARM little-endian, MIPS little-endian, and MIPS big-endian architectures. These three architectures account for 90.8% of the dataset. The custom kernel includes a kernel module that hooks 20 system calls using kprobes, enabling monitoring of network interface allocation, bridge creation, MAC address changes, and program execution.

**NVRAM emulation.** At least 52.6% of firmware images use `libnvram.so` to access hardware NVRAM. NVRAM is a key-value store holding network configuration, credentials, device configuration, and more. Without it, calls to `nvram_get()` return NULL, crashing the boot process.

FIRMADYNE intercepts NVRAM calls via `LD_PRELOAD`, injecting a custom userspace library before init starts. This way, every child process inherits it. The library uses `-nostdlib` compilation and ELF lazy binding mechanisms to ensure compatibility across the dataset's varied toolchains.

**Network inference (the "learning" phase).** Before the actual analysis run, each firmware image boots for 60 seconds in "learning" mode. The instrumented kernel records which IP addresses get assigned to which network interfaces, and whether 802.1d bridges or 802.1Q VLANs are configured. This allows the host side to set up a TAP interface with the correct IP and VLAN configuration to actually communicate with the emulated firmware.

**Platform-specific quirks.** MIPS targets use the Malta development platform (kernel 2.6.32.68). ARM uses the Versatile Express platform with a Cortex-A9 (ARMv7-A), since the standard ARM926 doesn't support newer ARM instructions found in some firmware. Known limitation: the ARM platform supports only a single emulated Ethernet device (no PCI bus), so some multi-interface firmware doesn't work.

For 138 firmware images using the `alphafs` web server, 16 bytes were patched in the QEMU source to return known VendorID/ProductID values.

### 4. Dynamic Analysis

For each successfully emulated image, three automated analyses run:

**Web page accessibility.** A Python harness searches the firmware filesystem for files under `/www/`, filters out static resources (`.png`, `.css`, `.js`), and then attempts direct HTTP access to each URL. Non-2xx response codes are excluded. Results are aggregated to rank URLs by accessibility.

**SNMP enumeration.** Runs `snmpwalk` with the "Public" and "Private" community strings, dumping all SNMP data accessible without authentication. OIDs are resolved using MIB files collected during crawling. This reveals sensitive information such as network configuration, credentials, and device identifiers.

**Known and novel vulnerability detection.** 60 known exploits (mostly from Metasploit) are run sequentially against each image. For novel vulnerabilities, the team manually developed PoC exploits using poison values such as `0xDEADBEEF` and `0x41414141`, then checked whether those values appeared in unexpected locations in the instrumented kernel log (a segfault at the poison address, or a poison value passed to a system call).

---

## Key Results

Of the 23,035 images collected:

- **96.6%** (8,591) entered the initial emulation stage.
- **32.3%** (2,797) successfully inferred network configuration.
- **70.8%** (1,971) were reachable via ping.
- **45%** (887) of reachable images were vulnerable to at least one exploit.

The sharp drop from 8,591 to 2,797 at the network inference stage is mainly attributable to NVRAM emulation issues: missing default values, incompatible NVRAM semantics, or firmware that writes directly to MTD partitions, bypassing `libnvram.so`.

Vulnerability analysis results:
- **14 previously unknown vulnerabilities** (affecting 69 firmware images)
- **74 known vulnerabilities** (confirmed across 887 images)

Network services across reachable images:
- 47.3% expose a web-based configuration interface (HTTP or HTTPS)
- Of those, only 9.5% use HTTPS (19.8% of HTTP-capable devices)
- 27.2% were determined to be routers (detected via a DNS proxy service)
- 16.4% have UPnP enabled by default, allowing LAN devices to automatically configure WAN port forwarding

---

## Comparison with Related Approaches

**Firmalice** (angr-based symbolic execution) targets authentication bypass: hardcoded credentials, hidden authentication interfaces, unprotected access points. It operates at the binary level without instrumentation, but requires manually specifying a security policy per device and doesn't scale to thousands of images.

**Avatar** uses a physical device as a co-processor: firmware code runs in an emulator, but I/O operations are forwarded to real hardware. It achieves high accuracy but requires physical access to each device type.

**FIRMADYNE** chooses scale over accuracy. It can automatically run 23,000 images, but at the cost of approximated NVRAM defaults, unloaded out-of-tree kernel modules, and boot failures for some images.

---

## Analysis Notes

**The 32% network inference success rate is a real bottleneck.** FIRMADYNE boots most firmware, but only a third succeeds at network configuration. The paper traces this mainly to NVRAM failures. The insight that NVRAM defaults are stored in filesystem text files or exported symbols in shared libraries is clever but inherently fragile.

**The custom kernel is both a strength and a limitation.** Instrumenting the kernel with kprobes provides system-level observability without modifying userspace binaries. But it also means FIRMADYNE can't detect vulnerabilities in the manufacturer's original kernel or out-of-tree kernel modules.

**A 45% vulnerability rate among reachable images is striking.** Nearly half of the firmware images reachable over the network had at least one exploitable vulnerability. That's a stark statistic about the state of embedded firmware security at the time.

**The PoC verification approach is underappreciated.** Using poison values like `0xDEADBEEF` and checking for them in the instrumented kernel log is a clean, general-purpose mechanism for confirming exploit success without needing to know in advance what "success" looks like for each vulnerability.

**What FIRMADYNE doesn't cover:** FIRMADYNE is explicitly a full-system analysis tool that runs fixed exploit scripts rather than performing coverage-guided fuzzing. Follow-up tools (FIRM-AFL, FIRM-COV, FirmAE) add greybox fuzzing on top of this emulation foundation.

---

## FIRMADYNE Hands-On Guide

### Installation (Ubuntu 18.04 LTS)

```bash
sudo apt update && sudo apt upgrade
sudo apt-get install busybox-static fakeroot git dmsetup kpartx netcat-openbsd nmap \
  python3-psycopg2 snmp uml-utilities util-linux vlan python3-pip python3-magic

sudo update-alternatives --install /usr/bin/python python /usr/bin/python3 10

git clone --recursive https://github.com/firmadyne/firmadyne.git

git clone https://github.com/ReFirmLabs/binwalk.git
cd binwalk
sudo ./deps.sh
sudo python ./setup.py install
cd ..

sudo apt-get install postgresql
sudo -u postgres createuser -P firmadyne   # password: firmadyne
sudo -u postgres createdb -O firmadyne firmware
sudo -u postgres psql -d firmware < ./firmadyne/database/schema

cd firmadyne
./download.sh

sudo apt-get install qemu-system-arm qemu-system-mips qemu-system-x86 qemu-utils
```

In the `firmadyne.config` file, uncomment `FIRMWARE_DIR` and set it to the firmadyne folder path.

### Running the Emulation

Download the firmware to analyze:

```bash
wget http://www.downloads.netgear.com/files/GDC/WNAP320/WNAP320%20Firmware%20Version%202.0.3.zip
```

Extract the firmware components:

```bash
sudo ./sources/extractor/extractor.py -b Netgear -sql 127.0.0.1 -np -nk \
  "WNAP320 Firmware Version 2.0.3.zip" images
```

Note the ID generated during extraction (e.g., 1). This ID is used in subsequent steps:

```bash
./scripts/getArch.sh ./images/1.tar.gz
./scripts/tar2db.py -i 1 -f ./images/1.tar.gz
sudo ./scripts/makeImage.sh 1
./scripts/inferNetwork.sh 1
```

The interface IP is displayed (e.g., 192.168.0.100). Start the emulation:

```bash
./scratch/1/run.sh
```

Log into the console with the `admin/password` credentials. The same credentials give access to the web UI at `192.168.0.100`.

Mount the filesystem:

```bash
sudo ./scripts/mount.sh 1
```

### Running the Analyses

**SNMP analysis:**
```bash
./analyses/snmpwalk.sh 192.168.0.100
less snmp.public.txt
less snmp.private.txt
```

**Web accessibility:**
```bash
./analyses/webAccess.py 1 192.168.0.100 log.txt
less log.txt
```

**Port scan:**
```bash
sudo nmap -O -sV 192.168.0.100
```

**Running exploits:**
```bash
sudo apt install curl
curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > msfinstall
chmod 755 msfinstall && ./msfinstall

msfconsole   # exit after initial setup completes

mkdir exploits
python ./analyses/runExploits.py -t 192.168.0.100 -o exploits/exploit -e x
less exploits/exploit.metasploit.log
```

---

## Related Work

Research building on FIRMADYNE:

- **FirmAE** - extends FIRMADYNE's emulation with more aggressive compatibility heuristics, improving the network inference success rate.
- **Firm-AFL** - combines AFL greybox fuzzing with process emulation for higher throughput.
- **FIRM-COV** - optimized process emulation aimed at higher code coverage.
- **IOTFUZZER** - drops emulation entirely and fuzzes firmware through the companion mobile app.
- **Snipuzz** - blackbox fuzzing through message snippet inference, without source code or emulation.

---

## References

Chen, D., Woo, M., Brumley, D., & Egele, M. (2016). Towards Automated Dynamic Analysis for Linux-based Embedded Firmware. *Proceedings of the 2016 Network and Distributed System Security Symposium (NDSS)*.

[Supplementary video walkthrough](https://www.youtube.com/watch?v=Zdoef_4LSHA)
