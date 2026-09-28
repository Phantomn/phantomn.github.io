---
title: Fuzzer Design for LS Electric PLC Protocol Analysis
date: 2022-01-15T00:00:00.000Z
excerpt: >-
  A draft design for blackbox fuzzing of the LS Electric PLC system, built on analysis of the
  XGT protocol. Covers automated mutation strategy, crash triage, and the monitoring
  infrastructure for discovering vulnerabilities in industrial control systems.
tags:
  - fuzzing
  - plc
  - ics
  - ot
  - embedded
  - ls-electric
  - protocol
  - vulnerability-research
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## 1. Introduction

OT (Operational Technology) and ICS (Industrial Control System) are umbrella terms for the technologies used to monitor and control production equipment and processes on industrial sites. Traditionally, OT/ICS systems operated independently within closed network environments. However, as the digital transformation of manufacturing accelerates through Industry 4.0 and smart factory initiatives, OT/ICS systems are increasingly converging with IT systems.

In the past, OT/ICS systems consisted of special-purpose hardware and software such as PLCs (Programmable Logic Controllers), DCS (Distributed Control Systems), and SCADA (Supervisory Control and Data Acquisition), performing limited functions. Recently, however, advances in Industrial Internet of Things (IIoT) technology have driven a trend toward more intelligent, more connected OT/ICS systems. A variety of industrial devices — sensors, actuators — are now network-connected, capable of collecting and analyzing data in real time. This enables real-time monitoring of equipment status, predictive maintenance, and process optimization, substantially improving the efficiency and flexibility of manufacturing operations.

Furthermore, by integrating with advanced ICT technologies such as edge computing, cloud, big data, and AI, OT/ICS systems are becoming even smarter. Infrastructure capable of effectively storing, processing, and analyzing large-scale industrial data is being built, and innovative services are becoming possible — such as predicting equipment failures in advance using machine learning, or automatically optimizing process parameters. In this way, OT/ICS systems are evolving, through convergence with ICT technology, beyond simple control functions into platforms that support intelligent decision-making based on data from the manufacturing floor.

## 2. Background and Research Motivation

The PLC is a control device that plays a central role in industrial automation systems, widely used across manufacturing, energy, infrastructure, and many other fields. According to the market research firm Market Research Guru, the global PLC market was valued at $477.5 billion in 2022 and is projected to reach $264.55 million by 2028.

However, alongside the growth in the number of PLC devices, problems arising from security vulnerabilities continue to be reported. Team82, the research team at OT/ICS security firm Claroty, disclosed a serious vulnerability in OPC-UA (Open Platform Communications Universal Architecture) — a general-purpose protocol used to synchronize various OT devices — at Pwn2Own Miami 2023, earning a total of $98,500 in prize money. Security firm NSFOCUS also presented at Black Hat after fuzzing the S7CommPlus_TLS protocol used in Siemens PLCs.

As multiple companies continue to raise security vulnerabilities in PLCs, efficient vulnerability detection methods are also being actively researched. Furthermore, as OT/ICS security threats increase, many companies are striving to comply with the international standard **IEC-62443**. IEC-62443 is an international standard addressing the cybersecurity of Industrial Automation and Control Systems (IACS), aiming to improve cybersecurity threat response capability by providing security requirements and guidelines for control systems, networks, and devices used in industrial environments. Many manufacturers seek IEC-62443 certification to boost both export competitiveness and the security of their products. PLCs, too, must either be designed based on the product security requirements of IEC-62443-4-2, or have discovered vulnerabilities promptly remediated in accordance with the patch management guidance of IEC-62443-3-3.

**Fuzzing** provides a systematic approach to automated vulnerability discovery. This technique injects randomly generated input into a target piece of software to trigger abnormal behavior or vulnerabilities. This allows developers to effectively identify unexpected exceptions or security vulnerabilities, enabling early discovery and remediation of vulnerabilities through continuous testing and security review throughout the SDLC (Software Development Life Cycle).

