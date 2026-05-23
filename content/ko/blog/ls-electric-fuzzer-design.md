---
title: "Fuzzer Design for LS Electric PLC Protocol Analysis"
date: 2022-01-15
description: "A comprehensive approach to black-box fuzzing of LS Electric PLC systems using XGT protocol analysis, featuring automated mutation strategies, crash triage, and monitoring infrastructure for vulnerability discovery in industrial control systems."
tags: ["fuzzing", "PLC", "ICS", "OT", "embedded", "LS-Electric", "protocol", "vulnerability-research"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Introduction

Operational Technology (OT) and Industrial Control Systems (ICS) play a critical role in monitoring and controlling production facilities and processes in industrial environments. Traditionally, OT/ICS systems operated in isolated, closed-network environments. However, with Industry 4.0 and the acceleration of digital transformation in manufacturing, the convergence of OT/ICS and IT systems is rapidly advancing.

Legacy OT/ICS systems comprised specialized hardware and software such as PLCs (Programmable Logic Controllers), DCS (Distributed Control Systems), and SCADA (Supervisory Control and Data Acquisition) systems with limited functionality. Today, with the advancement of Industrial Internet of Things (IIoT) technology, OT/ICS systems are becoming increasingly intelligent and connected. Sensors and actuators are networked together, enabling real-time data collection and analysis. This facilitates real-time equipment monitoring, predictive maintenance, and process optimization, significantly enhancing manufacturing efficiency and flexibility.

With integration of advanced ICT technologies—edge computing, cloud, big data, and AI—OT/ICS systems are becoming smarter. Large-scale industrial data can now be effectively stored, processed, and analyzed, and machine learning techniques enable predictive failure detection and automated parameter optimization. Thus, OT/ICS systems are evolving beyond simple control functions to become intelligent platforms supporting data-driven decision-making on the manufacturing floor.

## Background and Research Motivation

PLCs are essential devices in industrial automation systems, widely deployed across manufacturing, energy, infrastructure, and other sectors. According to Market Research Guru, the global PLC market was valued at $47.75 billion in 2022 and is projected to reach $264.55 million by 2028.

However, as the number of deployed PLC devices increases, security vulnerabilities pose growing risks. Claroty's Team82 research group demonstrated critical vulnerabilities in OPC-UA (Open Platform Communications Universal Architecture)—a universal protocol for synchronizing OT devices—earning $98,500 in prize money at Pwn2Own Miami 2023. Additionally, security firm NSFOCUS presented fuzzing results on the S7CommPlus_TLS protocol used in Siemens PLCs at BlackHat, highlighting ongoing security concerns.

In response to escalating OT/ICS security threats, organizations are increasingly adopting the IEC-62443 international standard for Industrial Automation and Control Systems (IACS) cybersecurity. IEC-62443 provides security requirements and guidelines for control systems, networks, and devices in industrial environments, enhancing organizations' ability to respond to cyber threats. Many manufacturers are pursuing IEC-62443 certification to improve product competitiveness and security. PLCs are a key application target, requiring design compliance with IEC-62443-4-2 product security requirements and adherence to IEC-62443-3-3 patch management guidelines.

**Fuzzing** offers a systematic approach to automated vulnerability discovery. This technique injects randomly generated inputs into target software to trigger abnormal behavior or vulnerabilities. By identifying unexpected exceptions and security flaws, fuzzing enables continuous testing and security review throughout the Software Development Life Cycle (SDLC), allowing early detection and remediation of vulnerabilities.

However, PLCs present unique challenges. Manufacturers typically restrict access to internal structure, operational details, source code, and other critical information. This prevents white-box fuzzing approaches that analyze internal structure and generate informed inputs. Instead, we must rely on black-box fuzzing—generating random inputs without knowledge of internal implementation. While less efficient than white-box approaches, black-box fuzzing can still effectively discover potential vulnerabilities when focused on critical communication functionality.

LS Electric PLCs support multiple communication protocols: XGT (proprietary), RAPIEnet (standard), Modbus (universal), and OPC-UA, all managed through the XG5000 software suite. This research focuses on designing a systematic fuzzer to test the XGT protocol implementation and discover potential vulnerabilities in these PLC systems.

## Fuzzer Architecture and Design

A PLC fuzzer consists of three main components: **Input**, **Fuzzer Engine**, and **Output**.

### 3.1 Environment Setup

To operate the fuzzer, the PLC environment must be properly configured. The setup requires:
- PLC device (e.g., XGI-CPUZ)
- Base module
- Power supply module
- XG5000 software

The XGI-CPUZ model has integrated communication modules, eliminating the need for external communication modules.

#### System Initialization and Reset

A critical aspect of fuzzing is returning the PLC to a known state after each test. In NSFOCUS's research, a Power Control Unit (PCU) managed PLC power cycling. The XGI-CPUZ includes an internal Power Backup Module (PBM) that enables warm restart functionality without full power cycle.

![PLC Setup Configuration](/images/blog/ls-electric-fuzzer/setup.png)

After fuzz testing, warm restart:
- Terminates power cleanly
- Reinitializes default, initialization, and retained variables
- Restores the PLC to the baseline state
- Prepares for the next test cycle

![PLC Warm Restart Process](/images/blog/ls-electric-fuzzer/restart.png)

### 3.2 Input Generation

The fuzzer receives XGT protocol packet files as input. The process involves:

1. **Seed Collection**: Capture legitimate XGT protocol packets from normal PLC operations (mutation base)
2. **Mutation**: Apply mutation strategies to seed packets
3. **Protocol Repair**: Fix XGT-specific protocol requirements after mutation

#### XGT Protocol Header Structure

The XGT protocol consists of a Header followed by Command and Data sections:

| Field | Size (Bytes) | Content |
|-------|--------------|---------|
| Company ID | 10 | "LSIS-GLOFA" (ASCII: 4C 47 49 53 2D 47 4C 4F 46 41) |
| PLC Info | 2 | CPU type, redundancy status, operation status, system state |
| CPU Info | 1 | Series identification (XGK: 0xA0, XGB: 0xB0, XGI: 0xA4, XGR: 0xA8) |
| Source of Frame | 1 | Direction (Client→Server: 0x33, Server→Client: 0x11) |
| Invoke ID | 2 | Frame sequencing ID (echoed in response) |
| Length | 2 | Command structure byte size |
| Ethernet Position | 1 | Module slot and base numbers |
| Reserved (BCC) | 1 | 0x00; Byte sum checksum for integrity |

**Critical implementation details**:
- The Data field undergoes mutation while the Header remains relatively stable
- After mutation, Length and BCC (Block Check Character) must be recalculated to maintain protocol integrity
- Seed packets should focus on specific PLC functionality rather than comprehensive coverage

### 3.3 Fuzzer Engine

The fuzzer engine employs a feedback-driven mutation strategy:

#### Mutation Strategy

Two primary fuzzing algorithms are leveraged:

**AFL (American Fuzzy Lop)**:
- Uses genetic algorithms for input generation
- Implements coverage-guided fuzzing
- Maintains code coverage metrics
- Tracks control flow changes
- Identifies unique crashes through instrumentation
- Gradually expands the testing space

**Radamsa**:
- Originally developed for software stress testing
- Employs completely random mutation
- Useful for discovering edge cases and unexpected behaviors
- Complements AFL's coverage-guided approach

**Hybrid Approach**: Combine both algorithms to achieve comprehensive fuzzing coverage—AFL for targeted exploration of high-coverage paths, Radamsa for discovering unexpected failure modes.

#### Fuzzing Workflow

1. **Packet Generation**: Create XGT packets with appropriate headers for each command type
2. **Mutation**: Apply AFL/Radamsa mutation strategies to test cases
3. **Protocol Repair**: Parse mutated packets and recalculate Length and BCC fields
4. **Transmission**: Send test case to PLC
5. **Status Monitoring**: Check PLC operational status
6. **Response Handling**:
   - **Normal**: Record successful test, proceed to next case
   - **Abnormal**: Log crash details, generate crash file, trigger PLC restart
7. **Recovery**: Initialize PLC to baseline state via warm restart
8. **Iteration**: Continue with next mutation cycle

### 3.4 Output and Crash Analysis

#### Crash Collection and Triage

When fuzz testing discovers a crash, the output system captures:
- Triggering input packet
- PLC state information
- Timestamp and context

**Triage Process**: Crashes are analyzed and classified by severity:
- **Denial of Service (DoS)**: Highest priority—causes PLC unavailability
- **Memory Corruption**: Potential code execution vector
- **Logic Errors**: May cause incorrect control behavior

#### Data Storage and Monitoring

Triaged crashes are stored in a database for centralized management. A web-based monitoring dashboard provides:

- Real-time fuzzer status
- Crash count and trends
- Severity distribution
- Affected protocol commands
- Time-series analytics

![Fuzzer Architecture and Workflow](/images/blog/ls-electric-fuzzer/architecture.png)

The complete fuzzer workflow:
1. **Packet Generation**: Build headers for target XGT commands
2. **Request Transmission**: Send test cases to PLC via network
3. **Response Capture**: PLC responds and begins restart sequence
4. **Feedback Learning**: Fuzzer learns from response data to improve coverage
5. **Iteration**: Refine mutation strategy based on discovered crashes

## Implementation Considerations

### Coverage Strategy

Rather than attempting comprehensive protocol coverage, focus on high-impact functionality:
- Device read/write operations
- Configuration commands
- Diagnostic queries
- State management functions

This focused approach maximizes vulnerability discovery efficiency within computational constraints.

### Protocol-Specific Optimization

XGT protocol implementation requires careful handling:
- **Length Field**: Must accurately reflect Command + Data size
- **BCC Calculation**: Byte-sum checksum across application header
- **Invoke ID**: Critical for request-response correlation
- **Command Variants**: Different commands have distinct Data structures

Automated packet parsing and repair mechanisms are essential to maintain protocol validity across mutations.

### State Management

PLC state directly affects fuzzing effectiveness:
- Certain commands may only be valid in specific operational states
- State transitions can reveal hidden code paths
- Warm restart ensures deterministic reset between tests

## Conclusion

The systematic fuzzing of LS Electric PLC systems—particularly the XGT protocol—represents a critical step toward improving OT/ICS security. By employing a combination of genetic and random mutation strategies within a controlled environment, this approach can systematically discover potential vulnerabilities that might otherwise remain hidden.

The black-box nature of this fuzzer acknowledges practical constraints while still providing comprehensive protocol coverage through focused testing. The integration of automated crash triage and centralized monitoring enables efficient vulnerability management and remediation prioritization.

As industrial systems become increasingly connected and critical to infrastructure, systematic security validation approaches like this fuzzer are essential components of modern OT/ICS security practices and IEC-62443 compliance initiatives.

## Future Research Directions

- Extension to additional LS Electric protocols (RAPIEnet, Modbus)
- Implementation of differential fuzzing against protocol specifications
- Integration of symbolic execution for constraint solving
- Development of exploit generation from crash artifacts
- Cross-vendor protocol comparison and standardization efforts
