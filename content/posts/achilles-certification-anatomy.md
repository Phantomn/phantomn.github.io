---
title: Anatomy of Achilles Certification - How Industrial Control Devices Get Fuzzed
date: 2026-08-10T00:00:00.000Z
excerpt: >-
  An anatomy of how Achilles Communications Certification (ACC) tests PLCs, RTUs, and
  industrial switches. It covers the classification of 31 L1 / 54 L2 test cases, the seven
  test types (Scans, Storms, Fuzzers, Grammars), control-protocol coverage from the IP stack
  up to DNP3, Modbus, and IEC 61850, and what the Normal/Warning/Failure monitors actually
  determine.
tags:
  - ics
  - ot
  - fuzzing
  - achilles
  - iec-62443
  - protocol
  - vulnerability-research
  - robustness-testing
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Introduction

When an industrial control device vendor says "our PLC is Achilles certified," behind that sentence hundreds of thousands of malicious packets have been poured inline into that device. Achilles certification tests communication robustness. In plain terms, it verifies **whether the device keeps its control functions even under a flood of malformed packets and high-load traffic**. For an IT server, such a situation would mean a brief slowdown, but on a power plant or substation controller it translates directly into a physical accident.

This article dissects the internals of Achilles Communications Certification (ACC) in three parts. Part 1 covers the test environment and the verdict system - where the hardware is inserted, what the monitors watch, and what Normal/Warning/Failure each mean. Part 2 covers the seven test types and the classification of 31 L1 / 54 L2 test cases - what gets hammered, and how, at each layer of the IP stack. Part 3 covers control-protocol coverage - how DNP3, Modbus/TCP, EtherNet/IP, IEC 61850, IEC 104, and OPC UA are each tested.

The design principles of the Grammar-style tests covered here are treated in depth separately in the [Grammar-based fuzzing article](/en/blog/grammar-based-fuzzing/). This article sits on top of that and looks at "how it is organized within the framework of a certification."

---

## Part 1 - The Test Environment and Verdict System

### ACC and APC - Two Certifications

Achilles certification splits into two branches.

- **ACC (Achilles Communications Certification)** - communication robustness certification. It verifies whether a device maintains its control functions under malformed and high-load traffic. This is the subject of this article.
- **APC (Achilles Practices Certification)** - security practices certification. It looks at organizational processes such as the development lifecycle and vulnerability response process.

The scope of ACC is broad. **Embedded devices** like PLCs, DCSs, and RTUs; **network equipment** like routers and switches; **host equipment** like EWSs, historians, and domain controllers; and **control applications** like HMIs and control software are all in scope. It is divided into L1 and L2 by security strength, and L2 is a superset of L1 - it includes all L1 tests, adds monitors, and introduces the concept of the VDR (explained later).

### The Device Under Test Is Not Isolated - Inline Insertion

The core idea of Achilles testing is **inline insertion**. The test appliance is inserted between the DUT (Device Under Test) and the VCS (Validation Control System, the control system).

```
[VCS (control system)] ──── [Achilles Satellite] ──── [DUT (Device Under Test)]
                         │
                    [Client PC]
                    (test control / result review)
```

This arrangement matters because Achilles is not merely a tool that throws packets - it **performs packet generation, transmission, and monitoring as a single unit**. While the DUT communicates normally with the VCS, Achilles injects malicious traffic into that communication line and simultaneously observes the DUT's output signals. The test network is usually composed of four segments.

| Network | Composition | Role |
|---------|------|------|
| Test 1 | Achilles Port 1 + DUT 1 + VCS 1 | Primary test path |
| Test 2 | Achilles Port 3 + DUT 2 + VCS 2 | Parallel test of a second DUT |
| Management | Client ↔ Achilles | Test control / result review (no DHCP, manual config) |
| Monitor | Achilles Monitor Port + VCS auxiliary NIC | Dedicated to watching output signals |

### Pre-Test Setup - Planting "Essential Functions" in the DUT

Before testing begins, the DUT must have continuously observable essential functions configured. Taking a PLC as an example, four things are configured.

| Function | How it's set up |
|------|---------|
| **Control** | Ladder logic that generates digital/analog output signals |
| **Alarm** | Periodically raise an alarm and store it in the history |
| **View** | Display the output values on screen at the HMI |
| **Command** | Send a command via HMI script that changes the output period |

