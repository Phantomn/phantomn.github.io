---
title: 'IEC 62443-4-2 Primer - A Map of FR1-7 and Component Requirements'
date: 2026-08-09T00:00:00.000Z
excerpt: >-
  A primer map for anyone new to IEC 62443-4-2. Covers why the 62443 series is divided by
  audience rather than topic, the four faces of SL and the three faces of SL 0, the Component
  Requirements (CR) of the seven Foundational Requirements (FR1-7), the SAR/EDR/HDR/NDR
  component types, and the distinctly industrial-security idea of "maintain degraded mode
  instead of preventing DoS."
tags:
  - iec-62443
  - ics
  - ot
  - component-security
  - foundational-requirements
  - security-level
  - plc
  - compliance
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Introduction

IEC 62443-4-2 is the standard that defines what cybersecurity requirements each individual **component** - a PLC, an industrial switch, an HMI PC, SCADA software - that makes up an Industrial Automation and Control System (IACS) must satisfy. This post is a map for anyone encountering the standard for the first time.

Opening the 62443 documents for the first time can feel overwhelming. There are multiple parts, and abbreviations like FR, CR, SR, SL, and SL-C come flooding in. But once you grasp a handful of skeletal ideas, everything else falls into place. Those ideas are: **the standard is divided by audience, not by topic. SL has four faces. Security decomposes into 7 independent axes (FRs). And the goal of industrial security isn't "block the attack" but "don't let go of control even while under attack."**

This post covers IEC 62443-4-2 itself. How to actually read a certificate is covered in a [separate post](/en/blog/iec-62443-4-2-certification-myth/), and its relationship to the CRA is covered in [another post](/en/blog/cyber-resilience-act-2027/). Here, we build the skeleton of the standard itself.

---

## Part 1 - Getting Your Bearings

### 1.1 Why IACS Security Differs from IT Security

The starting point is this question: why can't you just bolt an IT security solution onto an industrial control system?

Because the priorities are different.

- **IT security** - protecting information comes first. Confidentiality is the top value. A server being briefly slow or rebooting is an acceptable cost.
- **IACS security** - the control system's **availability**, plant protection, operational continuity, and real-time responsiveness come first. If a controller stops even briefly, that's a physical incident.

Applying IT security measures directly to an IACS causes side effects. Strong authentication delays operation during an emergency; running an integrity check causes the real-time control cycle to be missed. This results in **loss of essential services and disruption of emergency procedures.** That's why an IACS needs a different security framework from IT, and 62443 is that framework.

This inversion of priorities runs through this entire post. Requirements we'll see later - "authentication must not interfere with emergency operations," "maintain degraded mode instead of preventing DoS" - all stem from this.

### 1.2 62443 Is Divided by Audience, Not Topic

The most common misconception is reading "1-1 is the introduction and 4-2 is the advanced part." **Wrong.** The axis dividing the 62443 series isn't difficulty - it's **who is responsible for what.**

| Part | Target Audience | Defines |
|---|---|---|
| **1-x** General | Everyone | Terminology, concepts, models. Shared vocabulary for the series |
| **2-x** Policies & Procedures | Asset owners / service providers | Security program (2-1), service provider requirements (2-4) |
| **3-x** System | System integrators | Risk assessment, zone/conduit design (3-2), system SR + SL (3-3) |
| **4-x** Component | Product suppliers | Secure development process (4-1), component CR + SL-C (4-2) |

In other words, each part is written **for a different role to read.** And **which standards each role must claim conformance to differs.**

| Role | Responsibility | Standards to Conform To |
|---|---|---|
| **Asset Owner** | Accountable for overall IACS security. Approves security policy, defines acceptable residual risk | 2-1, 2-4, 2-2, 3-2, 3-3 |
| **Integration Service Provider** | Designs, deploys, and verifies automation solutions | 2-4, 3-2, 3-3 |
| **Maintenance Service Provider** | Ongoing maintenance, decommissioning | 2-4, 3-2, 3-3 |
| **Product Supplier** | Develops and supports products, provides security capability | **4-1, 4-2** |

**4-2 is the product supplier's standard.** It exists for a company that makes a PLC to demonstrate "our PLC has this security capability." An asset owner cannot claim security for their entire plant using 4-2 - that's the territory of 3-2, 3-3, and 2-1. The key to this structure is that you cannot claim conformance to a standard outside your own role.

Restated as a standards hierarchy:

```
IEC 62443-1-1 (terminology/concepts/models)
    |__ IEC 62443-3-3 (defines system SR + SL)
            |__ IEC 62443-4-2 (defines component CR + SL-C)
IEC 62443-4-1 (secure product development process)
```

