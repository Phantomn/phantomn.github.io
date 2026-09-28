---
title: "Reading the MFDS Medical Device Cybersecurity Guideline — Guidance No. 0995-05"
date: 2026-07-30T00:00:00.000Z
excerpt: >-
  An explanation of the MFDS medical device cybersecurity approval/review guideline
  (Guidance No. 0995-05, 2025.01.10) on the basis of IEC 62443-4-2. It organizes,
  from the perspective of regulatory practitioners and developers, the structure of
  the 35 requirements across 6 categories, the mapping to the IEC 62443 FR/CR system,
  the approval submission requirements, and the transition schedule before and after revision.
tags:
  - medical-device
  - iec-62443
  - mfds
  - medical-device-security
  - regulation
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

To obtain domestic approval for a medical device that has a communication path, from 2025 onward you must satisfy **35 cybersecurity requirements based on IEC 62443-4-2** and submit the verification materials to the MFDS. The document that holds those criteria is the **MFDS "Medical Device Cybersecurity Approval/Review Guideline" (Guidance No. 0995-05, 2025.01.10).**

This article explains that guideline structurally from the perspective of regulatory practitioners and medical device developers. The core is singular: **domestic medical device cybersecurity regulation now stands on the FR/CR system of IEC 62443-4-2, the international standard for Industrial Automation and Control Systems (IACS).** Therefore, the best way to read this guideline is to map the domestic regulation while reading it through the lens of IEC 62443.

---

## 1. The Status of the Document: What It Requires, and of Whom

First, we pin down exactly what the document is.

| Item | Content |
|------|------|
| Document number | Guidance No. 0995-05 |
| Issuing body | MFDS, National Institute of Food and Drug Safety Evaluation, Medical Device Review Department, Digital Health Regulatory Support Division |
| Issue date | January 10, 2025 (v05) |
| Standard basis | IEC 62443-4-2 / KS X IEC 62443-4-2 |
| Related statutes | Medical Device Approval, Notification, and Review Regulation Article 29, Item 8; Digital Medical Products Act Enforcement Rule Article 19 |

There are two things that must be noted here.

**First, this document is a legally non-binding "guidance for petitioners."** Although the expression "shall ~" is repeated throughout the text, the document itself is not law. This must not be misunderstood. That it has no legal force does not mean "it can be ignored," but rather that **this guidance operates as the de facto standard in approval/review practice.** Reviewers demand materials on the basis of this guidance, and manufacturers submit materials using this guidance's requirements checklist. The legal form is guidance, but the practical enforcement power is considerable. In particular, within the "Digital Medical Products Act" system discussed below, revised requirements apply immediately to digital medical devices, so the guidance's "recommendations" solidify into substantive requirements.

**Second, the scope is "all medical devices that have a communication path."** Whether wired or wireless, if there is even one communication interface, it becomes subject.

- **Included communication methods**: Ethernet, Wi-Fi, Bluetooth, USB, RS-232, RF, etc.
- **Included embedded types**: firmware/PLC-equipped devices, medical IT network-connected devices, Software as a Medical Device (SaMD)
- **Excluded**: closed-type medical devices with no communication path whatsoever

In other words, even having a single USB port brings a device within range of this guideline. Because few modern medical devices have entirely no communication path, in practice most new medical devices must pass through this requirements system.

---

## 2. Why IEC 62443-4-2: The Standard Shift of the Regulation

The most important change in this guideline is the **shift in the standard basis.** Looking at the revision history, the trajectory of this shift is distinct.

| Version | Date | Key Change |
|------|------|-----------|
| v01 | 2019.11.28 | Initial enactment |
| v02 | 2022.01.21 | IMDRF principles applied |
| v03 | 2023.07.13 | Submission materials clarified |
| **v04** | 2024.11.27 | **Shift to IEC 62443-4-2** |
| v05 | 2025.01.10 | Requirement effective timing clarified |

In other words, at the pivot of end-2024 (v04), the backbone of domestic medical device cybersecurity regulation changed from the **general principles of IMDRF (International Medical Device Regulators Forum)** to the **concrete technical standard IEC 62443-4-2.**