The reason for this is clear. While Achilles pours traffic in, you have to **catch the moment these functions break**. The most representative one is generating a square wave with a 1-second period (500ms high / 500ms low) on a digital output. If this waveform gets disturbed, it is a signal that a control function has been interfered with.

### Monitors - What Do They Watch

Achilles runs several monitors simultaneously.

| Monitor | What it watches |
|--------|---------|
| **Discrete Monitor** | Digital output signal (1000ms period square wave) |
| **Analog Monitor** | Analog output signal (L2 only) |
| **ICMP Monitor** | ICMP ping response (confirms communication is alive) |
| **Link State Monitor** | Physical link state maintenance |
| **TCP Ports Monitor** | Connection state of discovered TCP ports |
| **UDP Ports Monitor** | State of discovered UDP ports |
| **Test Monitor** | Detection of anomalies within a test case |

L1 uses only two: **Discrete + ICMP**. L2 adds **Analog + Link State + TCP Ports + UDP Ports** for a total of six. This means L2 casts a finer net.

### Normal / Warning / Failure - An Easily Misunderstood Verdict

This is where Achilles beginners most commonly go wrong. There are three monitor results.

| Result | Meaning |
|------|------|
| **Normal** | No abnormal behavior throughout the test and post-test |
| **Warning** | Anomaly detected during the test, self-recovered before the post-test ends |
| **Failure** | Anomaly detected during the test, still not recovered after the post-test ends |

**A Failure is not the same as "certification failure."** A Failure only records the fact that abnormal behavior was observed and not recovered from. The final pass/fail is decided by applying separate Certification Requirements. For example, a by-design ICMP Monitor Warning - such as "it was designed to intentionally stop responding above 200 packets per second" - may be granted an exception if design documentation is submitted. In contrast, a Discrete Monitor Warning/Failure or an ICMP Failure is not granted an exception, because a wobble in the control signal leaves no room for excuses.

### L1 Pass Criteria - The Wall of 10% Link Utilization

L1's pass condition is simple and strict.

```
For every test at or below 10% link utilization:
  Discrete Monitor → Normal
  ICMP Monitor → Normal

If even a single test fails to meet this criterion → L1 fail
```

The key parameters are as follows. Maximum link utilization **10%**, Discrete Monitor period 1000ms (tolerance ±4%), ICMP timeout 0.5 seconds, ICMP allowed packet loss 10%. The number 10% is important - it means that at up to 10% of link bandwidth in traffic, control and ping must **unconditionally** stay alive.

### L2 Pass Criteria - Splitting the Bar in Two with the VDR

L2 adds analog output monitoring here and introduces the concept of the **VDR (Vendor-Defined Rate)**. The VDR is the packet rate at which one of the following occurs.

1. The point where the device activates a rate-limiting mechanism and starts discarding traffic, or
2. The point where the device reaches its performance limit and starts dropping packets

The L2 pass criteria split into two ranges bounded by this VDR.

```
Every test at or below the VDR:
  Discrete / Analog / Link State / ICMP / TCP Ports / UDP Ports → all Normal

Above the VDR up to the maximum link rate:
  Discrete / Analog / Link State → Normal (required)
  ICMP / TCP Ports / UDP Ports → Normal or Warning allowed
```

The idea is interesting. At or below the VDR - that is, the load the device itself declares it can handle - everything must be perfect. Under the extreme load beyond the VDR, **the control signals (Discrete/Analog) and the link must stay alive without exception, but ancillary responses (ICMP/ports) are forgiven for briefly dying**. What if the vendor doesn't specify a VDR? Then the strict criterion (the at-or-below-VDR criterion) is applied uniformly across the entire test set. L2 additionally specifies a Recovery period of 120 seconds, meaning it must return to a normal state within two minutes after the load ends.

---

## Part 2 - The Seven Test Types and IP Stack Coverage

### The 7 Test Types

Achilles tests are classified into seven types by purpose. Understanding this classification lets you read the numbers printed on a certificate.

**1. Scans** - robustness against port-scanning tools. It looks at how the DUT reacts to reconnaissance techniques common in IT environments (TCP SYN/ACK/FIN/Connect/Null/XMAS scans, UDP scan).

**2. Storms** - attempts to exhaust memory and buffer resources with high-speed packet transmission. It adjusts the rate at 10%~100% link utilization, and using **DoS search mode** automatically increases the rate to probe for the threshold value.

