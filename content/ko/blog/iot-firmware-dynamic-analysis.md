---
title: "IoT Firmware Dynamic Analysis: Towards Automated Analysis of Linux-based Embedded Firmware"
date: 2021-01-01
description: "Research paper summary: automated dynamic analysis techniques for Linux-based embedded firmware including emulation strategies, peripheral modeling, and vulnerability discovery in router firmware"
tags: ["IoT", "firmware", "fuzzing", "dynamic-analysis", "embedded", "router", "research", "QEMU"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Introduction

Analyzing embedded firmware at scale is one of the harder unsolved problems in security research. Unlike desktop software, IoT firmware runs on heterogeneous hardware, depends on proprietary peripherals, and is rarely built with debuggability in mind. Getting a router's web interface to run on your laptop — without the actual NVRAM chip, the specific SoC, or the vendor's custom kernel — requires a non-trivial emulation stack.

This post summarizes *"Towards Automated Dynamic Analysis for Linux-based Embedded Firmware"* (NDSS 2016), which introduces **FIRMADYNE**, a system designed to emulate and analyze Linux-based embedded firmware at scale. The paper evaluates FIRMADYNE against a dataset of 23,035 firmware images from 42 vendors, and uses it to discover 14 previously unknown vulnerabilities and confirm 74 known ones across 887 reachable firmware images.

A companion survey — *"Vulnerability Detection in IoT Firmware: A Survey"* (ICPADS 2017) — provides useful framing for where FIRMADYNE sits among competing approaches, and that context is woven in throughout.

---

## Problem Statement: Why IoT Firmware Analysis Is Hard

The core challenge is the **hardware dependency problem**. Embedded firmware is compiled for specific SoCs, expects specific peripherals (NVRAM, MTD partitions, watchdog timers), and boots against vendor-modified kernels. Naively running the firmware binary on a general-purpose QEMU instance fails because:

1. The original kernel targets specific hardware and crashes on a generic platform.
2. Userspace processes call into NVRAM (`nvram_get`, `nvram_set`) and get NULL back, causing crashes during boot.
3. Vendor-specific device nodes (`/dev/mtdX`, `/dev/mem` mappings) don't exist.
4. Network interface names differ between the real hardware (`ra0`, `ath0`) and the emulated platform (`eth0`).

The survey paper frames four general approaches to IoT firmware analysis:

| Approach | Example | Limitation |
|---|---|---|
| Static analysis | Binary diffing, taint propagation | Cannot detect runtime logic flaws |
| Symbolic execution | Firmalice (built on angr) | Requires manual security policy; doesn't scale |
| Fuzzing on emulators | Avatar, FIRMADYNE | Peripheral emulation gaps cause boot failures |
| Comprehensive testing | Static taint + dynamic fuzzing | Hardware-dependent images can't be fully simulated |

FIRMADYNE bets on the third category — full-system emulation — and tries to solve the peripheral gap problem with a combination of instrumented kernels and userspace shim libraries.

---

## Architecture Overview

FIRMADYNE is a pipeline with four major stages: **crawling**, **extraction**, **emulation**, and **dynamic analysis**.

### 1. Firmware Crawling

A Scrapy-based crawler downloads firmware from 42 vendor support pages, with hand-written XPath parsers for each. Vendors using dynamic websites (D-Link, ZyXEL) were crawled via FTP mirrors instead. For each image, the crawler collects structured metadata: product name, version, release date, changelog, MIB file links.

This metadata turns out to be useful later — MIB files, for example, feed into automated SNMP analysis. The crawler collected 23,035 images total, with the dataset spanning routers, NAS devices, IP cameras, cable modems, smart TVs, and access points.

### 2. Filesystem Extraction

FIRMADYNE uses a custom extraction utility built on the `binwalk` API, but doesn't use binwalk's default recursive extraction ("Matryoshka") — that approach wastes resources by fully unpacking nested archives. Instead, the extractor terminates as soon as it locates a root filesystem.

Key improvements over vanilla binwalk:
- Prioritized signature matching: firmware headers matched before generic GZIP data, reducing false positive extraction attempts.
- Third-party tools `jefferson` (JFFS2) and `sasquatch` (SquashFS) replace the standard `jffsdump`/`unsquashfs` because vendor-modified filesystems frequently fail with the standard tools.
- Heuristics blacklist non-firmware inputs: PE32, ELF, Universal Binary, PDF, Office documents.

A root filesystem is verified by checking for at least 4 standard FHS directories. The team also submitted bug fixes for binwalk and jefferson upstream.

Not everything extracts cleanly. Encrypted images, binary updater executables, partial filesystems, and unrecognized filesystem types are all classified as unknown and skipped.

### 3. Emulation

This is the most technically interesting part of the paper.

**Kernel substitution.** Rather than booting the original vendor kernel (which is compiled for specific hardware and would immediately crash), FIRMADYNE builds its own custom kernels for ARM little-endian, MIPS little-endian, and MIPS big-endian. These three architectures cover 90.8% of the dataset. The custom kernels include a kernel module that hooks 20 system calls using kprobes, enabling monitoring of network interface assignments, bridge creation, MAC address changes, and program execution.

**NVRAM emulation.** At least 52.6% of firmware images use `libnvram.so` to access hardware NVRAM — a key-value store that holds network settings, credentials, and device configuration. Without it, `nvram_get()` calls return NULL and the boot process crashes.

FIRMADYNE intercepts NVRAM calls via `LD_PRELOAD`, injecting a custom userspace library before init starts (so all child processes inherit it). The library uses the ELF lazy binding mechanism with `-nostdlib` compilation: it defers resolution of standard C runtime symbols until the calling process loads libc, making it compatible across different toolchains in the dataset without static linking.

Default NVRAM values are loaded from known locations in the firmware filesystem (`/etc/nvram.default`, `/etc/nvram.conf`, `router_defaults` symbols in shared libraries). For images where these don't exist, NVRAM calls may still crash the boot.

**Network inference ("learning" phase).** Before the real analysis run, each firmware image boots for 60 seconds in a "learning" mode. The instrumented kernel records which IP addresses get assigned to which network interfaces and whether 802.1d bridges or 802.1Q VLANs are configured. This allows FIRMADYNE to set up a TAP interface on the host side with the correct IP and VLAN configuration, so the host can actually communicate with the emulated firmware.

**Platform-specific quirks.** The MIPS target uses the Malta development platform (kernel 2.6.32.68). ARM uses the Versatile Express platform with a Cortex-A9 (ARMv7-A) because the standard ARM926 doesn't support newer ARM instructions present in some firmware images. A known limitation: the ARM platform supports only one emulated Ethernet device (no PCI bus), which breaks some multi-interface firmware.

For 138 firmware images using the `alphafs` web server — which directly mmaps physical flash at `0x1e000000` expecting a specific VendorID/ProductID — FIRMADYNE patches 16 bytes in the QEMU source to return known-good values.

### 4. Dynamic Analysis

Three automated analysis passes run against each successfully emulated image:

**Accessible webpages.** A Python harness walks the firmware filesystem looking for files under `/www/` (or similar), filters out static resources (`.png`, `.css`, `.js`), and attempts direct HTTP access to each. Responses with non-2xx codes are discarded. Pages that respond with a redirect are flagged as low-confidence (often soft-auth pages using cookies rather than HTTP 401). Results aggregate across the dataset to rank URLs by accessibility.

**SNMP enumeration.** Using `snmpwalk` with "Public" and "Private" community strings, the system dumps all unauthenticated SNMP data. MIB files collected during crawling help interpret OIDs. This surfaces sensitive information: network configurations, credentials, device identifiers.

**Known and novel vulnerability detection.** 60 known exploits (mostly from Metasploit) run sequentially against each image — buffer overflows, command injections, information disclosure, DoS. For novel vulnerabilities, the team developed PoC exploits manually using poisoned values like `0xDEADBEEF` and `0x41414141`, then checks the instrumented kernel log for those values appearing in unexpected places (segfaults at poison addresses, poison values passed to system calls).

---

## Key Results

From the 23,035 images collected:

- **96.6%** (8,591) entered the initial emulation phase.
- **32.3%** (2,797) successfully inferred a network configuration.
- **70.8%** (1,971) were reachable via ping.
- **45%** (887) of reachable images were vulnerable to at least one exploit.

The drop from 8,591 to 2,797 at the network inference step is significant — most failures are attributed to NVRAM emulation issues: missing defaults, incompatible NVRAM semantics, or firmware that bypasses `libnvram.so` and writes directly to MTD partitions.

The vulnerability breakdown:
- **14 previously unknown vulnerabilities** affecting 69 firmware images.
- **74 known vulnerabilities** confirmed across 887 images.

Network service prevalence in reachable images:
- 47.3% expose a web-based configuration interface (HTTP or HTTPS).
- Only 9.5% of those use HTTPS — just 19.8% of HTTP-supporting devices.
- 27.2% appear to be routers (DNS proxy service detected).
- 16.4% have UPnP enabled by default, allowing LAN devices to configure WAN port forwarding automatically.

---

## Comparison with Related Approaches

The 2017 survey paper positions FIRMADYNE among three other tools worth knowing:

**Firmalice** (symbolic execution on angr) targets authentication bypass: hardcoded credentials, hidden auth interfaces, unprotected access points. It works at binary level without instrumentation but requires manually specifying a security policy per device. It doesn't scale to thousands of images.

**Avatar** uses a physical device as a co-processor: firmware code runs in the emulator, but I/O operations are forwarded to the real hardware. This achieves high accuracy but requires physical access to each device type. Emulated execution is also much slower than native.

**FIRMADYNE** trades accuracy for scale. It can run 23,000 images automatically; Avatar cannot. The cost is fidelity: NVRAM defaults are approximated, out-of-tree kernel modules aren't loaded, and some firmware images simply fail to boot or reach the network.

The survey also mentions a "comprehensive testing" approach that combines static taint tracking with dynamic fuzzing, improving code coverage and facilitating exploit generation — essentially what later tools like FIRM-AFL and FIRM-COV iterate on.

---

## My Notes

**The 32% network inference rate is the real bottleneck.** FIRMADYNE gets most firmware to boot, but only a third successfully configure networking. The paper traces this mostly to NVRAM failures. The insight — that NVRAM defaults are buried in filesystem text files or exported symbols in shared libraries — is clever, but it's inherently fragile. Firmware that doesn't follow these conventions just fails silently.

**The custom kernel is both a strength and a limitation.** Instrumenting the kernel with kprobes is elegant: you get system-level observability without modifying any userspace binary. But it means FIRMADYNE can't detect vulnerabilities in the vendor's original kernel or out-of-tree kernel modules (99%+ of which turn out to be irrelevant, the paper notes). And adding a new architecture isn't automated — it requires picking the right QEMU platform, building a compatible kernel with kprobe support, and rebasing the custom kernel module.

**The 45% vulnerability rate among reachable images is striking.** Nearly half of firmware images that could be reached over the network had at least one exploitable vulnerability. Even as a lower bound (some exploits fail even when the vulnerability exists), this is a damning statistic about the state of embedded firmware security at the time.

**The PoC validation approach is underappreciated.** Using poison values like `0xDEADBEEF` and checking the instrumented kernel log for them is a clean, general mechanism for confirming exploitation success without binary-specific logic. It sidesteps the usual problem of needing to know what "success" looks like for each vulnerability.

**What this work doesn't cover:** FIRMADYNE is explicitly a whole-system analysis tool — it's not doing coverage-guided fuzzing, it's running fixed exploit scripts. The successor tools (FIRM-AFL, FIRM-COV, FirmAE) build on this emulation foundation to add greybox fuzzing with feedback. FIRMADYNE establishes that emulation is viable at scale; the later work asks how to explore the state space efficiently once you're inside.

**The NVRAM problem is still unsolved.** Even in 2021, papers on IoT firmware emulation still cite NVRAM initialization as a major cause of emulation failure. FIRMADYNE's approach — load defaults from known filesystem paths, intercept via LD_PRELOAD — works for the common case but doesn't handle firmware that talks directly to MTD or uses proprietary NVRAM interfaces.

---

## Related Papers (from Paper List)

For anyone following this research area, the trajectory from FIRMADYNE forward:

- **FirmAE** — extends FIRMADYNE's emulation with more aggressive compatibility heuristics, improving network inference rates.
- **Firm-AFL** — augments process emulation with AFL greybox fuzzing for higher throughput.
- **FIRM-COV** — optimized process emulation targeting higher code coverage.
- **IOTFUZZER** — fuzzes firmware through the companion mobile app, avoiding emulation entirely.
- **Snipuzz** — black-box fuzzing via message snippet inference, no source or emulation required.

---

## Reference

Chen, D., Woo, M., Brumley, D., & Egele, M. (2016). Towards Automated Dynamic Analysis for Linux-based Embedded Firmware. *Proceedings of the 2016 Network and Distributed System Security Symposium (NDSS)*.

[Supplementary video walkthrough](https://www.youtube.com/watch?v=Zdoef_4LSHA)