The meaning of this shift is large. IMDRF principles were **principle-level descriptions** such as "authentication shall be performed," "integrity shall be ensured." By contrast, IEC 62443-4-2 is a **catalog of concrete technical security requirements** for IACS (Industrial Automation and Control Systems) components. It transplants the security controls required of the control components of critical infrastructure such as nuclear power, power generation, and manufacturing into medical devices — another safety-critical embedded domain.

There is a reason this transplant is natural. **Medical devices and industrial control equipment are, from a security perspective, the same species.** Both (1) act directly on the physical world, (2) prioritize safety above all, (3) are embedded systems with a long lifespan and limited computing resources, and (4) value availability as much as confidentiality. Importing the security framework of IT systems (e.g., general information security controls) as-is misses these characteristics. IEC 62443 was created for these characteristics in the first place, so the mapping is accurate.

### The FR/CR System of IEC 62443

To understand IEC 62443-4-2, you must know its backbone, the **7 Foundational Requirements (FR).** IEC 62443 classifies all security controls under the following 7 FRs.

| FR | Name | What It Covers |
|----|------|-----------|
| FR 1 | Identification and Authentication Control (IAC) | Verifying who a user, device, or process is |
| FR 2 | Use Control (UC) | What to permit to an authenticated subject |
| FR 3 | System Integrity (SI) | Preventing tampering of data, communications, and firmware |
| FR 4 | Data Confidentiality (DC) | Preventing exposure of sensitive information |
| FR 5 | Restricted Data Flow (RDF) | Network segmentation and flow control |
| FR 6 | Timely Response to Events (TRE) | Event detection, logging, and response |
| FR 7 | Resource Availability (RA) | DoS defense, backup, and recovery |

Under each FR there are again Component Requirements (CR). The 35 requirements of the MFDS guideline are a reorganization of this FR/CR system into the medical device context. However, the guideline does not keep FR 5 (Restricted Data Flow) as an independent category, but absorbs its intent into the RA (Resource Availability) and communication integrity items. That is why the guideline has 6 categories.

---

## 3. The Structure of the 35 Requirements: 6 Categories

The requirements system at the core of the guideline consists of **6 categories, 35 items in total.**

| Category | Abbrev. | Item Count | Corresponding IEC 62443 FR |
|----------|------|---------|-------------------|
| Identification and Authentication | IA | 8 | FR 1 (IAC) |
| Use Control | UC | 7 | FR 2 (UC) + part of FR 6 |
| System Integrity | SI | 11 | FR 3 (SI) |
| Data Confidentiality | DC | 3 | FR 4 (DC) |
| Timely Response to Events | TRE | 1 | FR 6 (TRE) |
| Resource Availability | RA | 5 | FR 7 (RA) |

The distribution of item counts per category itself reveals the regulation's center of gravity. **More than half is concentrated in System Integrity (SI, 11) and Identification/Authentication (IA, 8).** This reflects that the top priority of medical device security lies in "the device has not been tampered with" and "only legitimate subjects access it." By contrast, Data Confidentiality (DC) is few at 3, which is not because patient privacy is unimportant in medical devices, but **because availability and integrity are more directly tied to life than confidentiality is.** A device malfunctioning or stopping is more fatal to the patient than data being leaked. This priority is inverted from the CIA order of general IT security, and aligns exactly with the philosophy of IEC 62443.

Now we explain each category from the perspective of IEC 62443.

### 3.1 Identification and Authentication (IA) — 8 items / FR 1

The category that handles "who accesses." It is the medical device version of FR 1 (Identification and Authentication Control).

- **IA-01 User identification/authentication** — Identify and authenticate authorized users (people, devices, processes, services). Excluded if there is no user access interface.
- **IA-02 Account management** — Account creation, management, and deletion. Consider the risk when shared accounts are used.
- **IA-03 Identifier management** — A unique identifier per account.
- **IA-04 Credential management** — **No hardcoded passwords**, a mandatory function to change default account/password, encrypted storage of credentials.
- **IA-05 Password strength** — A function to set minimum length and complexity policy.
- **IA-06 Credential feedback** — No plaintext exposure when entering a password (masking).
- **IA-07 Limit on consecutive login failures** — Lockout/delay after N failures, configurable.
- **IA-08 System use notification** — Display an unauthorized-access warning before login.