**3. Fuzzers** - generate malformed packets with random header values. Being based on a random number generator, both the field selection and the values are random. Powerful, but with the limitation that it is **unsystematic, so coverage cannot be measured**. It typically throws 50,000 or more packets.

**4. Grammars** - systematic, domain-based tests. They sequentially traverse all fields and combinations of a protocol and inject each field with an intelligent fuzz value aimed at common implementation errors. The key difference is that, **unlike a fuzzer, they can achieve quantitative coverage**. (This contrast - how Grammar fills in what random mutation misses - is covered in detail in the [Grammar-based fuzzing article](/en/blog/grammar-based-fuzzing/).)

**5. Data Grammars** - transmit malformed data to the upper layers while keeping the lower layers valid. Size ranges from 0 up to max valid (about 65KB for TCP).

**6. Damage Tests** - slightly mutate the payload to look at sensitivity to things like length-field mismatches.

**7. Response Tests** - throw malformed responses **when the DUT sends requests as a client**, not as a server. They only execute if the DUT sends a set number of requests in a fixed order, and time out if there is no request within 30 seconds. Currently, the Modbus/TCP Client Grammar is representative.

### Fuzzers vs Grammars - Why Both Are Needed

The relationship between these two types reveals the core design philosophy of Achilles.

| Item | Fuzzer | Grammar |
|------|--------|---------|
| Field selection | Random | Sequential traversal |
| Value generation | Random | Valid value + intelligent fuzz value |
| Coverage | Unmeasurable | Quantifiable |
| Strength | Discovers unexpected combinations | Exhaustive field verification |

A Fuzzer is a shotgun that "fires wide but doesn't know what it hit," while a Grammar is a rifle that "aims at every field one by one." Certification demands reproducibility and coverage, so Grammar is central and Fuzzer supplements the combinations the net misses.

### The L1 Test List - 31 Tests, OSI L2~L4 Only

L1 covers only the lower layers of the IP stack (data link ~ transport). It totals 31 tests across six protocols.

| Protocol | Test cases |
|---------|-------------|
| **Ethernet** | Unicast Storm, Multicast Storm, Broadcast Storm, Fuzzer, Grammar |
| **ARP** | Request Storm, Host Reply Storm, Cache Saturation Storm, Grammar |
| **IP** | Unicast Storm, Multicast Storm, Broadcast Storm, Fragmented Storm, Fuzzer, Grammar-Header, Grammar-Fragmentation, Grammar-Options |
| **ICMP** | Storm, Grammar, Type/Code Cross Product |
| **TCP** | Scan Robustness, SYN Storm, LAND Storm, Fuzzer, Grammar |
| **UDP** | Scan Robustness, Unicast Storm, Multicast Storm, Broadcast Storm, Fuzzer, Grammar |

Let's point out just a few of what each layer targets.

- **ARP Host Reply Storm** - pours in ARP Replies that forge the DUT's IP as belonging to a different MAC. It tests ARP-spoofing resistance.
- **ARP Cache Saturation Storm** - continuously changes IP/MAC combinations to saturate the ARP cache.
- **IP Fragmented Storm** - continuously transmits fragmented packets that require reassembly to find the reassembly buffer limits of embedded devices.
- **ICMP Type/Code Cross Product** - exhaustively transmits all valid and invalid Type-Code combinations. It looks at how out-of-range combinations are handled.
- **TCP/IP LAND Storm** - sets src IP = dst IP = DUT and src port = dst port to induce a loop where the DUT responds to itself. A classic DoS technique.

### The 23 L2 Adds - TCP Gets the Thickest

L2 includes all 31 of L1 as-is and adds 23 for a total of 54. The center of gravity of the additions is overwhelmingly TCP.

L1's TCP had 5, but in L2 it swells to 21. A few noteworthy ones:

- **TCP RST Storm** - pours RST flags to forcibly terminate connections.
- **TCP Closed Receive Window Storm** - holds the Window Size at 0 to keep it stuck with transmission blocked.
- **TCP Segment Reassembly Storm** - continuously transmits fragmented segments to exhaust the reassembly buffer.
- **TCP Grammar - Contextually Invalid** - sends packets that don't match the connection state (e.g. ACK without SYN). It targets flaws in state-machine implementations.
- **TCP Maximum Concurrent Connections** - opens about 1,021 concurrent connections and then closes them in reverse order.
- **TCP ISN Randomness Check** - checks the randomness of the initial sequence number (ISN) with the Dieharder statistical test. However, since the ISN must be partly sequential to prevent duplicates (RFC6528), fully random can actually fail. **This test is for informational purposes and does not count as a fail.**

