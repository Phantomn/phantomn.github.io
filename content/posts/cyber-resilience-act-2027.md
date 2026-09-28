---
title: What the CRA Changes in 2027 — How 62443 Became the Baseline Standard for CE Marking
date: 2026-08-07T00:00:00.000Z
excerpt: >-
  The EU Cyber Resilience Act (Regulation (EU) 2024/2847) is the world's first
  law to mandate cybersecurity for physical products with digital elements. This
  post lays out the incoming timeline (reporting obligations on 2026-09-11, full
  application on 2027-12-11), how 62443 becomes the basis of CE marking as a
  harmonised standard, and the 6 CRA-specific requirements 62443 does not cover.
tags:
  - cra
  - cyber-resilience-act
  - iec-62443
  - eu-regulation
  - ce-marking
  - ot
  - ics
  - compliance
  - sbom
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Bottom line first

From December 11, 2027, **digital products that cannot demonstrate cybersecurity conformity can no longer be sold in the EU.** This is because the EU Cyber Resilience Act (CRA, Regulation (EU) 2024/2847) folds cybersecurity into the requirements for CE marking. And **IEC 62443** is establishing itself as the baseline standard for demonstrating that conformity. The CE mark, which used to attest only to physical safety, now becomes a mark that must also prove "this product was securely designed and manages its vulnerabilities."

This post covers three things. First, what the CRA is and what becomes mandatory starting when — timing is the crux. Second, how 62443 is being folded into the CRA as a harmonised standard. Third, **the 6 CRA-specific requirements that 62443 alone cannot cover** — this is where the practical pitfalls lie. Readers unfamiliar with the structure of 62443 itself may want to start with the [IEC 62443-4-2 primer](/en/blog/iec-62443-4-2-primer/).

---

## 1. What is the CRA — the world's first horizontal regulation

The CRA's formal title is **Regulation (EU) 2024/2847 — on horizontal cybersecurity requirements for products with digital elements**. It entered into force on December 10, 2024.

