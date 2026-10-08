---
title: Why Legacy ICS Protocols Have No Authentication - The Legacy of 2000s Design Decisions
date: 2026-08-06T00:00:00.000Z
excerpt: >-
  Many legacy industrial control protocols were designed without authentication or integrity
  guarantees. This wasn't a mistake - it was a rational choice for the 2000s, premised on an
  air-gapped network, and this post examines how that choice became today's security debt,
  using open protocols (Modbus, DNP3) as examples.
tags:
  - ics
  - ot-security
  - modbus
  - dnp3
  - protocol-security
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

Many legacy industrial control system (ICS) protocols **lack authentication.** They don't verify who sent a command, don't check whether a message was tampered with in transit, and leave access control to the client (engineering tool) rather than the server (field device). Calling this "the designers didn't know about security" is a lazy diagnosis. What actually happened is that **choices that were rational under the constraints of their era** turned into debt after colliding with twenty years of increasing network connectivity.

This post doesn't analyze any specific vendor protocol. Instead, using **public legacy protocols** like Modbus and DNP3 as examples, it covers four structural flaws shared by legacy ICS protocols - lack of authentication, simple summation checksums, client-side access control, and unauthenticated RTC/configuration writes - examining the design logic behind each and why each is dangerous today.

---

## Why There Was No Authentication: The Air-Gapped-Network Premise

The threat model of industrial protocols designed between the 1970s and 2000s was fundamentally different from today's. At the time, there were three premises.

**First, physical isolation.** Control networks sat inside the factory fence, physically separated by serial cables or dedicated fieldbuses. Accessing the communication link required physically touching that cable. Physical access was effectively authentication. The assumption was that anyone who made it inside the fence was already trusted.

**Second, determinism and latency budget.** Industrial control is real-time. PLC scan cycles operate on the order of milliseconds, and Safety Instrumented Systems (SIS) have even tighter response deadlines. On a 1990s embedded CPU - a few MHz clock, tens of KB of RAM - computing and verifying a cryptographic signature for every message was unaffordable, both in latency and computation budget. One HMAC calculation exceeding the scan cycle breaks the control loop.

**Third, interoperability and lifespan.** Industrial equipment has a designed lifespan of 15 to 30 years. Protocols needed to remain compatible across decades, in environments mixing equipment from multiple vendors. The simpler the protocol, the fewer implementation errors and the easier interoperability. A complex cryptographic negotiation layer was the enemy of interoperability.

Under these three premises, "no authentication" wasn't a flaw - it was an **optimization.** The problem is that the premises collapsed. IT/OT convergence, remote maintenance, cloud SCADA, and smart factories stripped away physical isolation. The premises of the threat model vanished, but the protocol's design decisions remained unchanged. **That's how debt always works - the bill doesn't arrive at the moment of repayment, it arrives when the conditions change.**

### Modbus: A Textbook Case

Modbus (introduced by Modicon in 1979), the most widely used industrial protocol, is a textbook example of this legacy. A Modbus request frame looks roughly like this:

```
[Unit Address] [Function Code] [Data] [Checksum]
```

Nowhere in this is there a field indicating "who sent this command." A frame carrying function code `0x06` (write single register) or `0x05` (write single coil) is **processed completely identically**, whether it came from a legitimate engineering workstation or an attacker's laptop that infiltrated the network. The server (slave) has no way to distinguish the sender. Once Modbus moved to Modbus/TCP (port 502), even the physical isolation of the serial link disappeared, but the frame structure is unchanged from 1979.

This is the first common flaw in legacy ICS protocols: **the complete absence of per-message authentication.** Even a protocol that checks a password once when a session opens often doesn't attach any authentication token to individual commands after the session is opened. In that case, session hijacking or a simple packet replay is enough to inject an arbitrary command.

---

## Simple Summation Checksums: Confusing Error Detection with Tamper Protection