TCP Scan Robustness alone contains seven scan modes (SYN/ACK/FIN/Connect/Null/XMAS/OS·Version Detection). TCP is the protocol with the most complex state machine, so its testing is correspondingly thick.

### What Is Not Subject to Certification

One caution here. **LLDP, IGMP, and IT application protocols like FTP and HTTP are not subject to L1/L2 certification.** Test suites for them do exist (LLDP Saturation, HTTP Header Grammar, etc.) but they are separate optional items. Knowing this boundary is important when reading the coverage of a certificate.

### Common Parameters - The Knobs of Storm and Grammar

Every Storm shares the same knobs.

| Parameter | Value range | Default |
|---------|--------|--------|
| Packet Length | 60 ~ 1514 bytes | 60 (maximum speed) |
| Rate Limit | Off / Limit(pps) / DoS search mode / Global | Global |
| Duration | User-specified / Global | Global |
| Packet Capture | Global / On Anomalies / Never / Always | Global |

The default packet length is 60 bytes because that minimum frame size **maximizes the number of packets per second**. Conversely, if you want to look at the data rate, you grow the frame to 1514 bytes. The practical recommendation is to first find the threshold rate with DoS search mode (increasing 5% at a time), then expand the frame size from 60B → 1514B to distinguish "whether it's a packet-rate bottleneck or a data-rate bottleneck."

Grammar uses different knobs. You specify the range with First/Last Subtest, and turning on **Fault Isolation** performs an automatic binary search on anomaly detection to isolate the subtest that caused the problem. This means you don't have to manually find which of 50,000 subtests caused the crash.

---

## Part 3 - How Control Protocols Are Tested

If IP stack testing looks at "does the network stack stay up," control-protocol testing looks at "does the industrial communication protocol implementation stay up." These tests are provided not as L1/L2 but as **L1+** or as separate suites. They apply the same Storm/Fuzzer/Grammar pattern tailored to each protocol.

### Covered Protocols and Default Ports

| Protocol | Standard | Default port | Test count | Main test types |
|---------|------|---------|---------|----------------|
| **DNP3** | DNP3 Spec | TCP 20000 | 7 | Per-layer Grammar (DL/Transport/App) |
| **EtherNet/IP** | ODVA/CIP | TCP 44818 | 25 | CIP Object Grammar + Exhaustion |
| **FF-HSE** | IEC 61158 | - | 3 | DoS, Grammar, Saturation |
| **GOOSE** | IEC 61850 | Multicast Ethernet | 1 | Request Damage (Grammar) |
| **IEC 104** | IEC 60870-5-104 | TCP 2404 | 5 | APCI + ASDU Grammar |
| **MMS** | IEC 61850 | TCP 102 | 14 | Per-layer Grammar (TPKT/COTP/Session/Init) |
| **Modbus/TCP** | Modbus.org | TCP 502 | 4 | Server Grammar (L1+), Client Grammar (Response) |
| **OPC UA** | IEC 62541 | TCP 4840 | 21 | Per-layer Grammar + Exhaustion |
| **PROFINET** | IEC 61158 Type 10 | - | 19 | DCP Grammar + RT Cyclic/Acyclic |

The interesting thing here is that **the layered structure of the protocol is translated directly into the test structure**. For example, MMS (IEC 61850) has a `TCP → TPKT → COTP → OSI Session → MMS` stack, and testing likewise stacks up per layer as TPKT Grammar → COTP Grammar → Session Grammar → MMS Init Grammar. Each layer's parser gets hammered independently.

### DNP3 - Hammering Each of Three Layers

DNP3 has a master/slave structure and is divided into three layers.

- **Data Link Layer** - addressing and error detection. Start (0x05 0x64), Length, Control, Dst/Src Address, CRC.
- **Transport Function** - fragmentation and reassembly. Fin/Fir/Sequence.
- **Application Layer** - response handling. Application Control, Function Code, Internal Indications.

Testing likewise runs a Grammar against each of these three layers (Data Link Layer Slave Grammar, Transport Function Slave Grammar, Application Layer Slave Grammar, etc.). For each layer, "message structure combinations" and "data payload combinations" are tested separately.