4-2's component requirements (CR) are a component-level concretization of 3-3's system requirements (SR). **This is why CR numbers are designed to match SR numbers** - to maintain traceability. This is also why CR numbers can appear discontinuous (for example, there might be no CR 1.6, jumping straight to CR 1.7).

### 1.3 The Four Faces of SL

In 62443, "security level" (SL) isn't a single concept. It's **four distinct concepts**, each belonging to a different stage of the lifecycle. Confusing these is the most common source of SL misuse.

| Type | Name | Meaning | Determined by |
|---|---|---|---|
| **SL-T** | Target | The **required target** level | Asset owner/integrator (risk assessment) |
| **SL-C** | Capability | The capability a component can **provide on its own** | Product supplier |
| **SL-D** | Deployed | The level actually satisfied immediately after deployment | Integrator |
| **SL-A** | Achieved | The **actual** level achieved during operation | Asset owner |

**4-2 addresses only SL-C.** It's notated as `SL-C(FR, component)`, with values ranging from 0 to 4. SL-C means "this component's capability to independently defend against this level of threat, without compensating countermeasures." It's separate from the level actually achieved in the deployed environment (SL-A) or the target (SL-T).

Order matters. **SL-T is determined first, and then a component with the SL-C to meet it is selected.** A risk assessment (3-2) assigns SL-T to each zone/conduit, and where SL-C falls short of SL-T, it's compensated for with measures like a firewall. **Not every component needs to independently satisfy the SL-T on its own** - this is an explicit principle in 3-3.

### 1.4 The Three Faces of SL 0

One practical consequence of SL having four types: **even the same "SL 0" means the opposite thing depending on the type.**

| Type | Meaning of SL 0 |
|---|---|
| **SL-C** | The component **fails to meet** part of that FR's SL1 requirements -> a defect signal |
| **SL-T** | Risk analysis determined that less than SL1 is **sufficient** for that FR -> a normal judgment |
| **SL-A** | That zone **is currently failing to meet** part of the SL1 requirements -> a degradation signal |

**SL-C 0 is a flaw, while SL-T 0 is a reasonable decision.** "This FR isn't that important in this zone, so SL-T was set to 0" can be a normal risk decision. But "this product's SL-C is 0" is a flaw meaning it doesn't even meet the minimum requirement. Reading the same notation the same way ruins your judgment.

One more thing - SL is a threat actor profile, not a quality grade.

| SL | Attacker Profile |
|----|----------------|
| **SL 1** | Casual or coincidental access |
| **SL 2** | Intentional attacker using simple means, low resources, generic skills, low motivation |
| **SL 3** | Sophisticated means, moderate resources, IACS-specific skills, moderate motivation |
| **SL 4** | Sophisticated means, extended resources, IACS-specific skills, high motivation (nation-state level) |

A higher SL doesn't mean "a better product" - it means "a product designed against a stronger adversary." SL1 prevents mistakes; SL4 defends against nation-state-backed attacks.

### 1.5 CR and RE - How Requirements Accumulate

Each FR is broken down into multiple CRs (Component Requirements). And each CR defines a baseline requirement, with higher SLs achieved through **REs (Requirement Enhancements)**. REs accumulate.

Take CR 1.1 (human user identification and authentication) as an example:

| SL-C(IAC) | Applicable Requirements |
|-----------|---------------|
| SL 1 | CR 1.1 (baseline) |
| SL 2 | CR 1.1 + RE(1): unique identification and authentication |
| SL 3 | CR 1.1 + RE(1) + RE(2): multi-factor authentication (MFA) |
| SL 4 | CR 1.1 + RE(1) + RE(2) |