Here, **IA-04 (no hardcoded passwords, changing default credentials)** deserves particular attention. The most common and fatal vulnerability of embedded medical devices is precisely hardcoded credentials and unchangeable default passwords. This item reflects IEC 62443-4-2's CR 1.5 (credential management) directly, codifying the frontline of embedded device security as a regulatory requirement.

### 3.2 Use Control (UC) — 7 items / FR 2 + part of FR 6

This handles "what an authenticated subject can do" and "how those actions are recorded." Audit logging (part of FR 6) is combined into FR 2 (Use Control).

- **UC-01 Authorization** — Role-Based Access Control (RBAC) based on the **least privilege principle**, with separation of privileges by role.
- **UC-02 Mobile code control** — Verify authenticity before executing mobile code, allow-list based.
- **UC-03 Session lock** — Automatic lock and re-authentication after a period of inactivity.
- **UC-04 Audit record generation** — Record access control, request error, device event, backup/recovery, configuration change, and audit log events. Include timestamp, source, category, type, event ID, and result.
- **UC-05 Response to audit processing failure** — Prevent loss of essential functions even when audit storage capacity is exceeded.
- **UC-06 Timestamp** — Date and time on audit records, with **NTP synchronization recommended**.
- **UC-07 Non-repudiation** — Include user identification information for specific actions.

UC-01's **least privilege** is the principle that runs through this entire category. Brought in directly from the IEC 62443 concept, it requires implementing the principle of "grant only the minimum necessary privileges" via role-based access control. The audit logging requirements of UC-04~UC-07 are the foundation of post-incident response and forensics; in particular, UC-06's timestamp integrity and UC-07's non-repudiation are conditions for logs to be trusted as legal evidence.

### 3.3 System Integrity (SI) — 11 items / FR 3

The category with the most items, and the heart of medical device security. It guarantees "the device and data have not been tampered with." It corresponds to FR 3 (System Integrity).

- **SI-01 Communication integrity** — Standard cryptographic protocols (e.g., TLS 1.2/1.3), integrity protection in transit.
- **SI-02 Malware protection** — Block ingress or verify. SaMD also applies to external services/apps.
- **SI-03 Security function verification** — Procedure to verify security function operation (EICAR test, IDS rule verification, etc.).
- **SI-04 Software/information integrity check** — Cryptographic hash-based integrity checks on stored data (settings, firmware, configuration).
- **SI-05 Input validation** — Validate the syntax, length, and content of all inputs on external interfaces. **Out-of-range, SQL injection, XSS, buffer overflow, and malicious packet** validation are mandatory.
- **SI-06 Predetermined state output on error** — Output to a predefined **Fail-Safe state** when normal operation is impossible.
- **SI-07 Error handling** — Do not include information usable by an attacker (detailed authentication failure cause, etc.) in error messages.
- **SI-08 Update** — Patch without affecting essential functions.
- **SI-09 Update authenticity/integrity verification** — **Code signing and hash verification** before installation, blocking files with abnormal signatures.
- **SI-10 Physical tamper protection** — Physical locks, security screws, and encapsulation on unnecessary external interfaces. **SaMD excluded.**
- **SI-11 Boot process integrity** — Verify the integrity of firmware, software, and configuration at boot (Secure Boot). **SaMD excluded.**

These 11 cover almost the entire spectrum of IEC 62443-4-2 FR 3. We note a few practical points.

**SI-05 (input validation)** takes direct aim at the root of software vulnerabilities. Buffer overflow and injection-family vulnerabilities all arise from processing untrusted input without validation. This item elevates secure coding at the development stage to a regulatory requirement.

**SI-06 (Fail-Safe)** is a requirement peculiar to medical devices. An IT system can just stop on error, but a medical device that acts on the physical world needs the concept of a **"safe failure."** On malfunction it must converge not to an arbitrary state but to a predefined state that does no harm to the patient. This is the point where cybersecurity and functional safety meet.

