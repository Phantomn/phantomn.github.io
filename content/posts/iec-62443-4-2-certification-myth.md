---
title: 'Why "IEC 62443-4-2 Certified" Means Nothing on Its Own'
date: 2026-08-08T00:00:00.000Z
excerpt: >-
  When a manufacturer says "we're IEC 62443-4-2 SL2 certified," the sentence alone tells you
  nothing about what was actually verified. This post dissects the arithmetic behind the three
  numbers (RA, NAR, TR) printed on a certificate, the decisive difference between N/A and
  out-of-scope, and why confusing SL-T/SL-C/SL-D/SL-A ruins any reading of the certificate.
tags:
  - iec-62443
  - certification
  - ics
  - ot
  - security-level
  - compliance
  - isasecure
  - iecee
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Bottom Line Up Front

**The sentence "IEC 62443-4-2 SL2 certified" tells you nothing on its own.** A 62443-4-2 certification isn't a pass/fail binary. Each of the seven Foundational Requirements (FRs) carries three numbers, and only by doing arithmetic on those numbers can you find out what was actually verified. Even the notation "SL2" loses its meaning unless you specify which of four distinct security levels it refers to.

This post covers how to read a 62443-4-2 certificate from three angles. First, the arithmetic behind the three numbers `(RA, NAR, TR)`. Second, the decisive difference between "not applicable" (N/A) and "out of scope." Third, correcting the confusion among the four security levels: SL-T/SL-C/SL-D/SL-A. This post isn't an introduction to 62443 itself - readers seeing the standard's structure for the first time should read [IEC 62443-4-2 Primer](/en/blog/iec-62443-4-2-primer/) first.

---

## 1. A Certificate Carries Three Numbers

Certificates under the IECEE CB Scheme (Industrial Cyber Security Program, OD-2061), the most widely used 62443 certification pathway, print **three numbers in the format `(RA, NAR, TR)` for each of the 7 FRs**.

| Symbol | Meaning |
|---|---|
| **RA** | Number of Requirements Assessed and passed |
| **NAR** | Number of Not Applicable Requirements |
| **TR** | Total possible Requirements (base requirements + REs) |

Here's one decisive fact. **TR is a constant defined by the standard itself, independent of the manufacturer.** How many requirements the 62443-4-2 standard specifies for each FR is fixed. That's what makes TR the baseline for comparing certificates.

| Category | TR |
|---|---:|
| CCSC (Common Component Security Constraints) | 4 |
| FR1 Identification and Authentication Control (IAC) | 22 |
| FR2 Use Control (UC) | 21 |
| FR3 System Integrity (SI) | 19 |
| FR4 Data Confidentiality (DC) | 5 |
| FR5 Restricted Data Flow (RDF) | 4 |
| FR6 Timely Response to Events (TRE) | 3 |
| FR7 Resource Availability (RA) | 11 |
| SAR (Software Application) | 3 |
| EDR (Embedded Device) | 13 |
| HDR (Host Device) | 14 |
| NDR (Network Device) | 22 |

*(These values are based on public white paper summaries and may be off by +/-1 depending on which edition and errata of the standard is reflected. In practice, you should recompute them from the original 4-2 text.)*

**If the TR printed on a certificate doesn't match this table, it's either a different edition or a different format.** Having this single reference table in hand lets you verify a substantial portion of a certificate.

---

## 2. The Core Arithmetic - TR - (RA + NAR)

Now for the main point. The relationship between the three numbers falls into two cases.

```
RA + NAR = TR   ->  every requirement was either assessed or marked not applicable
RA + NAR < TR   ->  some requirements were excluded from scope
```

**The difference `TR - (RA + NAR)` is the number of "Not Evaluated" (N/E) requirements.** And this number **is not printed directly on the certificate.** It only emerges once you calculate it yourself.

For example, suppose a component's certificate shows `(9, 2, 13)` for EDR. EDR's TR is 13.

- RA = 9 (9 passed)
- NAR = 2 (2 not applicable)
- 9 + 2 = 11 != 13

**The difference of 2 is out of scope (N/E).** Nowhere on the certificate does it say "2 requirements were excluded from testing." It only surfaces through arithmetic. What those 2 requirements are and why they were excluded cannot be determined from the certificate alone.

This is why the phrase "certified" carries so little information. Marketing materials tend to emphasize only RA, and often don't mention NAR and TR - especially the arithmetically derived N/E.

---

## 3. N/A and "Out of Scope" Are Completely Different

This is where the most common misunderstanding needs correcting. "Not applicable" (N/A) and "out of scope" (N/E) both superficially mean "this requirement doesn't appear in the assessment result," but their security implications are opposite.