However, in the case of PLCs, a great deal of information — internal structure, operating principles, source code — is restricted by the manufacturer, making **whitebox fuzzing**, which generates input by analyzing the software's internal structure, impossible. As a result, we're forced to rely on **blackbox fuzzing**, which generates input randomly without internal structure or source code, and it's unavoidable that this is less efficient than whitebox fuzzing.

LS Electric PLCs support a variety of protocols, including their proprietary XGT protocol, the standard RAPIEnet protocol, and general-purpose protocols such as Modbus and OPC-UA. The XG5000 software is used to manage these protocols. This research focuses on the systematic design of a fuzzer to test the XGT protocol implementation and discover potential vulnerabilities in the PLC system.

## 3. Design

Developing a PLC fuzzer requires design at each stage. A fuzzer broadly consists of three components: **input**, **fuzzer engine**, and **output**.

### 3.0 Environment Setup

To run the fuzzer, the PLC environment must first be configured. The following is required to run the PLC:

- PLC device (e.g., XGI-CPUZ)
- Base module
- Power module
- XG5000 software

For the XGI-CPUZ, the communication module is built in, so no separate external communication module is needed.

![PLC environment setup (XGI-CPUZ, base module, power module)](/images/blog/ls-electric-fuzzer/setup.png)

#### System Initialization and Reset

A key aspect of fuzzing is returning the PLC to a known state after each test. In NSFOCUS's research, a PCU (Power Control Unit) controlled the PLC's power. For the XGI-CPUZ, a PBM (Power Backup Module) exists inside the PLC device itself. Accordingly, after fuzz testing, the **Warm Restart** feature is used to power down and then restart the PLC according to user-defined data and the user program.

When a warm restart executes:
- It shuts down power normally
- It resets default, initialization, and retain variables
- It restores the PLC to a baseline state
- It prepares for the next test cycle

![PLC initialization process via warm restart](/images/blog/ls-electric-fuzzer/restart.png)

### 3.1 Input Generation

The data fed into the fuzzer is an XGT protocol packet file to be sent to the PLC. The process is as follows:

1. **Seed collection**: capture legitimate XGT protocol packets from normal PLC operation (mutation-based)
2. **Mutation**: apply a mutation strategy to the seed packets
3. **Protocol correction**: after mutation, recompute the XGT-specific protocol requirements

#### XGT Protocol Header Structure

The XGT protocol is divided into a Header and Command + Data. The header structure is as follows:

| Field | Size (Bytes) | Content |
|------|-----------|------|
| Company ID | 10 | "LSIS-GLOFA" (ASCII: 4C 47 49 53 2D 47 4C 4F 46 41) |
| PLC Info | 2 | Client -> Server: ignored (0x00) / Server -> Client: CPU type, redundancy status, operating status, system status |
| CPU Info | 1 | Series identifier (XGK: 0xA0, XGB(MK): 0xB0, XGI: 0xA4, XGB(IEC): 0xB4, XGR: 0xA8) |
| Source of Frame | 1 | Direction (Client -> Server: 0x33, Server -> Client: 0x11) |
| Invoke ID | 2 | ID used to distinguish the order between frames (this number is attached and sent back in the response frame) |
| Length | 2 | Byte size of the command structure |
| Ethernet Position | 1 | Bits 0-3: slot number of the Ethernet module / Bits 4-7: base number of the Ethernet module |
| Reserved 2 (BCC) | 1 | 0x00: reserved area (byte sum of the Application Header) |

**Key implementation points**:
- Mutate the Data field while keeping the Header relatively stable
- Length and BCC (Block Check Character) must be recomputed after mutation to preserve protocol integrity
- Seed packets should focus on specific PLC functions rather than comprehensive coverage

### 3.2 Fuzzer Engine

What matters in the fuzzer engine is the strategy for which parts to mutate and how.

#### Mutation Strategy

Two main fuzzing algorithms are used:

**AFL (American Fuzzy Lop)**:
- Uses a genetic algorithm for input generation
- Implements coverage-guided fuzzing
- Maintains code coverage metrics
- Tracks control flow changes
- Identifies unique crashes through instrumentation
- Progressively expands the test space