There is one practical trap. DNP3 has explicit Source/Destination addresses, and some DUTs are configured to receive only from a specific source address. So before testing you must capture the VCS-DUT traffic with Wireshark to confirm the actual addresses. On connection failure it retries up to 5 times, and if it still fails, the test is treated as an exception.

### Modbus/TCP - The Only Response Test Is Here

Modbus/TCP has a simple structure with a 1-byte Function Code following an MBAP header (Transaction ID, Protocol ID, Length, Unit Identifier) on TCP 502. There are four tests, and two of the branches are striking.

**Server Grammar (L1+)** - throws combinations of Function Codes 01~17 plus spec-undefined invalid codes. The Function Codes checked include all standard codes such as Read Coils (01), Read Holding Registers (03), Write Single Coil (05), Write Multiple Registers (16), Report Server ID (17), plus invalid codes.

**Client Grammar (Response Test)** - this is the only Response Test mentioned earlier. It only executes when **the DUT connects to Achilles as a client and sends requests in order**. Each Function Code has a required number of requests - for example, FC 0x01~0x04 each require 55 requests, and FC 0x16 requires as many as 1,351 requests from the DUT for all subtests to execute. If there is no request within 30 seconds, it times out. If the DUT is a gateway or protocol converter that acts as a master, this test becomes central.

### GOOSE - Only One, but a World of 4ms

IEC 61850 GOOSE is an ultra-low-latency protocol that must deliver substation events **within 4ms**. It does not use IP and is transmitted directly at L2 over Ethernet multicast. The test is a single one - GOOSE Request Damage - which throws invalid GOOSE PDUs in Grammar fashion. There is only one test because the protocol itself is simple, not because it is low in importance. If a substation protection relay malfunctions on a single tainted GOOSE, that is a blackout.

### OPC UA - Exhaustion Is Half of It

OPC UA (IEC 62541) has a multi-layered stack: UA TCP → UA Secure Conversation → UA Services. A significant number of its 21 tests are **Exhaustion tests** - Incomplete CreateSession Exhaustion, Secure Channel Exhaustion, Session Exhaustion, Monitored Item Exhaustion, Subscription Exhaustion. Because OPC UA is a protocol that maintains many stateful resources such as sessions and subscriptions, the main attack vector is "does keeping incomplete sessions open exhaust resources."

Before each Grammar test, Achilles automatically goes through TCP connection → UA TCP connection → Secure Conversation → Get Endpoints → Create/Activate Session. If any stage fails after 5 retries, it is treated as a Failure. The Browse Request Loop test handles the DUT's Browse requests in a loop structure to target **infinite-loop vulnerabilities**.

### Control-Protocol-Specific Fault Isolation - Quick Mode

Unlike IP stack tests, control-protocol Grammar adds a **Quick mode** to Fault Isolation.

| Mode | Behavior |
|------|------|
| **Disable** | No automatic isolation |
| **Full** | Run everything, then on anomaly detection isolate the problem subtest via binary search |
| **Quick** | Stop immediately on a Test Monitor Failure → if the post-test passes, continue to the next subtest |

Quick mode stops right away when a crash occurs, sees whether the DUT recovers on its own, and then moves on. If it doesn't recover, a DUT restart may be needed. Control protocols often go completely dead across the whole stack once they crash, so this fine-grained control is necessary.

---

## Summary - What Lies Behind the Certificate

Dissecting Achilles certification reveals how much information the sentence "it is certified" actually carries.

- **L1 or L2** - L1 is 31 lower-layer IP stack tests, 2 monitors, a 10% link utilization criterion. L2 is 54 tests, 6 monitors, a VDR-based two-tier criterion. L2 is qualitatively finer.
- **Which protocols are included** - is it IP stack only, or does it include control-protocol suites (L1+) like DNP3, Modbus, and IEC 61850? Without the latter, that device's industrial protocol parsers were not tested.
- **No Failure ≠ perfect** - a certification only guarantees robustness within the defined test suite. LLDP, IGMP, and IT protocols are out of scope from the start, and the unsystematic nature of the Fuzzer leaves coverage gaps.

What Achilles does, in the end, is systematically hammer the network stack and protocol parsers while observing **whether the control signal stays alive** through physical output waveforms. What differs from IT robustness testing is that the verdict criterion is not "service response" but "continuity of control." This idea - putting availability and continuity of control first - connects precisely to the fundamental reason IEC 62443 defines industrial security differently from IT security. Achilles is, in effect, a tool that translates that philosophy into packet-level testing.
