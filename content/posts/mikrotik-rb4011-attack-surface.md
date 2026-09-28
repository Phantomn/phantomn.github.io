---
title: "Router Security Review — A Retrospective on Public MikroTik RB4011 Vulnerabilities"
date: 2026-08-05T00:00:00.000Z
excerpt: >-
  A defender's retrospective on the attack surface of the MikroTik RB4011 using only
  public hardware specifications and already-patched CVEs. It organizes router hardening
  principles centered on the CVE-2023-32154 case from Pwn2Own Toronto 2022.
tags:
  - mikrotik
  - routeros
  - router-security
  - attack-surface
  - cve-2023-32154
  - network-security
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Summary

**The security of a small router is already half-decided before you buy the hardware.** Default settings, exposed management interfaces, physical access vectors, and un-updated firmware — these four explain the majority of SOHO (Small Office/Home Office) router incidents. Taking the MikroTik RB4011iGS+5HacQ2HnD as an example, this article uses only **public hardware specifications and CVEs for which the vendor has already released patches** to retrospect on what a defender should check.

The CVE-2023-32154 covered here was publicly demonstrated at Pwn2Own Toronto 2022 and patched by MikroTik in May 2023. In other words, it is **not a new discovery but the lesson of an already-concluded incident.** Exploit code and reproduction procedures are outside the scope of this article; it focuses on what a defender should confirm in an asset inventory.

We view it across three layers: hardware and physical access, network and management interfaces, and the public CVE timeline.

---

## 1. Hardware and Physical Access Surface

### The Position of the RB4011

The RB4011 is a MikroTik wired-centric SOHO/enterprise edge router. The full model name `RB4011iGS+5HacQ2HnD-IN` carries the specification directly. `iGS+` denotes a gigabit interface group including an SFP+ cage, `5Hac` denotes 5GHz 802.11ac wireless, and `Q2HnD` denotes a 2.4GHz wireless module. In other words, this model is **an integrated edge device that adds dual-band wireless on top of 10 wired ports.**

From a defender's perspective, the reason hardware specifications matter is simple. **The attack surface is the sum of physically existing interfaces.** Every powered-on port, exposed console, and enabled wireless radio is a potential entry point. Reading the spec sheet is the first step of building an inventory.

### Two Wireless Radios

The RB4011 carries two physically separate wireless modules.

| Band | Module | Chains | Max Bandwidth |
|------|------|------|------------|
| 2.4 GHz | R11e-2HnD | 2T2R | 40 MHz (802.11n) |
| 5 GHz | QCA-9984 | 4T4R | 160 MHz (802.11ac Wave2) |

The two radios are each an independent attack surface. Even if you turn one off, if the other is on, the wireless entry point is still open. In particular, the 5GHz QCA-9984 is a high-performance module supporting up to 4T4R and 160MHz, so its coverage is wide — this is an advantage for performance, but it is also a defensive consideration that **the signal can reach beyond the intended physical boundary.** If you place the AP near a wall, the SSID may be picked up from a parking lot or the next building.

In the default state, this device has AP mode enabled and, as discussed later, has no initial wireless password. The wireless radios also support CPE, P2P, and Repeater modes, so the character of the surface changes depending on the deployment scenario. The principle for a defender is to first decide "what wireless mode is actually needed," and disable the rest.

### The Constraints of the SFP+ Port

The RB4011's SFP+ cage does not accept every optical module. According to the public spec, passive DAC modules, 1G copper SFP, and SFP GPON modules are unsupported. This fact is two-sided for security. On one hand it is a constraint that makes it hard to insert an arbitrary module to leverage a physical channel; on the other, it is an operational burden that the operator must check the compatible module list in advance. From a defense perspective, the SFP+ slot is a **physically accessible expansion port**, so if you are not using it, it is better to leave it empty and control physical access itself.

### The Serial Console — The Core of Physical Access

The RB4011 provides a serial console in RJ45 form. The communication parameters are the standard 115200/8N1. Connecting an RJ45-USB serial adapter gives access to the RouterOS shell (login is required).

For a defender, the meaning of the serial console is clear. **Anyone whose hands can physically reach the device is standing at the door of the management plane.** This is why physical security — placing it in a data center rack, a locked communications room, under a surveillance camera — is as important as cyber controls. Even if you put strong authentication on console access, if physical access is not controlled, it can be bypassed with the reset sequence described in the next section.

