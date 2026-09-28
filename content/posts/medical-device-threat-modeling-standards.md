---
title: "Medical Device Threat Modeling — The Relationship Between ISO 14971, IEC 62304, and IEC 62443"
date: 2026-07-29T00:00:00.000Z
excerpt: >-
  A defender's explanation of how the three international standards that govern
  the safety and cybersecurity of medical device software — ISO 14971, IEC 62304,
  and IEC 62443 — each own a different axis and where they overlap.
tags:
  - medical-device-security
  - threat-modeling
  - iso14971
  - iec62304
  - iec62443
  - risk-management
  - regulatory-standards
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Summary

**The three standards that govern medical device software do not compete. They divide up different axes.** ISO 14971 owns the **framework** of risk management, IEC 62304 owns the **process** of the software life cycle, and IEC 62443 owns the **cybersecurity** of industrial control and connected systems. The point practitioners most often find confusing is the area where these three overlap — especially where "Safety" and "Security" meet.

This article organizes the relationship between the three standards from a purely explanatory perspective. It does not deal with any specific product, company, or actual assessment result, and the risk matrix examples are **composed directly with fictional numbers** to aid understanding. The goal is singular — to let a defender grasp at a glance what question each of the three standards answers and where they join hands.

Summed up in one sentence: **ISO 14971 builds the framework of "how do we handle risk," IEC 62304 then defines "how do we build software within that framework," and IEC 62443 adds "how do we protect it in a connected environment."**

---

## 1. The Three Axes — What Is Different

First, we distinguish the fundamental question each standard answers.

| Standard | Formal Name (Overview) | Axis Owned | Core Question |
|------|-----------------|---------|-----------|
| ISO 14971 | Application of risk management to medical devices | Risk management framework | How do we identify, evaluate, control, and monitor risk? |
| IEC 62304 | Medical device software life cycle processes | Software development process | Through what stages do we safely develop and maintain software? |
| IEC 62443 | Cybersecurity for industrial automation and control systems | Cybersecurity (system/network) | How do we defend against threats in a connected environment? |

Expressing the difference in character of the three standards as a metaphor:

- **ISO 14971 is the constitution.** It sets the top-level principles and processes for handling risk. Other safety-related standards reference this framework.
- **IEC 62304 is the construction process code.** It defines in what order the structure that is software should be designed, built, inspected, and maintained.
- **IEC 62443 is the security guard system.** It defines how to block external threats when the finished system is connected to a network and operated.

The core of this metaphor is that **the three sit at different layers.** One does not replace another. In actual medical device development, the three standards are applied simultaneously, referencing and complementing one another.

---

## 2. ISO 14971 — The Framework of Risk Management

### Its Position as a Framework

ISO 14971 provides the **skeleton** of risk management across the entire medical device life cycle. Other safety standards lay their own detailed requirements on top of this skeleton. Standards such as software guidance (IEC/TR 80002-1), cybersecurity risk principles (AAMI TIR57), and network risk management (IEC 80001-1) all exist as forms that apply ISO 14971's process to their own domain.

Diagrammed, the relationship looks like this.

```
ISO 14971 (risk management framework)
    ├── IEC 62304 (software development process)
    ├── IEC/TR 80002-1 (software-specific risk management guidance)
    ├── Cybersecurity risk principles (e.g., AAMI TIR57)
    └── Network risk management (e.g., IEC 80001-1)
```

In other words, ISO 14971 is **the common language that all risk management activities reference**. To understand the relationship among the three standards, you must first know precisely the terms defined here.

### Core Terms — Different From Everyday Language

The terms in risk management standards have legal and technical meanings that differ from their everyday meanings. Here we organize the core terms that defenders most easily misunderstand.

| Term | Definition in the Standard |
|------|-------------|
| **Harm** | Injury or damage to the health of people, or to property or the environment |
| **Hazard** | Potential source of harm |
| **Hazardous Situation** | A circumstance in which people, property, or the environment are exposed to one or more hazards |
| **Risk** | The combination of the **probability** of occurrence of harm and the **severity** of that harm |
| **Residual Risk** | Risk remaining after risk control measures have been implemented |