**SI-09 (update signature verification) and SI-11 (Secure Boot)** are the core of supply chain and firmware attack defense. An update channel without signature verification becomes a path for injecting malicious firmware, and booting without Secure Boot becomes a breeding ground for bootkits. However, these two items and SI-10 (physical tamper protection) are **excluded for SaMD**, because SaMD is pure software not bound to specific hardware, so the concepts of physical tampering and a boot chain do not hold. This exception rule shows the requirements are designed to accurately reflect the characteristics of device types.

### 3.4 Data Confidentiality (DC) — 3 items / FR 4

Prevents the exposure of sensitive information. The item count is small, but each is dense.

- **DC-01 Information confidentiality** — Protect the confidentiality of stored and transmitted information.
- **DC-02 De-identification of health/medical information** — De-identify (pseudonymize) patient-identifiable information. Only approved users can access the identification key. Excluded if no personally identifiable information is stored.
- **DC-03 Secure encryption** — Recommended algorithms of **112-bit or higher security strength**. Passwords are one-way hashes including Salt.

The concreteness of DC-03 stands out. Following KISA's "Guide to the Use of Cryptographic Algorithms and Key Lengths," the guideline presents a **concrete list of recommended algorithms.**

- **Symmetric key**: SEED, HIGHT, ARIA, LEA, AES (all 128/192/256-bit)
- **Hash**: SHA-224/256/384/512, SHA3 family, LSH family
- **Public key**: RSA-PSS, ECDSA, EC-KCDSA
- **Near-prohibited**: SHA-1 and HAS-160, at 80-bit strength, are permitted only in a restricted manner for message authentication, key derivation, and random number generation

Here, a distinctive feature is that domestic standard ciphers (SEED, ARIA, LEA, HIGHT, LSH, HAS-160) are recommended alongside international standards (AES, SHA). As it is a domestic regulation, it includes domestic ciphers but controls algorithm strength via the quantitative criterion of "112-bit or higher security strength." DC-02's de-identification connects to the concept of health/medical information in the "Framework Act on Health and Medical Services," forming an interface with personal data protection regulation.

### 3.5 Timely Response to Events (TRE) — 1 item / FR 6

- **TRE-01 Restricting unauthorized access to audit logs** — Only authorized users have **read-only** access to audit logs. **There must be no function to modify audit records.**

Though it is a single item, its weight is large. The integrity of audit logs is the last bastion of post-incident forensics. The requirement that "there must be no modification function" means the logs must be append-only, and if this is not observed, all of the audit logging in UC-04~UC-07 becomes meaningless. If you keep a log but an attacker can erase it, it is not a log.

### 3.6 Resource Availability (RA) — 5 items / FR 7

Guarantees "the device operates when needed." In medical devices, availability is patient safety itself. It corresponds to FR 7.

- **RA-01 DoS prevention** — Maintain essential functions even during DoS. Devices doing real-time control on public networks are obligated to establish DDoS countermeasures.
- **RA-02 Backup** — A backup function is mandatory, without affecting normal operation. Encrypt sensitive data within backups.
- **RA-03 Recovery/reconstitution** — Recover to a safe state after interruption or failure, including reinstallation of security patches.
- **RA-04 Network/security configuration** — Specify the configuration interface in the manual, monitor and control configuration changes.
- **RA-05 Disable unnecessary functions** — **Disable unnecessary ports, protocols, and services by default**, and verify with a port scanning tool (Zenmap, etc.).

RA-05 regulates the principle of attack surface reduction. Unused ports and services are merely attack entry points, so they should be turned off by default. The concrete verification method of "verify with a port scanning tool" is striking — it does not merely require but also specifies how to confirm. RA-01's "maintain essential functions" meshes with SI-06's Fail-Safe, running through the medical device safety philosophy that even under attack the minimum safety functions must not die.

---

## 4. The Judgment Axes for Applying Requirements: Not All-Without-Exception

It is not that all 35 requirements are applied unconditionally. The guideline has you **judge the applicability of each item by synthesizing three axes.** This "tailoring" concept is a risk-based variation of IEC 62443's Security Level concept.

**① Severity**