The second common flaw in legacy protocols leads to a misunderstanding of what an integrity mechanism actually does. Many legacy protocols append a **checksum** to the end of a frame. The problem is that this checksum is usually an **error-detection code such as a simple byte sum, LRC, or CRC.**

There's a distinction here that must be made:

| Purpose | Mechanism | Defends Against |
|------|----------|-----------|
| Error detection | Sum checksum, LRC, CRC | **Accidental** bit flips in transit (electrical noise, cable defects) |
| Integrity assurance | HMAC, digital signature | **Deliberate** tampering (rewriting by an attacker) |

A byte-sum checksum is for error detection. It's designed to catch bits flipped by noise on a poor-quality serial line. It's sufficient for that purpose. But **it provides no defense whatsoever against an attacker.** An attacker can simply modify the payload however they want, then recompute and attach a checksum that matches the modified payload. The checksum calculation rule is public and the computation is trivial. The same is true of CRC - CRC is a keyless public function, so it doesn't prevent modifying a payload and recomputing the CRC.

In other words, **"there's a checksum, so integrity is guaranteed" is a category error.** An error-detection code and a message authentication code (MAC) have similar names and occupy the same position in a frame, but their threat models are opposite. One defends against nature, the other against an adversary. When auditing a legacy protocol's frame, confusing the two leads to the false reassurance that "integrity protection is in place."

DNP3's original specification (a protocol widely used in power and water SCADA) was in this state for a long time too. DNP3 has a CRC at the link layer, but that was pure error detection - it didn't guarantee the authenticity of a command. The very fact that **DNP3 Secure Authentication (SA, based on IEEE 1815)** was later added separately to fill this gap is itself evidence that the original protocol lacked authentication. Integrity can be bolted on after the fact, but a layer added that way tends to be exposed to downgrade attacks during backward-compatibility negotiation.

---

## Client-Side Access Control: Trust in the Wrong Place

The third flaw is the most subtle, and therefore the most dangerous. In many legacy protocols, **the entity enforcing access control rules is the client (engineering software), not the server (field device).**

The typical pattern goes like this: the protocol specification has a rule like "this memory region is read-only" or "this region is write-prohibited." But that rule is **enforced by the engineering tool at the UI/software level.** If a user tries to write to a read-only region through the tool, the tool refuses. But **the field device's firmware, if the write request actually arrives, executes it as-is.** The device assumes "a well-behaved tool wouldn't send this request in the first place," and trusts the client.

This is a direct violation of a security principle: **you must not trust the party on the other side of a trust boundary.** Access control must be enforced by the party that owns the resource - the server. Client-side validation is a convenience feature, not a security feature. An attacker has no obligation to use the vendor's engineering tool. If they read the protocol specification and write a script that constructs frames directly, every rule the client enforced - read-only regions, write-prohibited ranges, blocking dangerous commands - is simply bypassed.

Readers familiar with web security will recognize this as **the exact same mistake as a web form that trusts only client-side validation.** An API that validates input with JavaScript but doesn't validate it on the server is bypassed with a single line of `curl`. The same principle applies in ICS. The difference is the weight of the consequence. On the web, data integrity breaks. In OT, a physical process escapes control.

What makes this flaw especially bad is that **it's hard to spot during an audit.** An engineer who has worked with a system through the vendor's tool comes to believe, empirically, that "the read-only region can't be touched." Because through the tool, it genuinely can't be. The fact that this protection exists only on the client side doesn't surface until you implement the protocol yourself and send frames directly.

---

## Unauthenticated RTC/Configuration Writes: A Path to Log Tampering

The fourth flaw becomes especially sharp where the previous three combine. Many legacy devices allow **the real-time clock (RTC) and system configuration to be changed via ordinary memory-write commands, without authentication.**

It's not immediately obvious why writing the RTC is a security problem. What's dangerous about setting a clock? The issue is that **the RTC is the source of audit log and event timestamps.** Every event a device logs - a received command, a mode transition, an alarm, a safety trip - is stamped with the RTC's time.