The most frequently misunderstood is "Risk." In the standard, risk is not simply "the possibility that something bad will happen." It is **the combination of probability and severity.** Even if probability is low, if severity is extreme, the risk is evaluated as high, and the reverse holds too. This definition determines the two axes of the risk matrix that appears later.

Another important distinction is **Safety versus Security.** In the standard, safety means "freedom from unacceptable risk." Security is defined in a separate family of standards as "the state in which life, health, property, and the environment are not put at risk under defined conditions." The relationship between these two is the crux of where the three standards overlap, and is covered in Section 4.

### Risk Management Process Terms

The process stages ISO 14971 defines also have precise names. They are often used interchangeably in practice, but the standard distinguishes them.

| Term | Meaning in the Standard |
|------|-------------|
| **Risk Analysis** | The systematic use of information to identify hazards and estimate risk |
| **Risk Estimation** | The process of assigning values to the probability of occurrence and the severity of harm |
| **Risk Evaluation** | Comparing estimated risk against risk criteria to decide acceptability |
| **Risk Assessment** | The overall process encompassing risk analysis + risk evaluation |
| **Risk Control** | The decisions and measures to reduce risk to, or maintain it at, a specified level |
| **Risk Management** | The systematic application of policy, procedures, and practice to all of the above activities |

Understood as a picture, this hierarchy is: **Risk Assessment = Risk Analysis (hazard identification + risk estimation) + Risk Evaluation**, and **Risk Management = Risk Assessment + Risk Control + monitoring.** If you miss this containment relationship when reading the standard, you will misjudge the scope of the requirements.

### Fictional Risk Matrix Example

ISO 14971 presents the principle that risk = probability × severity, but leaves the concrete grade definitions to the organization. Below is a **fictional example composed arbitrarily to aid understanding.** An actual organization must define these grades to fit its own clinical context.

**Severity Grades (Fictional)**

| Grade | Name | Fictional Meaning |
|------|------|------------|
| S1 | Negligible | Discomfort, no clinical intervention needed |
| S2 | Minor | Temporary damage, minor intervention |
| S3 | Serious | Recoverable damage, medical intervention needed |
| S4 | Critical | Permanent damage or life-threatening |

**Probability of Occurrence Grades (Fictional)**

| Grade | Name | Fictional Frequency Expression |
|------|------|-----------------|
| P1 | Improbable | Almost never occurs |
| P2 | Remote | Rarely occurs |
| P3 | Occasional | Occurs from time to time |
| P4 | Frequent | Occurs often |

**Risk Acceptance Matrix (Fictional)**

|  | P1 (Improbable) | P2 (Remote) | P3 (Occasional) | P4 (Frequent) |
|--|:--:|:--:|:--:|:--:|
| **S4 (Critical)** | Medium | High | High | High |
| **S3 (Serious)** | Low | Medium | High | High |
| **S2 (Minor)** | Low | Low | Medium | Medium |
| **S1 (Negligible)** | Low | Low | Low | Medium |

In this fictional matrix, combinations judged "High" must be brought down to an acceptable level through additional risk control measures. What remains after the measures is residual risk, and final acceptability is judged according to criteria set by the organization. **To stress again, the numbers and grades above are illustrative fictional values.** An actual matrix is defined directly by the organization according to the device's intended use and clinical context.

---

## 3. IEC 62304 — The Software Life Cycle Process

### Its Relationship With ISO 14971

IEC 62304 defines the **development and maintenance life cycle** of medical device software. But this standard does not stand independently. **It references ISO 14971's risk management at almost every stage.** The two standards are implemented in parallel, and in fact, regulatory review requires documentation mapping which risk management stage of ISO 14971 each process stage of IEC 62304 connects to.

### Software Safety Classes A/B/C

One of IEC 62304's central concepts is the **software safety class.** Software (or an item of it) is divided into three classes according to the severity of harm that could result from its failure. The class distinctions below summarize the concepts of the standard.