| Grade | Meaning |
|------|------|
| High (major) | A breach may cause serious injury, death, or permanent disability |
| Moderate | Temporary/minor injury, medical intervention possibly needed |
| Low (minor) | Temporary discomfort, reversible |

**② Communication method** — Wired (USB, RS-232, LAN, etc.) vs. wireless (Wi-Fi, BT, NFC, RF). Wireless is easier to access remotely, so its risk is higher.

**③ Environment of use**

| Category | Characteristics |
|------|------|
| Inside a hospital | Closed network, third-party access difficult |
| Outside a hospital | Personal device, third-party access easy |
| Public network | Internet-connected, no spatial/temporal constraints |

The combination of these three axes determines the risk level, and the intensity of requirement application is adjusted accordingly. For example, a device that connects to a public network via wireless communication and has "High" severity must apply almost all requirements strongly, whereas a wired, low-severity device used only within a hospital's closed network may relax or exclude some items together with a risk management rationale.

To keep this judgment from being arbitrary, the guideline nails down **three common principles for conducting testing.**

1. **Basic safety first** — Security functions must not impair the device's basic safety and essential performance.
2. **Use of higher entities permitted** — If the device itself cannot provide a security function, it can be designed to use the security function of a higher system (the hospital IT network). But submission of an appropriateness/validity rationale is mandatory.
3. **Duty to maintain essential functions** — Even if some functions are lost to an attack, **essential functions must be maintained.**

The second principle (use of higher entities) is very important in practice. Reflecting IEC 62443's "system vs. component" perspective, it lets an individual medical device (component) not bear all security alone but leverage security controls at the network (system) level. This provides realistic breathing room for embedded medical devices with limited computing resources.

---

## 5. The Risk Management Process: Integrating Cybersecurity Into Safety Management

The guideline integrates cybersecurity not as an independent activity but as **part of medical device risk management (ISO 14971).** It is presented as a 6-stage cyclical process.

```
Risk analysis → Risk evaluation → Risk control → Residual risk acceptability assessment → Risk management report → Post-production information management
```

- **Risk analysis**: Identify hazards to the patient from destruction of availability, confidentiality, and integrity; assess impact and probability of occurrence.
- **Risk evaluation**: Decide whether risk reduction is needed against the acceptance criteria of the risk management plan.
- **Risk control**: Select and implement control measures.
- **Residual risk**: Assess the acceptability of individual and overall residual risks.
- **Risk management report**: Record the entire process.
- **Post-production management**: Continuously monitor new risks and changes in risk; reflect customer feedback.

This structure matters because it defines cybersecurity as **a whole-life-cycle activity, not a one-time certification.** In particular, the final "post-market" stage imposes a continuing obligation to respond to new vulnerabilities discovered after release. Because vulnerabilities are newly discovered every day, the regulation acknowledges the reality that security at the time of release is not eternal security.

---

## 6. Approval/Review Submission Materials: What Must Be Submitted

To obtain approval for a medical device with a communication path, the following materials must be **submitted mandatorily.**

| Material | Content |
|------|------|
| Cybersecurity requirements checklist | Communication technology, environment of use, whether a public network is used + applicability, proof method, and document number **for each of the 35 items** |
| Cybersecurity risk management document | Hazard identification across the whole life cycle + results of risk analysis and mitigation measures. Includes rationale when requirements are excluded/modified |
| Software verification/validation materials | Verification of risk control measures; test procedures, results, and retest results |
| Performance test report | Materials issued by an MFDS-designated testing institution or an accredited institution such as **KISA IoT Security Certification** |

The key is that **the checklist requires "applicability, proof method, and document number" for each of the 35 items.** For each item the manufacturer must state (a) whether it is applied, (b) if applied, how it is proven, and (c) what the supporting document is. To exclude any item, the manufacturer must prove the validity of that exclusion with the risk management document. In other words, **you cannot simply pass over an item as "not applicable to our device"; you must argue in documentation why it is not applicable.**

Also, the fact that **KISA IoT Security Certification** is accepted as a performance test report is important in practice. Instead of undergoing a separate cybersecurity performance test from scratch, there is an open path to leverage KISA's IoT security certification.