Each CR document is read in four parts - **Requirement** (the minimum functionality to satisfy), **Rationale** (why it's needed, operational context), **RE** (conditions for higher-SL enhancement), and **Security levels** (the CR/RE combination per SL). This pattern applies consistently across every CR.

### 1.6 Per-FR Independent Assessment - SL Is a Vector

Critically, **SL-C is assessed independently per FR.** A single component can achieve SL3 on FR1 and SL2 on FR4. So a component's SL-C isn't a single number - it's a vector.

```
SL-C = [IAC:3, UC:2, SI:3, DC:2, RDF:2, TRE:2, RA:2]
```

Saying "this PLC is SL2" is imprecise. More precisely: "it has these values across each of the 7 axes." This vector concept is the starting point for [how to read a certificate](/en/blog/iec-62443-4-2-certification-myth/).

---

## Part 2 - Map of FR1-7

Now let's go through the seven Foundational Requirements one by one. The FRs decompose IACS security into **identity / authorization / integrity / confidentiality / network segmentation / detection & response / availability.** Every CR always takes the form "based on the determined SL-T, the component shall provide the capability to..." - the fact that SL-T is a prerequisite input is baked into the sentence structure itself.

### FR1 - Identification and Authentication Control (IAC)

**One-line summary: identify and authenticate every user before granting access.**

Here, "user" isn't just human. It includes software processes and machine-to-machine mutual authentication. CR 1.1-1.14 are defined in Clause 5.

Some key CRs:

- **CR 1.1 Human user identification and authentication** - mandatory at every human-accessible interface. RE(1) is unique identification; RE(2) is MFA.
- **CR 1.2 Software/device identification and authentication** - not required at SL1, required **starting at SL2**.
- **CR 1.5 Authenticator management** - supports initial authenticator provisioning, recognizes default authenticator changes. RE(1) protects authenticators using a **hardware security mechanism** (SL3-4).
- **CR 1.7 Password strength** - configurable strength based on international guidelines. REs add reuse prevention and expiration limits.
- **CR 1.10 Authenticator feedback** - masks authenticator information, like showing asterisks for password entry. **Does not expose the specific reason for authentication failure.**
- **CR 1.11 Unsuccessful login attempts** - denies access after a configured number of failures.

Here's an inversion distinctive to industrial security. **CR 1.11 stipulates that "for emergency operations systems, automatic lockout should be applied in a limited way to prevent DoS."** In IT, "lock the account after a failure, no exceptions" is the correct answer - but in an emergency, if an operator can't touch a controller because their account is locked, that itself becomes an incident. **Authentication must not interfere with essential functions** - this principle (CCSC 1) runs through all of FR1.

### FR2 - Use Control (UC)

**One-line summary: the step after authentication - only allow actions within the scope of permissions assigned to a verified user.**

If FR1 is "who are you," FR2 is "what can you do." Clause 6, CR 2.1-2.13.

- **CR 2.1 Authorization enforcement** - role-based permissions. RE(1) least privilege, RE(3) supervisor manual override (SL3), RE(4) **dual approval** for critical actions (SL4).
- **CR 2.8 Auditable events** - **mandatory across SL1-4.** Logs six categories (access control, request errors, control system events, backup/restore, configuration changes, audit log events). Each record includes a timestamp, source, category, type, event ID, and outcome.
- **CR 2.11 Timestamps** - RE(1) requires **synchronization with a system-wide time source** (SL2-4). Correlating logs across multiple components requires accurate timing.
- **CR 2.12 Non-repudiation** - proves a specific user performed a specific action.

Another industrial-security inversion. **CR 2.10 requires that essential services must not be interrupted even if audit processing fails** (hardware fault, storage exhaustion, etc.). In IT, "fail-secure" - stop when logging fails - is common, but in a control system, control must never stop because of logging. Losing control is more dangerous than losing logs.

### FR3 - System Integrity (SI)

**One-line summary: protect the component against unauthorized manipulation or modification - communications, software, configuration, and even physical hardware.**

Clause 7, CR 3.1-3.14. This is where industrial security's most distinctive requirements cluster.

- **CR 3.1 Communication integrity** - protects the integrity of transmitted information. RE(1) provides **origin authentication** for received information. An IACS-specific consideration: physical factors like vibration, EMI, and foreign material also affect communication integrity.
- **CR 3.4 Software and information integrity** - integrity checking. RE(1) provides **authenticity checking** via cryptographic hash, RE(2) provides **automatic notification** on unauthorized change.
- **CR 3.5 Input validation** - validates the syntax, length, and content of input from external interfaces. Prevents SQL injection, XSS, buffer overflows, and **protocol fuzzing**. (You can see why this requirement matters in practice with real fuzzing tests in the [Achilles Certification post](/en/blog/achilles-certification-anatomy/).)
- **CR 3.7 Error handling** - ensures error messages can't be exploited by an attacker. Doesn't distinguish "invalid username" from "invalid password" in its display.

The most distinctly IACS requirement is **CR 3.6, deterministic output.** A component connected to an automated process must **transition its output to a predefined safe state when it can no longer maintain normal operation.** Configurable state options include unpowered, hold, fixed, and dynamic. IT software can "just throw an exception and die on failure." A controller operating a physical actuator must not die - it must **fall into a known safe state.** Whether to leave a valve open, close it, or hold its current state is a physical safety decision the designer must make in advance.

### FR4 - Data Confidentiality (DC)

**One-line summary: prevent unauthorized disclosure of information, both in transit and at rest.**

Clause 8, CR 4.1-4.3. The smallest FR (3 requirements). This reflects the fact that confidentiality isn't the top priority in an IACS.

- **CR 4.1 Information confidentiality** - covers both at rest and in transit. Design principle: if a component supports configuring read permissions on some piece of information, that itself signals the information is sensitive, so the component must also provide the ability to protect its confidentiality.
- **CR 4.2 Information persistence** - deletes credentials, network configuration, and encryption keys upon decommissioning or service removal. Required **starting at SL2**. RE(1) prevents residual data in volatile shared memory, RE(2) verifies deletion.
- **CR 4.3 Use of cryptography** - **mandatory across SL1-4.** Only **internationally recognized algorithms** are used (AES, the SHA family, key management per NIST SP 800-57, implementation per FIPS 140-2 or ISO/IEC 19790). In other words: don't roll your own crypto.

### FR5 - Restricted Data Flow (RDF)

**One-line summary: segment the system into zones and conduits to block unnecessary data flows.**

CR 5.1-5.4. As noted earlier in the [certification post](/en/blog/iec-62443-4-2-certification-myth/), **FR5 is identical across SL1-SL4.** Network segmentation requirements don't increase as SL rises.

- **CR 5.1 Network segmentation** - identical at every SL. Logical segmentation (low cost, single-point-of-failure risk) and physical segmentation (added protection, high cost) are chosen based on the situation. Must be designed so that **even when the network is isolated during incident response, core services (DHCP, DNS, CA) remain available through redundancy.**
- **CR 5.2 Zone boundary protection / CR 5.3 General purpose person-to-person communication restrictions** - requirements **exclusive to network devices (NDR).**

The reason FR5 stays constant regardless of SL is that network segmentation isn't a matter of "how sophisticated," it's a matter of "whether or not." A boundary either exists or it doesn't.

### FR6 - Timely Response to Events (TRE)

**One-line summary: notify in a timely manner, collect evidence, and take corrective action when a security breach occurs.**

CR 6.1-6.2. The detection-and-response axis.

- **CR 6.1 Audit log accessibility** - at SL1-2, **manual access** (viewing on-screen, printouts) is sufficient. At SL3-4, RE(1) requires **programmatic access** - sending logs via an API or to a SIEM. Manual access doesn't scale to investigating a large-scale incident.
- **CR 6.2 Continuous monitoring** - required **starting at SL2** (not applicable at SL1). IDS/IPS, anti-malware, and network monitoring detect breaches in a timely manner.

An IACS caveat applies here too. **Monitoring tools (IDS/IPS/SIEM) must be strategically deployed so they don't negatively affect control system performance.** If security monitoring interferes with the control cycle, that defeats the purpose.

### FR7 - Resource Availability (RA)

**One-line summary: maintain essential functions even under DoS or failure conditions.**

CR 7.1-7.8. This is the pinnacle of IACS security, and where it diverges most sharply from IT security.

- **CR 7.1 Denial of service protection** - the core requirement, covered separately below.
- **CR 7.2 Resource management** - rate-limits traffic so that security functions (scanning, patching, antivirus) don't interfere with the control process.
- **CR 7.3 Control system backup** - RE(1) requires **verifying backup integrity before restoration** (SL2-4). The backup process must not interfere with normal operation.
- **CR 7.4 Control system recovery and reconstitution** - recovers to a **known secure state** after a failure (restoring security parameters, reinstalling patches, loading a safe backup).
- **CR 7.6 Network and security configuration settings** - SL3-4 requires RE(1), generating a current configuration report in **machine-readable format.**
- **CR 7.7 Least functionality** - restricts unnecessary functions, ports, protocols, and services. Disabled by default.
- **CR 7.8 Control system component inventory** - required **starting at SL2.**

**CR 7.1 most clearly reveals the philosophy of industrial security.** The requirement isn't "prevent DoS." It's **"maintain essential functions even if a DoS event results in degraded mode."**

```
SL 1 : maintain essential functions in degraded mode
SL 2-4 : + RE(1) manage communication load during a message flood
```

The difference is worth savoring. IT security aims to "block the attack and preserve the normal state." IACS security aims to **not let go of control, even if the attack can't be fully blocked.** When a power plant comes under a DoS attack, what matters isn't "did we block the attack" but "is turbine control still alive." Even if it falls into degraded mode, essential functions - the minimum functionality needed to maintain safety - must keep running. **"Don't block it" but "maintain it even as it degrades"** is the grammar of industrial security.

This idea is baked into the standard's own terminology. `degraded mode` is defined as "an operating mode that maintains essential functions even in the presence of a fault," and `essential function` is defined as "a function required to maintain HSE (health, safety, environment) and availability (whose loss results in loss of protection, loss of control, or loss of view)."

---

## Part 3 - Map of Component Types

Most of the CRs across FR1-7 apply **in common** to all four component types. But each type has its own constraints, adding type-specific requirements.

| Abbreviation | Type | Clause | Example Targets |
|------|------|--------|-----------|
| **SAR** | Software Application Requirement | 12 | SCADA, historians, configuration tools |
| **EDR** | Embedded Device Requirement | 13 | PLCs, RTUs, SIS controllers, DCS controllers |
| **HDR** | Host Device Requirement | 14 | Engineering workstations, HMI PCs |
| **NDR** | Network Device Requirement | 15 | Switches, firewalls, routers |

The character of each type:

- **SAR (software application)** - runs on top of a host or embedded device and has dependencies (databases, third-party libraries). Dedicated requirements: mobile code control (CR 2.4), malicious code protection (CR 3.2).
- **EDR (embedded device)** - a special-purpose device that **directly monitors and controls** an industrial process. Characterized by **limited storage, an embedded OS/firmware, and a real-time scheduler.** Because of limited resources, some CRs are met via **compensating countermeasures**, and authentication must not interfere with manipulation during emergency operations. Dedicated requirements: physical tampering resistance and detection (CR 3.11), boot integrity (CR 3.14), root-of-trust provisioning (CR 3.12-3.13).
- **HDR (host device)** - a general-purpose Windows/Linux-based device. Has a filesystem and a full HMI but **no real-time scheduler.** Dedicated requirements: malicious code protection (CR 3.2), hardware-based security features.
- **NDR (network device)** - facilitates and restricts data flow but doesn't directly participate in the process. No HMI, no real-time scheduler. Dedicated requirements: wireless access management (CR 1.6), support for network segmentation (CR 5.2/5.3 of FR5).

**A single component can qualify as more than one type.** For example, a PLC with a built-in HMI must satisfy both EDR and SAR requirements. This is why the [certification post](/en/blog/iec-62443-4-2-certification-myth/) says "the type with RA != 0 is the actual component type" - among a certificate's SAR/EDR/HDR/NDR scores, whichever is nonzero is the product's actual identity.

EDR's characteristic of "limited resources -> reliance on compensating countermeasures" is especially important in practice. A PLC doesn't have the ample memory and general-purpose OS of an IT server. So it's difficult to satisfy every CR on its own, and some are met through system integration, in the style of "this requirement is handled by an upstream firewall." Explicitly documenting, per CR, which parts were met through compensating measures becomes the core of the assessment.

---

## Summary - Map in Hand

Let's gather back up the skeleton to hold onto when encountering IEC 62443-4-2 for the first time.

- **The standard is divided by audience** - 4-2 is the standard for product suppliers (those who build components). The dividing axis is role, not difficulty.
- **SL has four faces** - 4-2 addresses only SL-C (capability). SL-T (target) is determined first, and even SL 0 means the opposite thing depending on the type.
- **Security is a vector of 7 axes (FRs)** - identity (FR1), authorization (FR2), integrity (FR3), confidentiality (FR4), network segmentation (FR5), detection & response (FR6), availability (FR7). Each axis is assessed independently, and the slope of increasing SL differs across them.
- **The grammar is "maintain," not "block"** - CR 3.6's deterministic output, CR 7.1's maintenance of degraded mode, "authentication must not interfere with emergency operations" - all stem from an IACS-specific priority that places control continuity ahead of confidentiality or blocking.
- **Component type is identity** - SAR/EDR/HDR/NDR. Type-specific requirements sit on top of common CRs, and a single product can qualify as more than one type.

With this map in hand, everything else falls into place. How these requirements show up as numbers on an actual certificate is covered in [Why "IEC 62443-4-2 Certified" Means Nothing on Its Own](/en/blog/iec-62443-4-2-certification-myth/); how this standard gains legal force through the EU CRA is covered in [What the CRA Changes in 2027](/en/blog/cyber-resilience-act-2027/); and how these requirements are actually verified through packet-level fuzzing tests is covered in [Dissecting Achilles Certification](/en/blog/achilles-certification-anatomy/).