| Class | Concept | Required Rigor |
|------|------|------------|
| Class A | Failure does not lead to harm, or the risk is acceptable | Basic |
| Class B | Failure can lead to harm, but not serious | Intermediate |
| Class C | Failure can lead to death or serious injury | Highest |

The higher the class, the more processes are required. For example, additional activities required only in Class C include specification of development standards, methods, and tools (5.1.4), separate identification of software items for safety control (5.3.5), detailed design and unit interface verification (5.4.2~3), and additional unit acceptance criteria (5.5.4). Up through Class B, the full life cycle management, requirements, architecture, unit/integration/system testing, and regression testing are implemented, but the Class C-only items above are excluded.

From a defender's perspective, the meaning of this class system is clear. **The severity of harm determines the rigor of the process.** Safety class assignment is not arbitrary; it is derived from the results of ISO 14971's risk analysis. In other words, the IEC 62304 classes in Section 3 are rooted in the ISO 14971 severity assessment of Section 2 — this is where the two standards mesh.

### Mapping Risk Activities Across Life Cycle Stages

ISO 14971 risk management is cross-applied across all stages of the IEC 62304 software life cycle. Below is a summary of that mapping (✓ = a risk activity is defined at that stage).

| IEC 62304 Process | Risk Analysis | Risk Evaluation | Risk Control | Residual Risk | Review | Post-Production |
|-------------------|:-:|:-:|:-:|:-:|:-:|:-:|
| **5.1 Planning** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5.2 Requirements Analysis | ✓ | ✓ | ✓ | – | – | – |
| 5.3 Architectural Design | ✓ | ✓ | ✓ | – | – | – |
| 5.4 Detailed Design | ✓ | ✓ | ✓ | – | – | – |
| 5.5 Unit Implementation·Verification | ✓ | ✓ | ✓ | – | – | – |
| 5.6 Integration Testing | – | – | ✓ | – | – | – |
| 5.7 System Testing | – | – | ✓ | – | – | – |
| 5.8 Release | ✓ | – | ✓ | ✓ | – | – |
| **6.3 Change Implementation (Maintenance)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

There are two points worth noting in this table.

**First, the planning stage (5.1) and the maintenance change stage (6.3) span all of the risk management columns.** The reason maintenance is marked as broadly as development is important — **because a change can undermine existing risk controls.** An already-verified safety control can be nullified by a single line of code change, so maintenance changes require the same level of risk management as development. From a defender's perspective, this is the regulatory expression of the principle that "a patch can create a new vulnerability."

**Second, risk activities are concentrated at the architectural design (5.3) stage.** At this stage you identify critical data and components with the potential to trigger risk, design architecture-level controls to isolate critical components, and judge the need for redundancy. In other words, **risk control begins at design, before writing any code.** It is an approach of building security into the architecture rather than bolting it on later.

### Traceability — The Thread That Joins the Two Standards

What actually binds IEC 62304 and ISO 14971 together is **Traceability** documentation. The traceability chain required at the risk control verification stage has the following four steps.

1. Hazardous situation → related software item
2. Software item → specific software cause
3. Software cause → risk control measure
4. Risk control measure → verification result

Only when this chain is complete can you prove that "the risk we identified was actually controlled in the code, and that control was verified." Translated into defender's language, it corresponds exactly to the traceability chain of **threat → asset → mitigation → verification.** That structure, familiar from threat modeling, is regulated in medical device standards under the name of risk management traceability.

The practical reason traceability matters lies in **auditability.** Security or safety claims cannot be verified on their own. The sentence "our system is safe" is meaningless without evidence. Traceability documentation turns that claim into a verifiable form — because you can follow the chain to confirm which control each risk leads to and by which test that control was verified. Anyone who has operated threat modeling in practice knows the common failure of building only a threat list and leaving it neglected without extending the chain to mitigation and verification. Medical device standards nail down the completion of that very chain as a regulatory requirement, forcing that no "half-built threat model" remains.