**Re-approval on change**: If the communication method, OS, or communication purpose is changed or added, change approval, certification, or notification is required. However, if you submit materials (design documents, etc.) proving the change has no impact on cybersecurity, additional materials are exempted.

---

## 7. Pre/Post-Revision Mapping and Transition Schedule

Along with the shift to IEC 62443-4-2, the correspondence between the pre-revision (IMDRF 2020 basis, parts of v01~v04) and post-revision (v05) requirements is provided as an appendix. The main mappings are as follows.

| Pre-Revision Item | Post-Revision Mapping |
|------------|------------|
| Communication configuration | RA-04, RA-05 |
| Access control and authentication | UC-01~UC-03, SI-01 |
| Confidentiality/integrity of data transmission/storage | DC-01~DC-03 |
| System log recording | UC-04~UC-07, TRE-01 |
| Integrity verification of critical files | SI-03, SI-04, SI-11 |
| User authentication management | IA-01~IA-07, UC-01 |
| Firmware/SW update authorization | SI-08 |
| Update integrity assurance | SI-09 |
| DDoS attack defense | RA-01 |

This mapping table serves as a bridge for manufacturers who were approved on, or are preparing under, the existing IMDRF basis to switch to the new system. It shows that what used to be handled as a single item, "user authentication management," is now unfolded into the granular requirements of IA-01~IA-07. One can see that the transition is itself a refinement of the requirements.

The **transition schedule** is as follows.

- **Until 2025.6.30**: Pre-revision (IMDRF-based) requirements temporarily permitted.
- **After 2025.1.24**: **Digital medical devices** under the "Digital Medical Products Act" **have the revised requirements (v05) applied immediately.**

In other words, general medical devices had a grace period until the first half of 2025, but digital medical devices had the new system applied immediately from early 2025. Digital medical devices have been placed at the forefront of regulation.

**An additional axis of AI security**: The guideline mentions that the **artificial intelligence security** required by Article 14 of the "Digital Medical Products Act" and the "Digital Medical Device Electronic Infringement Security Guidelines" should be added to the requirements of Table 2, or that appropriate items should be selected for **additional verification.** However, since separate criteria for this part are not yet finalized, one must check the latest official notices. This is a passage foreshadowing that security requirements for AI-equipped medical devices (AI/ML-based diagnostic software, etc.) will be stacked separately on top of this guideline.

---

## 8. Summary: How to Read This Guideline

For developers and regulatory practitioners, we compress the core.

**First, this is the medical device profile of IEC 62443-4-2.** It transplants the FR/CR system of the international industrial control security standard into the medical device context, so if you are familiar with IEC 62443 you can understand it quickly by mapping. Conversely, studying this guideline will let you learn the core skeleton of IEC 62443 at the same time.

**Second, the center of gravity is on integrity (SI, 11) and authentication (IA, 8).** This is because device tampering and unauthorized access are more directly tied to patient safety than data leakage. This inverted CIA order, in which availability and integrity precede confidentiality, is the identity of medical device security.

**Third, it is not that you do all 35 unconditionally, but that you tailor risk-based.** You adjust application intensity by the three axes of severity, communication method, and environment of use, but for each item excluded you must argue a rationale with the risk management document. Proving "not applicable" in documentation too is the core burden of this regulation.

**Fourth, cybersecurity is not a one-time thing but a life cycle activity.** A continuing duty to respond is imposed via post-market management, not just pre-release approval. And an additional verification axis is foreshadowed for AI-equipped devices.

**Fifth, the legal form of the document is "guidance," but its practical enforcement power is considerable.** In particular, digital medical devices have the revised requirements applied immediately from 2025.1.24, so developers of new medical devices must reflect these 35 requirements from the earliest design stage. Approaching cybersecurity as a bolt-on to be attached later will get you stuck at the approval stage — as IEC 62443-4-1 (secure product development life cycle) requires, security must be in from the very start of design.

As long as medical devices continue to evolve toward being more connected, more software-driven, and AI-equipped, the cybersecurity requirements this guideline defines will expand. Guidance No. 0995-05 is both the current coordinate of that evolution and a milestone signaling that domestic medical device security regulation has entered the orbit of the international standard IEC 62443.