| | N/A (Not Applicable) | N/E (Not Evaluated / out of scope) |
|---|---|---|
| Meaning | The requirement **doesn't apply** | The applicant **excluded it from scope** |
| Verification | Manufacturer's claim + **fact-checked by the certification body** | None |
| Security implication | **Safe** - a nonexistent feature can't be exploited | **Unknown** |
| Certificate notation | Explicitly listed as NAR | **Not shown. Must be inferred through arithmetic** |

**N/A is a safety signal.** For example, if a piece of software doesn't use mobile code (JavaScript, Java applets, etc.) at all, the mobile-code-related requirement (CR 2.4) is not applicable. The manufacturer declares "we don't use mobile code," and the certification body verifies this as fact. A feature that doesn't exist can't be attacked, so an N/A determination actually means a smaller attack surface. That's why, to receive an N/A determination, the applicant must **include that requirement in scope** - it then appears on the certificate as NAR, showing "not applicable has been confirmed," which benefits the applicant.

**N/E is a question mark.** It means the applicant excluded that requirement from scope entirely, and there are two possible reasons why.

1. **It's a requirement above the targeted SL** (normal) - if the target is SL2, an item required only at SL3 is naturally out of scope.
2. **It's required at that SL, but the manufacturer judged they couldn't meet it and excluded it** (a problem) - this is the dangerous case.

**The certificate alone cannot distinguish between these two.** To tell them apart, you need to look at the full test report. In the words of the white paper: "To determine whether a given requirement was excluded because it belongs to a higher security level, or because the manufacturer excluded an applicable requirement from scope, you generally need to review the full test report."

In other words, **a certificate with a large N/E count isn't inherently a red flag by itself, but it is a signal that you should request the test report.** That's where you find out whether it's a legitimate higher-SL exclusion or an avoidance of an unmet requirement.

---

## 4. Why the Applicant Chooses the Scope

The root of this structure lies in the fact that the IECEE scheme **gives the applicant the choice of scope**.

- The applicant chooses which standard to use, and **which security requirements within that standard to be assessed against.**
- **There's no obligation to select every requirement in the standard.**
- To receive an N/A determination, the requirement must be included in scope.

This flexibility is a double-edged sword. For manufacturers, it's an advantage - they can get certified in step with a phased release. But **for buyers, it's a drawback**: the certificate alone doesn't tell you "what was left out," because the N/E count isn't printed directly in the three numbers - it has to be inferred.