### SOUP — Software of Unknown Provenance

Another core concept of IEC 62304 is **SOUP (Software of Unknown Provenance).** It refers to a software item that is already developed and generally available but has no adequate record of an appropriate development process. Most commercial and open-source libraries fall into this category.

SOUP is a subject of special management. Since the developing organization could not control its internal development process, it must instead be **included in configuration management, tracked for known anomalies and vulnerabilities, and reflected in risk assessment.** From a defender's perspective, SOUP management deals with the same problem as **software supply chain security (SBOM, monitoring of known vulnerabilities).** How do you control the risk of putting someone else's code into your product — the standard has long required an answer to this question.

---

## 4. IEC 62443 — Where the Cybersecurity Axis Joins

### The Point Where Safety and Security Meet

The ISO 14971 and IEC 62304 covered so far are originally **Safety** centered. Their focus is on ensuring the device does not malfunction and harm the patient. But as medical devices became connected to networks, a new axis became necessary — **Security**, that is, defense against malicious threats.

There is an important insight here. **In a connected medical device, a security breach can become a safety risk.** If an attacker tampers with the device's operation, it is at once a cyber incident and a patient safety incident. That is why the safety framework and the security framework must meet.

### The Position of IEC 62443

IEC 62443 is originally a family of cybersecurity standards for Industrial Automation and Control Systems (IACS). It was created to protect power plant, factory, and infrastructure control systems from threats. The reason IEC 62443 became important in the medical device domain is that connected medical systems carry **structurally similar security problems** to industrial control systems — in that they are systems that operate for a long time, are hard to patch, and whose failures directly affect the physical world.

Organizing a few of the core concepts IEC 62443 introduces from a defender's perspective:

| Concept | Defender's Perspective Meaning |
|------|-----------------|
| **Zones & Conduits** | Divide the system into trust zones and control the communication paths (conduits) between zones — the network segmentation principle |
| **Security Levels (SL 1~4)** | Grade defense objectives according to the level of threat capability — from accidental misuse to high-resource attackers |
| **Foundational Requirements** | Seven foundational requirements such as access control, use control, data integrity, confidentiality, and data flow restriction |
| **Role Division** | Distinguish the responsibilities of product developer, system integrator, and asset owner |

In particular, the **Security Level (SL)** concept is interesting when placed alongside ISO 14971's risk grades and IEC 62304's safety classes. All three standards share **the same philosophy of "raising the strength of control in proportion to the severity of the threat/harm."** They just differ in the axis by which the grade is decided — ISO 14971 by severity of harm, IEC 62304 by the safety impact of software failure, and IEC 62443 by the capability level of the attacker.

### Comparing the Grading Systems of the Three Standards

Comparing which axis each of the three standards divides rigor by makes the relationship crisp.

| Standard | Grading Axis | What It Measures |
|------|---------|----------------|
| ISO 14971 | Risk = probability × severity | How bad the harm is and how often it happens |
| IEC 62304 | Safety class A/B/C | How serious a harm the software failure produces |
| IEC 62443 | Security level SL 1~4 | What level of attacker must be blocked |

The three axes are independent yet connected. For example, the consequences resulting when an IEC 62443 security control fails (a successful attack) flow back into ISO 14971's risk evaluation. **A security incident is treated as a single Hazard within the risk management framework.** This is the core interface where the three standards overlap.

One thing to be careful of is that the safety class and the security level do not always move in the same direction. Even a component whose software failure has low safety impact (Class A) may demand a high security level if it sits at the network boundary and becomes an entry point for attack. Conversely, a component that is critical for safety (Class C) may have relatively low security level requirements if it is physically isolated and not exposed to external threats. The defender must evaluate the two grades separately, but ultimately weigh them together within ISO 14971's integrated risk management. **A high safety class does not automatically mean a high security level, nor the reverse** — because the two axes answer different questions.

### The Integrated Picture of Threat Modeling

Integrating the three standards into a threat modeling flow yields the following picture.