**Radamsa**:
- A tool developed for software load testing
- Applies purely random mutation
- Useful for discovering edge cases and unexpected behavior
- Complements AFL's coverage-guided approach

**Hybrid approach**: combining both algorithms achieves comprehensive fuzzing coverage. AFL is used to target high-coverage paths, while Radamsa is used to discover unexpected failure modes.

#### Fuzzing Workflow

1. **Packet generation**: construct a packet by generating an XGT header suited to each command type
2. **Mutation**: apply AFL/Radamsa mutation strategies to the test case
3. **Protocol correction**: parse the mutated packet and recompute the Length and BCC fields
4. **Transmission**: send the test case to the PLC
5. **State monitoring**: check the PLC's operating status
6. **Response handling**:
   - **Normal**: log a successful test, proceed to the next case
   - **Abnormal**: log crash details, generate a crash file, trigger a PLC restart
7. **Recovery**: reset the PLC to a baseline state via warm restart
8. **Repeat**: proceed to the next mutation cycle

### 3.3 Output and Crash Analysis

#### Crash Collection and Triage

When a crash is found during fuzz testing, the output system captures:
- The triggering input packet
- PLC state information
- Timestamp and context

**Triage process**: crashes are classified by severity:
- **Denial of Service (DoS)**: highest priority — renders the PLC unusable
- **Memory corruption**: a potential code execution vector
- **Logic errors**: may cause incorrect control behavior

#### Data Storage and Monitoring

Triaged crashes are stored in a database for centralized management. A web-based monitoring dashboard provides:

- Real-time fuzzer status
- Crash count and trends
- Severity distribution
- Affected protocol commands
- Time-series analysis

![Overall PLC fuzzer architecture (packet generation -> transmission -> state monitoring -> crash logging -> reset)](/images/blog/ls-electric-fuzzer/architecture.png)

Overall fuzzer workflow:
1. **Packet generation**: construct a header suited to the target XGT command
2. **Send request**: send the test case to the PLC over the network
3. **Capture response**: receive the PLC's response and initiate the restart sequence
4. **Feedback learning**: the fuzzer learns from response data to improve coverage
5. **Repeat**: refine the mutation strategy based on discovered crashes

## 4. Implementation Considerations

### Coverage Strategy

Focus is placed on high-impact functionality rather than comprehensive protocol coverage:
- Device read/write operations
- Configuration commands
- Diagnostic queries
- State management functions

This focused approach maximizes vulnerability discovery efficiency within computational constraints.

### Protocol-Specific Optimizations

Implementing the XGT protocol requires careful handling:
- **Length field**: must accurately reflect the Command + Data size
- **BCC calculation**: a byte-sum checksum over the Application Header
- **Invoke ID**: critical for request-response correlation
- **Command variants**: different commands each have different Data structures

Automated packet parsing and correction mechanisms are essential to maintain protocol validity across mutations.

### State Management

PLC state directly affects fuzzing efficiency:
- Certain commands may only be valid in certain operating states
- State transitions can reveal hidden code paths
- Warm restart ensures a deterministic reset between tests

## 5. Conclusion

Systematic fuzzing of LS Electric PLC systems, and the XGT protocol in particular, is an important step toward improving OT/ICS security. Combining genetic mutation and purely random mutation strategies within a controlled environment allows for the systematic discovery of potential vulnerabilities that might otherwise remain hidden.

This fuzzer's blackbox nature acknowledges real constraints while still providing comprehensive protocol coverage through focused testing. The integration of automated crash triage with centralized monitoring enables efficient vulnerability management and priority-based remediation.

As industrial systems become increasingly connected and critical to infrastructure, systematic security validation approaches like this fuzzer are an essential component of modern OT/ICS security practice and IEC-62443 compliance initiatives.

## 6. Future Research Directions

- Extension to additional LS Electric protocols (RAPIEnet, Modbus)
- Implementation of differential fuzzing against protocol specifications
- Integration of symbolic execution for constraint solving
- Development of exploit generation from crash artifacts
- Cross-vendor protocol comparison and standardization research