For reference, there are broadly two schemes for 62443 certification: the IECEE CB Scheme (the 3-tuple format covered above) and ISASecure (the ISA Security Compliance Institute's scheme). The two schemes use different formats - ISASecure uses level-based notation rather than a 3-tuple. But **one commonality between them is decisive**.

**Both schemes share the same structure: you cannot get component certification without development process certification.**

- IECEE: a 4-2 product certificate **cannot be issued** without referencing a 4-1 (development process) certificate.
- ISASecure: to obtain component certification (CSA), the supplier must first hold SDLA (Security Development Lifecycle Assurance) certification.

The fact that both schemes independently arrived at the same conclusion is telling. **Component security certification presupposes development process certification.** So when reading a 4-2 certificate, you should always check "is there a referenced 4-1 certificate?" If not, that 4-2 certificate cannot be valid in the first place.

---

## 5. The Trap of "SL2" - There Are Four Kinds of Security Level

Now for the second major misconception. When someone says "SL2 product," what exactly does that SL2 refer to?

In 62443, security level (SL) is **not a single concept but four distinct ones**. Each belongs to a different stage of the lifecycle and is determined by a different party.

| Type | Name | Meaning | Determined at | Determined by |
|---|---|---|---|---|
| **SL-T** | Target | The **required target** security level for this system | Design | Asset owner / integrator (based on risk assessment) |
| **SL-C** | Capability | The level a component **can provide on its own**, without compensating measures | Product development | Product supplier |
| **SL-D** | Deployed | The level actually satisfied immediately after initial deployment | System integration | Integration service provider |
| **SL-A** | Achieved | The **actual** level once all measures are in place during operation | Operations / maintenance | Asset owner |

**A 4-2 certificate speaks only to SL-C.** The certificate is typically labeled "Product Capability Assessment" - note that it's **Capability, not Achieved.** In other words, it means "this component has the capability to independently defend against SL2-level threats on its own," not "SL2 has actually been achieved in the environment where this component is installed."

### The Order Must Not Be Reversed

These four types have a sequence. **SL-T comes first.**

```
1. Divide the system into zones and conduits
2. Analyze consequences -> assign SL-T to each zone/conduit (risk assessment)
3. Select components with SL-C sufficient to meet the SL-T
4. Where SL-C < SL-T -> add compensating countermeasures
5. Measure the design's SL-A and compare it against SL-T
6. Re-measure SL-A during operation -> detect degradation
```

The key is the order: **"determine the target (SL-T) first, then choose products with the capability (SL-C) to meet it."** Choosing a product by looking only at SL-C reverses this order. Without a risk assessment to set SL-T, you have no way of knowing how high SL-C needs to be. In fact, the standard (3-3 Annex A.2.3) explicitly states that "control system security capability is determined independently of the context of use, but is used within that context to achieve the SL-T."

And an important fact - **not every component needs to independently satisfy the SL-T on its own.** A component whose SL-C falls short of the SL-T can be compensated for with measures like a firewall. The idea that "since this is an SL3 environment, every component must have SL-C 3" is a misconception.

### The Three Faces of SL 0

Even the same "SL 0" means something different depending on the type.

| Type | Meaning of SL 0 |
|---|---|
| SL-C | The component **fails to meet** part of that FR's SL1 requirements (a defect signal) |
| SL-T | Risk analysis determined that less than SL1 is **sufficient** for that FR (normal) |
| SL-A | That zone **is currently failing to meet** part of the SL1 requirements (a degradation signal) |

**SL-C 0 is a defect signal, while SL-T 0 is a normal judgment.** The same notation must not be read the same way across types. "SL-T is 0" can be a reasonable decision meaning "this FR isn't that important in this zone." "SL-C is 0" is a flaw meaning "this product doesn't even meet the minimum requirement for this FR."

*(SL-D is a relatively recent addition, still at the draft stage. The currently published 3-3:2013 and 4-2:2019 use a three-type system of SL-T/SL-C/SL-A, so using SL-D in practical documentation may create terminology mismatches with assessors. Until you've confirmed the published edition, it's safer to default to the three-type system.)*

---

## 6. Reading a Certificate - A Practical Procedure

Let's tie everything above into a single checklist - the sequence to follow when you have a 62443-4-2 certificate in hand.

1. **Check the certificate type** - is it a "Product Capability Assessment"? **It's Capability (SL-C), not Achieved (SL-A) in the deployed environment.**
2. **Check the product version** - look at the "Certificate Coverage" field. A certificate for v3.1 isn't valid for v4.2.
3. **Check the standard edition** - e.g., `IEC 62443-4-2:2019`. A different edition means the TR reference table won't match.
4. **Check for a referenced 4-1 certificate** - a 4-2 certificate must reference a 4-1 certificate. Without one, it can't be valid.
5. **Compare the per-FR 3-tuple against the TR table** - calculate the `TR - (RA + NAR)` difference. If it's large, request the test report.
6. **Determine the device type** - among SAR/EDR/HDR/NDR, whichever has RA != 0 is the actual component type. If the rest are `(0, 0, ...)`, those types are not applicable.

### Why It Can't Be Compressed to a Single Number

Finally, the root of all this complexity. A 62443-4-2 certification is essentially **measuring the length of a 7-FR vector**. FR3 has 19 "notches" at its highest level, while FR5 has only 4. Each FR is an independent axis.

That's why **comparing an "SL2 product" to an "SL3 product" has to be done FR by FR.** The slope of increasing SL differs by FR.

- **FR5 (Restricted Data Flow) is identical across SL1 through SL4** (4 requirements, no REs). Network segmentation requirements don't increase as SL rises.
- Conversely, **FR1 (Identification and Authentication) jumps from 1 reinforcement requirement (RE) to 7 between SL2 and SL3**.

In other words, an "SL3 product" being stronger than an "SL2 product" doesn't hold across every FR. They're identical at FR5, while the gap is large at FR1. This is why SL can't be compressed into a single number, and why a certificate prints three numbers per FR.

---

## Summary

The sentence "IEC 62443-4-2 SL2 certified" hides information at three layers.

- **Which FRs were assessed, and how much** - this only emerges by looking at the certificate's `(RA, NAR, TR)` per FR and calculating the `TR - (RA + NAR)` difference.
- **What was excluded** - N/A (safe) and N/E (unknown) are different, and understanding N/E requires the test report.
- **Which SL it refers to** - it's SL-C (capability), not SL-A (achieved in the deployed environment), and its determination order is the reverse of SL-T (target).

A certificate isn't a stamp of approval - it's **coordinates on a vector**. Without knowing the arithmetic to read those coordinates, the phrase "certified" really does tell you nothing. If you'd like to know more about the requirement structure of 62443 itself - FR1 through FR7, component types, and the SL vector - [IEC 62443-4-2 Primer](/en/blog/iec-62443-4-2-primer/) maps it out.