```
[ISO 14971 framework]  ← top level: the framework that manages all risk
        │
        ├── Safety risk ──→ [IEC 62304]
        │                    Develop and verify software to the safety class
        │
        └── Security risk ──→ [IEC 62443]
                               Defend the connected environment to the security level
                                    │
                                    └── Security breach flows back as safety risk
                                        → back into ISO 14971 risk evaluation
```

The core of this picture is the **cycle.** The security risks that IEC 62443 handles ultimately feed back into ISO 14971's risk management. Cybersecurity is not a separate process but is integrated as one type of risk that the risk management framework handles. In fact, auxiliary standards that mediate this integration exist (AAMI TIR57, which grafts cybersecurity risk principles onto ISO 14971; IEC 80001-1, which handles risk management for IT networks incorporating medical devices; and so on).

---

## 5. How to Read the Three Standards Together — A Practical Summary

### Summary of Overlapping Points

Organizing the three interfaces where the three standards overlap:

1. **ISO 14971 ↔ IEC 62304 interface**: The software safety class is derived from risk severity, and risk management is cross-applied across all life cycle stages. Traceability documentation is the thread that joins the two.
2. **ISO 14971 ↔ IEC 62443 interface**: A security breach is incorporated into the risk management framework as a single hazard. Security level decisions connect to risk evaluation.
3. **IEC 62304 ↔ IEC 62443 interface**: Security requirements are incorporated as part of the software requirements, and at the architectural design stage, security controls (zone segmentation, access control) are designed together with safety controls.

### Summary of the Axis Each Owns

To prevent confusion, we finally nail down the unique area each standard owns.

- **ISO 14971 owns only**: The top-level framework and common terminology of risk management. The definition of risk acceptance criteria. The framework all other standards reference.
- **IEC 62304 owns only**: The concrete process stages of software development and maintenance. Safety classes A/B/C. SOUP management. Life cycle traceability.
- **IEC 62443 owns only**: The cybersecurity architecture of the connected environment. Zone and conduit design. Security levels SL. Foundational security requirements such as access/use control.

### Practical Principles for Defenders

We close with five principles for security practitioners encountering these standards for the first time.

1. **Grasp the framework first.** Learn ISO 14971's terms and processes first. The requirements of the other two standards are understood on top of this framework.
2. **Do not separate safety and security.** In a connected device, a security breach is a safety risk. Integrate the two axes into a single risk management.
3. **Grades come from harm.** Every grading system of the three standards is derived from "how bad is the outcome." Arbitrary grade assignment is a standards violation.
4. **Treat change as rigorously as development.** Maintenance and patches can undermine existing controls. Change management is a first-class citizen of risk management.
5. **Leave traceability as evidence.** Complete the chain of threat → asset → mitigation → verification in documentation. A claim that something was controlled can only be proven by traceability.

---

## Closing

ISO 14971, IEC 62304, and IEC 62443 are not in a competitive relationship but a **role-division relationship.** One builds the framework of risk management, one defines the software process, and one adds the security of the connected environment. The point where the three standards meet is clear — **the severity of harm determines the rigor of control, and a security breach ultimately feeds back as a safety risk.**

Everything in this article is an explanation of the structure and concepts of published international standards. The numbers and grades of the risk matrix are fictional values to aid understanding, and an actual risk assessment must be performed directly by each organization in its own clinical and operational context. Standards do not give answers — they only give **a disciplined method for deriving answers.**

---

## International Standards to Reference (Published)

- ISO 14971 — Medical devices — Application of risk management to medical devices
- IEC 62304 — Medical device software — Software life cycle processes
- IEC 62443 (family) — Security for industrial automation and control systems
- IEC/TR 80002-1 — Guidance on the application of ISO 14971 to medical device software
- IEC 80001-1 — Application of risk management for IT-networks incorporating medical devices
- AAMI TIR57 — Principles for medical device security — Risk management
- ISO/IEC Guide 63 / Guide 51 — Source of definitions of risk-related terminology