The reason the serial console is especially dangerous is that it is **a channel that exists at a layer prior to authentication, not a channel that bypasses authentication.** During the boot process, the console outputs bootloader messages, the kernel load process, and the initialization sequence as-is. In the normal state login is required, but merely observing the boot flow reveals information such as firmware version, hardware revision, and boot order. From a defender's perspective, this reaffirms the principle that "physical access equals information exposure." It is common for SOHO routers to be left in uncontrolled spaces like lobbies, meeting rooms, and warehouses, and such placement is itself a vulnerability.

### The Reset Button — A Three-Stage Sequence

The reset button of a MikroTik router does different things depending on the hold time. Organized on the basis of the public user manual:

| Vector | Method | Result |
|------|------|------|
| Serial console | RJ45→USB adapter, 115200/8N1 | RouterOS shell (login required) |
| Reset 5s | Hold during boot → release when LED blinks | Configuration reset (full reset) |
| Reset 10s | Keep holding → LED solid → release | CAP mode (CAPsMAN server discovery) |
| Reset 15s | Keep holding → LED off → release | Netinstall mode (port 1 TFTP) |
| RouterBOOT | Hold the button before power-on | Enter backup bootloader |

This sequence is a normal recovery feature, but it is also **a path by which someone with physical access can wipe the configuration entirely and revert to the initial state.** If a 5-second hold fully resets the configuration, it returns to the initial unauthenticated WebFig state. In other words, physical access can nullify logical controls with a single reset button.

The defense principle is simple. **A physical device with a reset button and console goes in a physically controlled space.** No matter how robustly you build remote management, the moment a hand reaches the reset button, that robustness disappears within 15 seconds.

Each stage of the reset sequence connects to a different threat scenario. The configuration reset of the 5-second hold means the aforementioned regression to the unauthenticated state. The CAP mode of the 10-second hold switches the device to a state where it seeks a CAPsMAN central management server, which can open room for the device to attach to a malicious management server on an untrusted network. The Netinstall mode of the 15-second hold is a TFTP reinstall state via port 1, and a scenario of pushing arbitrary firmware through this path holds. The backup RouterBOOT entered by holding before power-on is a recovery path at the bootloader layer. These four stages are all legitimate recovery features, but to someone with physical access they are also **four different doors that bypass logical controls.** The defender must recognize the mere fact that these doors exist and design commensurate physical controls.

To add one thing, physical control does not stop at "lock up the device." Recording each device's physical location, who has access rights, and whether the console/reset are exposed in the asset inventory is also part of physical control. A device you do not know the location and contents of cannot be controlled.

---

## 2. Network and Management Interface Surface

### The Default Configuration State — The Widest Window

The initial state of a RouterOS device is broadly open for convenience. Organizing the defaults on the basis of the RB4011's public manual:

| Item | Default | Defense Priority |
|------|--------|--------------|
| Management IP | 192.168.88.1 | - |
| WebFig password | None (auto-login) | **Top** |
| Wireless SSID | "MikroTik" | Medium |
| Wireless password | None | **Top** |
| Wireless AP | Enabled | Medium |
| Internet port (1) | Winbox/SSH blocked from outside | Mitigated |
| DHCP server | Enabled | - |

The most important fact here is that **the initial WebFig has no password and auto-logs in.** The wireless AP is also enabled, and there is no wireless password. When the two conditions overlap, it means that right after first powering on the device, anyone within wireless range can reach the management interface.

Fortunately, MikroTik places a mitigation so that the internet port (port 1) blocks Winbox and SSH by default, keeping the management plane from being immediately exposed externally even if a freshly unboxed device is plugged straight into the WAN. But this is merely **a single layer of defense.** The first action a defender should take is clear — immediately upon unboxing, before connecting to the internet, set the administrator password and configure wireless security.

### The Management Interface List

RouterOS provides several management channels simultaneously. Each is a separate door with its own authentication and protocol.

| Interface | Protocol/Port | Enabled by Default | Defense Note |
|-----------|--------------|-----------|-----------|
| WebFig | HTTP (80) | Enabled | Initially unauthenticated. Switch to HTTPS and restrict access |
| Winbox | TCP 8291 (including MAC layer) | Enabled | Reachable from the LAN by MAC address |
| SSH | TCP 22 | Enabled | Key authentication recommended, restrict source IP |
| Telnet | TCP 23 | Varies by version | Plaintext — disable |
| API | TCP 8728/8729 | Configurable | Disable when unused |
| FTP | TCP 21 | Configurable | Disable when unused |

Winbox needs particular attention. Besides TCP 8291, it supports **MAC-layer discovery**, so management access is possible even when L3 connectivity is broken due to a misconfigured IP, as long as it is on the same L2 segment. This is a convenient recovery path for the operator, but from a defense perspective it means "IP firewall rules alone cannot completely block Winbox access." The standard is to isolate management traffic into a separate VLAN and design so that the management interface can only be reached from a physically trusted segment.