If an attacker can manipulate the RTC without authentication, the following become possible:

- **Log sequence disruption.** Winding the clock backward or forward scrambles the chronological order of events. During incident investigation, it becomes impossible to reconstruct "what happened, in what order."
- **Alibi fabrication.** Setting the clock forward right before an attack pushes the actual attack event's timestamp outside the normal operating time window, causing it to be missed in a routine log review.
- **Correlation defeat.** A SIEM/SOC correlates logs from multiple devices by timestamp to reconstruct an attack chain. If one device's clock is manipulated, that correlation breaks down.

In other words, **an unauthenticated RTC write fundamentally undermines the reliability of the audit trail.** And the audit log is the last line of defense for incident response, forensics, and regulatory compliance. If that last line can be falsified with a single unauthenticated write command, there's no way to prove after an incident "what actually happened."

The configuration region has the same problem. If communication parameters, alarm thresholds, and protection logic settings can be changed without authentication, an attacker can disable a protection relay's threshold or silence an alarm, execute a destructive command, and cover their tracks.

The core point here also shows up in **the complete absence of any security concept in the error code scheme.** Looking at a legacy protocol's catalog of NAK/error responses, **functional errors** such as "invalid address," "unsupported command," and "mode mismatch" are elaborately classified, but **security error codes such as "authentication failure" or "insufficient permission" simply don't exist.** The absence of any concept of authentication failure in the protocol is the most direct evidence that authentication itself was never part of the threat model at design time.

---

## Repaying the Debt: What to Fix, and Where

These four flaws are intertwined into a single systemic debt. Summarized:

| Flaw | Era's Rationale | Today's Risk | Direction of Repayment |
|------|--------------|-------------|-----------|
| No message authentication | Air-gapped premise, compute budget | Arbitrary command injection, replay attacks | Session/message authentication (e.g., DNP3-SA), gateways |
| Simple sum/CRC checksum | Serial noise detection | No defense against payload tampering | MAC/signature, TLS wrapping |
| Client-side access control | Interoperability, simple firmware | Rules fully defeated by bypassing the tool | Server-side enforcement, protocol-aware firewall |
| Unauthenticated RTC/config writes | Convenience | Log tampering, defeats forensics | Authenticated time sync (NTP/PTP authentication), write authorization |

Here I want to add a lazy senior developer's perspective. **Most of this debt isn't repaid by tearing apart the protocol itself.** Replacing the firmware on every field device with a 15-to-30-year lifespan is usually unrealistic, and attempting it invites bigger risks, such as having to re-obtain safety certification. A realistic repayment happens **at the boundary.**

- **Segmentation** - restore, via network segmentation and data diodes, the original premise of physical isolation. This recreates the conditions the protocol's threat model assumed. It's the cheapest and most reliable repayment.
- **Protocol-aware gateways/firewalls** - have a boundary gateway enforce the access control the server itself can't. Whitelist things like "this source writing this region with this function code."
- **Authentication wrapping** - if the protocol itself can't be changed, wrap it in a TLS tunnel or an authentication gateway. If a standardized authentication extension exists, like DNP3-SA, enable it.
- **Monitoring and time integrity** - even if unauthenticated RTC writes can't be fully blocked, at minimum detect that command, and double up log timestamps against a separate, trustworthy time source (authenticated NTP/PTP).

The most important lesson lies in the attitude of diagnosis. Concluding "the designers were incompetent" when looking at a legacy ICS protocol's security flaws is not just wrong, it's dangerous. It's wrong because it isn't true, and it's dangerous because that diagnosis leads to the arrogance of **"we're smart enough to just redesign it."** The real lesson is the opposite: **the design decisions we make today, justified with "it's an air-gapped network," "we have no performance budget," or "only our own client will access this," come back twenty years later as exactly the same kind of bill to someone else.** The premises of a threat model eventually collapse. That's when the debt comes due. Legacy ICS protocols are a living case study showing us that bill, right now.