The reason it earns the "world's first" label is that it is the **first horizontal regulation to mandate cybersecurity requirements for physical products with digital elements**. Not software alone, not IT systems alone — **nearly everything that connects to a network** is in scope. (Strictly speaking, there were precedents like the US IoT Cybersecurity Improvement Act (2020), the UK PSTI (2024), and Singapore's CLS, but those were limited to narrow product categories. The CRA is different in that it is a horizontal regulation that does not single out product categories.)

### Scope — three conditions

If all three of the following conditions are met, the product is in scope of the CRA.

1. **Connects to a network** — it need not be a direct internet connection. **Indirect connection through an upstream system is sufficient.**
2. **Contains software or digital functionality**
3. **Supplied to the EU market in the course of commercial activity**

Two things to note here. First, the scope of "product" is broad. For a connected industrial device, for example, not just the hardware but the **firmware, OS, control software, mobile app, cloud services, and remote management functions** are all considered part of the product. It even includes remote data-processing solutions and components sold separately.

Second, **it applies extraterritorially.** Even manufacturers in the US, China, or Japan bear compliance obligations if they ship to the EU market. The place of manufacture is irrelevant. This is what makes the CRA effectively a global norm — unless you give up the EU market, you cannot avoid it.

**Exclusions** are areas that already have equivalent requirements — medical devices (MDR/IVDR), aviation-certified products (EASA), and so on.

### Manufacturer obligations — from design, not post-hoc patching

The manufacturer obligations the CRA imposes fall into four strands.

- **Secure by design** — no default passwords, minimized attack surface, a built-in security update mechanism. Security must be built in **from the design stage**, not patched afterward.
- **Lifecycle vulnerability management** — actively monitor, disclose, and patch throughout the support period.
- **Incident reporting** — report actively exploited vulnerabilities and serious incidents to the EU single reporting platform.
- **CE marking** — affix the CE mark covering not just physical safety but cybersecurity conformity as well.

---

## 2. Timing is the crux — 2026 and 2027

The CRA's urgency lies in the fact that its **dates of application are staged**. Between entry into force (2024-12-10) and full application there are intermediate milestones, and the first of them is already upon us.

```
2024-12-10  in force
     │
2026-09-11  * vulnerability/incident reporting obligation in effect
     │      - actively exploited vulnerability: 24h (early warning) / 72h (full) / 14d (final)
     │      - serious incident reporting
     │
2027-12-11  ** full application
            - technical documentation complete
            - CE-CRA marking (no EU sale without it)
```

### September 2026 — reporting obligations come first

More than a year ahead of full application, **vulnerability and incident reporting obligations take effect on September 11, 2026.** Once you become aware of an actively exploited vulnerability, you must submit an early warning within 24 hours, a full notification within 72 hours, and a final report within 14 days to the EU single reporting platform.

There is one practical risk here. **The reporting obligation takes effect, but whether the ENISA single reporting platform (SRP) that is supposed to receive these reports will be operational** is uncertain. And the legal text contains no exemption clause for the platform not being operational. Manufacturers must prepare their own reporting channels, and managing this timing becomes a task for the second half of 2026.

### December 2027 — no CE, no sale

By the date of full application, the technical documentation and the CE-CRA marking must be complete. **Without the CE mark, you cannot ship to the EU market.** This is why the CRA is not a mere recommendation but a market-entry barrier. This is the motivation for manufacturers preparing 62443 certification now — the certification is not the goal in itself; securing the basis for CE marking is.

---

## 3. The structure by which 62443 becomes the basis of CE marking

The CRA is a law, not a technical standard. The law says "design it securely"; it does not say "passwords must be at least N characters." That gap is filled by a **harmonised standard**. If you follow a harmonised standard, you gain a **presumption of conformity** with the CRA's Essential Security Requirements (ESR).

And the harmonised standard for the OT (operational technology) domain **is being built on top of IEC 62443.** CEN-CENELEC's CLC/TC 65X WG3 is carrying out the following work.

```
[IEC 62443-4-2:2019]  ──A11:2026──▶  EN IEC 62443-4-2:2019/A11:2026
[IEC 62443-4-1]       ──A11:2026──▶  EN IEC 62443-4-1/A11:2026
         │
         ▼  (derived on top of these)
   prEN 50770-1~6  (6 OT profiles)
         │
         ▼  each profile maps via Annex ZZ
   CRA essential requirements (ESR) <-> technical security requirements mapping
```

The key point is that an amendment called **A11:2026** adds to the existing 62443-4-2 what is needed for CRA compliance. What A11:2026 adds:

- **Applicability criteria** for all CRs and REs
- Defined **assessment deliverables** per CR/RE
- Incorporation of the **TS 62443-6-2 evaluation methodology** (a way to evaluate components repeatably and reproducibly)
- The concept of **Security Test Grades / Modules**
- **SL-based acceptance criteria**

In other words, the evaluation framework that lets you judge "does it satisfy 62443-4-2 requirements" for CE-marking purposes comes from A11:2026 and 6-2. That is why 62443-4-1 (development process) and 4-2 (component requirements) are named **together**. As pointed out in another post, 4-2 certification presumes 4-1 certification, so CRA compliance must also treat the two standards as a single bundle.

### The current state of the harmonised standards — still 0 published

Here is one sobering reality. **As of August 2026, of the 41 harmonised standards under the M/606 mandate, the number published in the Official Journal of the EU (OJEU) is 0.**

A harmonised standard only produces the "presumption of conformity" effect once it is published in the OJEU. Until publication, following that standard does not automatically confer a presumption of conformity. In other words, **as of now, the path to a presumption of conformity via a harmonised standard is not yet open for any product category.**

The biggest gap is that the core standard covering CRA essential requirements broadly (EN 40000-1-4 and others) has a delivery target of **October 2027** — two months before full application. What manufacturers will rely on to affix the CE mark by December 2027 remains unresolved. If the standards arrive late, in the early period manufacturers may have to rely on paths that demonstrate conformity through self-assessment or third-party certification without a harmonised standard.

---

## 4. The 6 CRA requirements 62443 does not cover

The practical crux of this post is here. **Satisfying all of 62443 does not mean satisfying all of the CRA.** The CRA contains its own requirements that 62443 does not address.

### 6 technical requirements outside 62443

| CRA-specific requirement | Why 62443-4-2 does not cover it |
|---|---|
| **SBOM** (Software Bill of Materials) | 4-2 does not prescribe a format for producing the component list |
| **CVD policy** (Coordinated Vulnerability Disclosure) | 4-2 addresses product capabilities, not the disclosure process |
| **Point of contact for information sharing** | A regulatory communication channel is not a standard requirement |
| **Data minimization** | A privacy-oriented requirement, outside 62443's scope |
| **Secure deletion** | Deletion on disposal belongs to the development lifecycle, not 4-2 |
| **Impact on availability of other systems** | The requirement that a product not harm the availability of other systems |

### The center of gravity is 4-1, not 4-2

The interesting point is that many of these 6 fall under **the development process (4-1), not the component requirements (4-2).**

| CRA requirement | Corresponding 4-1 requirement |
|---|---|
| CVD policy | **DM-5** issue disclosure · **DM-1** report intake |
| Secure deletion | **SG-4** secure disposal guidance |
| Lifecycle vulnerability management / patching | **SUM-4/5** update delivery · timely patching |
| SBOM | **SM-9/SM-10** external procurement · third-party components (partial; list format unspecified) |

The 4-1 prefixes referenced here (DM = issue management, SG = security guidance, SUM = update management, SM = security management) come from 62443-4-1's 8 Practices. This means the process standard absorbs a substantial part of the CRA's vulnerability-management, disclosure, and disposal requirements.

**Conclusion: the center of gravity of CRA compliance is not product functionality (4-2) but the development process (4-1).** No matter how robust you make the product, if the CVD policy, secure-deletion guidance, and patch-delivery process are not documented, you will not clear the CRA.

### Regulation-specific deliverables

Beyond technical requirements, the CRA also requires deliverables specific to regulation.

- **CE marking** + **EU Declaration of Conformity (DoC)**
- **Annex VII technical documentation**
- **Art 14 reporting** (the 2026-09-11 reporting obligation above)
- **Declaration of support period**

There is a pitfall in the last item. **The "support period declaration" becomes a problem for OT products.** It is often talked about as "5 years of support," but CRA recital 60 specifies long support periods for industrial control systems, and the Commission guidance nails down that **5 years is not a default but a floor.** In other words, for an industrial device operated for 20–30 years, a 5-year support declaration may not be enough. The support period is a value that must be justified against the product's lifespan, not one you can uniformly set to 5 years.

---

## 5. What to do now

Working backward from the timing gives you the order of preparation.

**By the second half of 2026** — establish vulnerability and incident reporting processes. In preparation for the 2026-09-11 reporting obligation, document your CVD policy (4-1 DM-5), reporting channels, and 24/72-hour response procedures. You need your own preparation regardless of whether the ENISA platform is operational.

**By full application in 2027** — build conformity around 62443-4-1 (development process) and 4-2 (component requirements), while separately taking care of the 6 items outside 62443 (SBOM, CVD, information sharing, data minimization, secure deletion, impact on other systems' availability). In case the harmonised standards arrive late, review in parallel a path to demonstrate conformity without a harmonised standard (technical documentation, third-party assessment).

---

## Summary

What the CRA changes in 2027 ultimately boils down to one thing — **cybersecurity becomes an essential requirement for CE marking, and 62443 stands as its baseline standard.**

- **Timing** — reporting obligations come first on 2026-09-11, and at full application on 2027-12-11, no CE means no sale.
- **Structure** — 62443-4-2/4-1 are being folded in as harmonised standards through the A11:2026 amendment and the 6-2 evaluation methodology. However, as of 2026-08, harmonised standards published in the OJEU number 0, so the presumption-of-conformity path is still undetermined.
- **Pitfalls** — 62443 alone does not cover the 6 items (SBOM, CVD policy, secure deletion, and so on), and their center of gravity is 4-1 (development process), not 4-2. A 5-year support period is merely a floor for OT, not a default.

Treating 62443 as "done once you're certified" is a misstep in the face of the CRA. The CRA builds on 62443 but demands processes and regulatory deliverables on top of it. If you want the standard's requirements map itself, the [IEC 62443-4-2 primer](/en/blog/iec-62443-4-2-primer/) lays out FR1~7 and the component types.
</content>