Telnet and plaintext protocols should be disabled as a matter of principle. The same goes for unused API and FTP. **A service that is off is not an attack surface** — the surest hardening is to turn off what is unnecessary.

### Organized as a Defense Checklist

Organizing the core of management interface hardening in order:

1. **Set the administrator password immediately after unboxing** — immediately close the unauthenticated WebFig window.
2. **Disable unnecessary services** — Telnet, FTP, unused API, unused wireless radios.
3. **Isolate the management plane** — separate management traffic into a dedicated VLAN/interface, and block all management interfaces on the WAN side.
4. **Restrict source IP** — restrict SSH/Winbox access to a trusted management range.
5. **Switch to encryption** — HTTPS for WebFig, SSH key authentication for the shell.
6. **Control physical access** — put devices with a console/reset button in a locked space.

There is nothing new in this list. Yet the majority of SOHO router incidents arise from skipping these basics.

### Clues Wireless Regulatory Information Gives to Defense

The RB4011's public wireless certification information (FCC/IC/CE) may look like regulatory paperwork at a glance, but to a defender it is **material for accurately understanding the device's physical wireless surface.** According to the public certification documents, this device's 5GHz radio operates in several bands from U-NII-1 through U-NII-3, of which the U-NII-2A (5260~5320 MHz) and U-NII-2C (5500~5720 MHz) bands require the DFS (Dynamic Frequency Selection) Master function and TPC (Transmit Power Control). DFS is originally a regulatory requirement for radar interference avoidance, but from a defense perspective it is **a map that tells you in which frequency bands the device actually emits.**

To defend the wireless surface, you first need to know "in which bands, at what power, does our device emit." Public certification information answers this question — for instance, the fact that the 2.4GHz module operates at up to 1.0W and the 5GHz bands operate in a range from tens to hundreds of mW per band lets you estimate the approximate radius of signal coverage. Wide coverage means that the wireless entry point may be open beyond the physically intended boundary. Also, information such as the antenna separation distance commonly required by FCC/IC/EU (a minimum of 20cm) or the indoor-only constraints on certain 5GHz bands serves as a reference for deciding physically where and how to place the device.

The practices a defender should take from regulatory documents are as follows. Disable wireless bands and radios that are not actually used, adjust the AP's physical location and power to match the needed coverage, and check whether the wireless boundary coincides with the organization's physical boundary. **A regulatory document is public material that a defender, not an attacker, can make better use of.**

---

## 3. Public CVE Timeline — A Retrospective on CVE-2023-32154

Now we retrospect from a defender's perspective on one already-published and patched vulnerability. This is a matter for which the vendor has already completed a fix release, and here we focus not on the exploitation method but on **why this bug survived so long and what a defender should learn.**

### Incident Overview

| Item | Content |
|------|------|
| Competition | Pwn2Own Toronto 2022 |
| Category | SOHO Smashup |
| Research team | DEVCORE (Angelboy, NiNi) |
| Demonstration target | MikroTik RB2011UiAS-IN → Canon printer |
| CVE | CVE-2023-32154 |
| CVSS | 7.5 (High) |
| Public patch date | 2023-05-19 |
| Prize | $100,000 |

Point to note: **the demonstration target was the RB2011, not the RB4011.** Yet the reason this case serves as a reference point for the RB4011 review is that the two models share the same RouterOS codebase. Router vulnerabilities often exist not in specific hardware but in **common firmware logic.** For a defender, this is an important inventory lesson — the assumption "our model was not the demonstration target, so we are safe" is dangerous. It may be a flaw shared by a sibling model running the same OS.

### The Nature of the Vulnerability (Conceptual Level)

This CVE was a memory safety flaw in RouterOS's IPv6 Router Advertisement processing path. According to the published ZDI advisory (ZDI-23-710) and DEVCORE's official retrospective, the root cause was processing the length field of the RDNSS (Recursive DNS Server) option without validating it sufficiently. It is a typical parser flaw type of **copying while trusting the length value of the input field.**

The lesson a defender takes here is not the exploitation technique but the **reachability condition.** According to public material, for this flaw to become a problem the IPv6 package must be enabled, and the attacker must be in a position to exchange IPv6 Router Advertisements with the victim device. This is information that connects directly to defensive design.

### Why It Lay Dormant for 9 Years

The most instructive part of the public retrospective is the fact that this flaw went undiscovered for about 9 years (since the RouterOS v6 line). Organizing the published root-cause analysis in defender's language:

| Factor | Defender's Perspective Interpretation |
|------|-----------------|
| IPv6 disabled by default | Being off by default, real exposure cases were rare, so it stayed out of attention |
| Threat model omission | WAN-side ICMPv6 RA processing was missing from an internal-network-centric threat model |
| Low code visibility | Being a vendor-proprietary implementation, it was outside the coverage of open-source static analysis tools |
| Not caught by scanning | Requiring a specific enabling condition and L2 reachability, it was undetectable by wide-area internet scans |

These four accurately show the **danger of the illusion that "a feature disabled by default is safe."** Code that receives less attention because a feature is off tends to be less thoroughly reviewed, and when it happens to get turned on, an old flaw is exposed as-is. A defender must know precisely which features are actually enabled in their assets, and features that are "on despite not being used" are exactly the priority for inspection.

### Action Items for Defenders

Although the matter is already patched, the defense principles derived from the retrospective are still valid.

1. **Keep firmware up to date.** The RB4011 may ship from the factory with a RouterOS v6 line installed. Updating to the latest stable version after unboxing is the first action. CVE-2023-32154 is also resolved by updating.
2. **Turn off protocol stacks you do not use.** If you do not actually use IPv6, disable that package. Eliminating the reachability condition itself is the strongest mitigation.
3. **Control management and routing protocol traffic at the boundary.** Filter Router Advertisements and routing protocol messages coming from untrusted segments at the boundary. Length-trusting parser flaws are not a type limited to RDNSS alone, so apply the same boundary control principle to neighboring protocols (DHCPv6, MLD, OSPFv3, etc.).
4. **Include sibling models in the inventory.** If there are other MikroTik devices in the organization running the same RouterOS, map a single CVE notice to the entire asset base.

### The Value of a Public Window Like Pwn2Own

From a defender's perspective, the very existence of a public competition like Pwn2Own is an asset. When a researcher demonstrates a flaw, it is conveyed to the vendor through a coordinated disclosure process, and after a patch is distributed, an advisory is published. In the case of CVE-2023-32154, it went through the flow of December 2022 demonstration → May 2023 patch → advisory publication. A defender can **monitor this public window to catch, early, notices that apply to their own asset base.** Vendor security notices, ZDI advisories, and competition result announcements become a powerful early-warning channel when linked to the asset inventory.

Looking again at the flow of coordinated disclosure from a defender's perspective, there is a **time window for the defender to respond** built into it. Between the demonstration point and the patch release, and between the patch release and the point the organization actually applies it, there is an exposure interval each. A vendor releasing a patch does not automatically make the organization's assets safe — **a patch is not distributed, it is applied.** Shrinking these two intervals is the core of defensive operations. Subscribing to vendor notice channels, automatically cross-referencing the asset inventory against CVEs, and operating patch application as a routinized procedure — these three narrow the exposure window.

Also, the retrospective material of a public competition is itself **threat intelligence.** DEVCORE's retrospective on CVE-2023-32154 did not merely say "there was a bug" but analyzed "why it hid for 9 years," and from that analysis a defender gets clues to inspect similar blind spots in their own environment. Features disabled by default, vendor-proprietary implementations, paths omitted from the threat model — these patterns are not unique to MikroTik. The same kinds of blind spots can exist in other vendors' other devices. **Translating one incident's retrospective into inspection items for your own environment** is the mature way to consume threat intelligence.

---

## Closing

The RB4011 is well-made hardware, but like any SOHO router, **its security is decided by operation, not by specifications.** Summarizing the principles repeated in this retrospective:

- **Narrow the broad default state immediately upon unboxing** — passwords, wireless security, unnecessary services.
- **Isolate the management plane and control it at the boundary** — including Winbox's MAC-layer reachability.
- **Treat physical access as importantly as logical controls** — if there is a console and a reset button.
- **Update firmware and put sibling models in the inventory** — CVEs target the common OS, not the hardware.
- **Turn off unused features** — the lesson of the 9-year dormant bug was "a sleeping feature is the most dangerous."

Everything this article covered came from published spec sheets, vendor security notices, and already-patched, publicly-disclosed CVEs. Most of defense comes not from secrets but from **the discipline of faithfully mapping already-public information onto your own assets.**

---

## References

- MikroTik official security notice: CVE-2023-32154 — https://mikrotik.com/supportsec/cve-2023-32154/
- Zero Day Initiative advisory ZDI-23-710 — https://www.zerodayinitiative.com/advisories/ZDI-23-710/
- DEVCORE official retrospective: "A 9-year-old bug in MikroTik RouterOS" — https://devco.re/blog/2024/05/24/pwn2own-toronto-2022-a-9-year-old-bug-in-mikrotik-routeros-en/
- MikroTik RB4011 product user manual (public specifications)
- FCC/IC/CE wireless certification public documents
