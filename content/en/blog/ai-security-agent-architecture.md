---
title: "AI Security Agent Architecture: From Reconnaissance to Exploitation"
date: 2026-05-23
description: "Architectural design of a hierarchical AI security agent system capable of autonomous vulnerability assessment, from network reconnaissance through exploit validation."
tags: ["AI-Agents", "VoltAgent", "Security", "Architecture", "Multi-Agent-Systems"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Executive Summary

This article explores the architectural design of a sophisticated multi-agent AI system engineered for comprehensive security vulnerability assessment. The system orchestrates a hierarchical supervisor with specialized agents, each optimized for distinct phases of the vulnerability discovery workflow: reconnaissance, hypothesis generation, exploitation, and reporting.

The design exemplifies production-grade patterns including:
- **Hierarchical Agent Control**: Supervisor maintains execution state while specialists operate read-only
- **Layered Architecture**: Clear separation between workflow orchestration, agent logic, tool interfaces, and skill execution
- **Evidence-Driven Decision Making**: Graph-based knowledge accumulation and provenance tracking
- **Guardrail Integration**: Runtime validation at task input, agent output, and cross-agent handoffs

---

## 1. System Overview

### 1.1 Design Goals

The system is engineered to address fundamental challenges in autonomous security assessment:

1. **Reducing False Positives**: Through multi-stage validation with explicit impact confirmation
2. **Maintaining Audit Trail**: Complete provenance tracking from reconnaissance evidence to final findings
3. **Handling Complexity**: Managing diverse target architectures (web, binary, embedded) with unified interfaces
4. **Scale-Aware Safety**: Built-in guardrails to prevent infinite loops, resource exhaustion, and invalid state transitions

### 1.2 Operational Scope

- **Web Targets**: HTTP/HTTPS applications, APIs, authentication mechanisms, sensitive assets
- **Binary Analysis**: ELF binaries, function mapping, memory safety analysis
- **Attack Surface**: SQL injection, cross-site scripting, command injection, CSRF, authentication bypass

---

## 2. Hierarchical Multi-Agent Architecture

### 2.1 System Components

The system is organized into five specialized agents operating under a central Supervisor:

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  Supervisor (HHS: Hierarchical Hybrid System)           │
│  ├─ Orchestrates 4 specialist agents                    │
│  ├─ Manages state transitions via FSM                   │
│  ├─ Commits findings to persistent storage              │
│  └─ Implements workflow gates and guardrails            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ ReconWeb     │  │ VulnInjection │  │ExploitVal.   │  │
│  │ Specialist   │  │ Specialist    │  │Specialist    │  │
│  │              │  │               │  │              │  │
│  │ Phase: HTTP  │  │ Phase: VULN   │  │ Phase: PoC   │  │
│  │ crawling,    │  │ hypothesis    │  │ execution &  │  │
│  │ auth, forms  │  │ testing,      │  │ validation   │  │
│  │              │  │ WAF bypass    │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│                    ┌──────────────────┐                  │
│                    │ Report Specialist │                  │
│                    │                   │                  │
│                    │ Phase: Synthesis  │                  │
│                    │ Risk assessment   │                  │
│                    │ Report generation │                  │
│                    └──────────────────┘                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Agent Specifications

#### Supervisor (HHS)

| Property | Value |
|----------|-------|
| **Model** | Cascade.mid (tuned for coordination) |
| **Max Steps** | 50 |
| **Role** | FSM orchestrator, single write-path (commit_finding) |
| **Exclusive Tools** | commit_finding, write_audit_entry, delegate_task |

**Key Responsibility**: The Supervisor maintains the workflow state machine and serves as the sole interface for persisting findings to the graph database. This ensures a single source of truth and prevents concurrent write conflicts.

**Specialist Management**: 
- Step 1: ReconWebSpecialist (endpoints, auth mechanisms, sensitive assets)
- Step 2: VulnInjectionSpecialist (attack hypotheses with evidence)
- Step 3: ExploitValidatorSpecialist (PoC execution and impact confirmation)
- Step 4: ReportSpecialist (synthesis and risk mapping)

---

#### Reconnaissance Specialist

| Property | Value |
|----------|-------|
| **Model** | Cascade.mid |
| **Max Steps** | 500 |
| **Scope** | HTTP reconnaissance (L0~L4 stack-agnostic) |

**Key Capabilities**:
1. **Multi-Modal Recon**: HTTP fingerprinting, crawling, historical data, brute-force discovery, CVE enrichment
2. **Authentication Probing**: Form-based, bearer token, HTTP Basic, OAuth/MFA detection
3. **Dynamic Tech Stack Detection**: Runtime fingerprinting (PHP/React/Node/.NET) without hardcoded selectors

**Evidence Requirements**: 
- Minimum 3 distinct endpoints identified
- Authentication mechanism confirmed or explicitly marked public-only
- Host information present in responses

**Output**: Structured findings with full provenance trail linking each endpoint to reconnaissance evidence source.

---

#### Vulnerability Injection Specialist

| Property | Value |
|----------|-------|
| **Model** | Cascade.mid |
| **Max Steps** | 500 |
| **Scope** | Attack hypothesis generation |

**Injection Categories**:
- **SQL Injection**: Single quote error patterns (MySQL, MSSQL, Oracle), Boolean-based blind, Time-based blind
- **Cross-Site Scripting**: Reflected (DOM-based), Stored (form submission)
- **Server-Side Template Injection**: `{{7*7}}`, `${7*7}}`, `<%= 7*7 %>` patterns
- **Command Injection**: Shell metacharacters (`;`, `|`, backticks), timing evidence (sleep)

**Input Validation**: Requires authenticated endpoints with full provenance metadata from preceding reconnaissance phase.

**Output Quality Metrics**:
- Analysis coverage ≥80% of provided endpoints
- Reasoning ≥80 characters (explicit hypothesis)
- Confidence scored on evidence basis (low/medium/high)

---

#### Exploit Validator Specialist

| Property | Value |
|----------|-------|
| **Model** | Cascade.mid |
| **Max Steps** | 250 |
| **Scope** | PoC execution and impact confirmation |

**Validation Pipeline**:
1. **Session Preparation**: Establish valid authentication context (if required)
2. **PoC Execution**: Docker sandbox execution with 6 retry attempts
3. **Impact Confirmation**: External validation oracle (SSOT principle)
4. **Request Replay**: Curl reproduction for artifact transparency

**Failure Handling Strategy**:
- **1st Failure**: Analyze failure reason (auth failure, WAF block, timeout)
- **2nd Failure**: Adapt exploit technique (e.g., SQLi: error→union→time-based)
- **3rd Failure**: Escalate category (e.g., XSS: reflected→DOM→stored)
- **≥4 Failures**: Mark exhausted, move to next finding

**Severity Filter**: Only findings with confidence ≥0.7 proceed to validation phase.

---

#### Report Specialist

| Property | Value |
|----------|-------|
| **Model** | Cascade.mid |
| **Max Steps** | 10 |
| **Scope** | Finding synthesis and risk assessment |

**Risk Mapping**:
- **CVSS → Risk Level**: ≥7.0 → High, 4.0-6.9 → Medium, <4.0 → Low
- **KISA Vulnerability Classification**: WEB-05 (SQLi), WEB-08 (XSS), WEB-09 (CSRF), WEB-13 (default)
- **Environmental Context**: WAF detection, authentication probe results, exposed sensitive assets

**Output Format**: Markdown report with minimum 500 characters, vulnerability count, total severity distribution.

---

## 3. Layered Workflow Architecture

### 3.1 Five-Layer Harness Model

The system is structured as a five-layer stack, each with distinct responsibilities:

```
┌──────────────────────────────────────────────────┐
│ L0: Entry Point & HTTP                           │
│ POST /secflow/start → fire-and-forget            │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│ L1: Workflow Orchestration                       │
│ FSM state machine, phase transitions             │
│ Workflow chain construction                      │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│ L2: Agent Layer                                   │
│ Supervisor + 4 Specialist agents                 │
│ LLM inference, tool delegation                   │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│ L3: Tool/Toolkit Interface                       │
│ Docker-in-Docker wrappers                        │
│ Context propagation via Map<string,any>          │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────┐
│ L4: Skill Execution & MCP Servers               │
│ Shell scripts, Python tools                      │
│ httpx, nuclei, ffuf, playwright, IDA Pro        │
└──────────────────────────────────────────────────┘
```

**Key Design Principle**: Each layer has minimal awareness of downstream implementation. L2 agents don't know whether L4 uses curl or httpx; L3 wrappers handle all Docker orchestration details.

### 3.2 Tool Ecosystem

#### Authentication Probing

The system implements a sophisticated multi-phase authentication discovery pipeline:

**Phase 0**: Environmental credentials (if provided)  
**Phase 1**: Nuclei default-login templates (116 built-in patterns)  
**Phase 2**: SQLi-based authentication bypass detection  
**Phase 3**: Capability scatter-gather (forms, JSON APIs, HTTP Basic)  
**Phase 4**: Public-only fallback (when human intervention required)

#### Reconnaissance Tools

| Tool Category | Examples | Purpose |
|---|---|---|
| **HTTP Fingerprinting** | httpx, curl | Service detection, header analysis |
| **Crawling** | Playwright, Katana | URL discovery, endpoint enumeration |
| **Vulnerability Scanning** | Nuclei, Nuclei templates | CVE matching, misconfig detection |
| **Brute Force** | ffuf | Path discovery, parameter enumeration |
| **Historical Data** | Wayback Machine API | Legacy endpoint discovery |

---

## 4. Evidence & Knowledge Management

### 4.1 Structured Data Model

The system maintains a comprehensive graph database (FalkorDB) representing security findings as interconnected nodes:

**Core Node Types**:
- **Web Domain**: Host, Service, Endpoint, Parameter, Form, AuthFlow
- **Binary Domain**: Binary, Function, Section, Symbol
- **Attack Analysis**: AttackVector, Vulnerability, RejectedCandidate
- **Exploit**: ProductionExploit, ValidatedFinding
- **Knowledge**: Lesson (learned patterns), DeadEnd (failed approaches), TargetProfile

**Common Properties** (all nodes):
- `run_id`: Execution session identifier
- `node_id`: Unique node reference
- `created_at`: Timestamp with provenance
- `description`: Human-readable context

### 4.2 Provenance Tracking

Every finding maintains an audit trail:

```
Reconnaissance Evidence
    ↓
    └─ Endpoint {path, method, _provenance: source_tool}
        ↓
        └─ Attack Hypothesis {confidence, evidence[], reasoning}
            ↓
            └─ PoC Execution {test_pov_stdout, test_pov_stderr}
                ↓
                └─ Impact Validation {confirmed: true, cvss: 7.5}
                    ↓
                    └─ Final Report {risk_level, kisa_code, summary}
```

This chain ensures that any finding can be traced back to its original reconnaissance source and all intermediate validation steps.

---

## 5. Guardrail System

### 5.1 Input Validation Guardrails

Each agent implements Zod schema validation at task intake:

**Supervisor Level**:
- FalkorDB connectivity (preflight)
- Target URL within Rules of Engagement scope
- ROE authorization verification

**ReconWebSpecialist Level**:
- ReconWebTaskSchema validation
- Endpoint provenance requirements (for vulnerability injection)
- Scope boundary enforcement

**VulnInjectionSpecialist Level**:
- Task schema Zod validation
- ReconSourceGuard: Ensure all endpoints have provenance metadata
- Evidence density threshold (≥2 independent evidence sources per hypothesis)

**ExploitValidatorSpecialist Level**:
- ExploitValidatorTaskSchema validation (PoC language, target path, expected impact)
- Previous attempt history (max 3, triggers strategy adaptation)

**ReportSpecialist Level**:
- Task schema validation
- PoC confirmation gate: Only report validated findings (impact_confirmed=true)

### 5.2 Output Validation Guardrails

After each agent completes:

- **Finding Schema Validation**: Zod schema enforcement on structured output
- **Evidence Density Check**: Minimum evidence count verification
- **Status Consistency**: Findings marked as "confirmed" only after explicit validation

### 5.3 Anti-Loop Mechanisms

Three-strike rule implementation:

**Same Hypothesis, 3 Consecutive Failures**: Mark exhausted, move to next hypothesis  
**Information Gain Assessment**: If 3 attempts yield zero new information, escalate  
**Stagnation Detection**: Monitor token consumption vs. new findings; trigger pivot on plateau

---

## 6. Workflow State Machine

### 6.1 Phase Transitions

```
START
  │
  ├─► RECON: ReconWebSpecialist discovers endpoints, auth, assets
  │     └─ Output: ReconFinding (kind: "recon")
  │
  ├─► Gate-A: VERIFY mode re-validation (if requested)
  │     └─ Merge provenance metadata
  │
  ├─► VULN: VulnInjectionSpecialist generates hypotheses
  │     └─ Output: HypothesesFinding (kind: "hypotheses")
  │
  ├─► POC: ExploitValidatorSpecialist validates exploitability
  │     ├─ Attempt ≤3: Retry with strategy adaptation
  │     └─ Output: ValidatedFinding (kind: "validated")
  │
  ├─► Gate-B: Evidence density check, 3-strike enforcement
  │
  ├─► REPORT: ReportSpecialist synthesizes findings
  │     └─ Output: ReportFinding (kind: "report")
  │
  └─► COMPLETE: "Analysis complete. RunId: <id>"
```

**Cost Limits**: 60 tool calls, $4.00 budget (tunable via supervisor maxSteps)

---

## 7. Design Patterns & Principles

### 7.1 Capability-Context Separation

LLM-facing parameter schemas exclude system-internal values:

```
// ❌ Avoid: System details mixed with LLM input
{
  target_url: "...",
  run_id: "uuid...",        // ← System noise
  workspace_path: "/data/..." // ← Internal detail
}

// ✅ Correct: Clean LLM input
{
  target_url: "...",
  mode: "normal"
}

// System values injected separately
const context = new OperationContext();
context.set("run_id", runUuid);
context.set("workspace", workspacePath);
```

This ensures LLM attention remains on security logic rather than infrastructure plumbing.

### 7.2 Single Write-Path Pattern

Only the Supervisor directly writes findings to persistent storage. Specialists signal intent; Supervisor executes. This prevents:
- Concurrent write conflicts
- Orphaned or duplicate records
- State inconsistency

### 7.3 Stack-Agnostic Design

No hardcoded selectors, timeouts, or credentials in agent code. Authentication probing is driven by runtime configuration that adapts to detected technology stacks.

---

## 8. Operational Considerations

### 8.1 Environmental Isolation

All tool execution occurs in Docker containers with explicit isolation:

- **Network Isolation**: Dedicated Docker network per run
- **Volume Labels**: Metadata-driven container management
- **Workspace Mounting**: Host path explicitly mapped for artifact collection

### 8.2 Timeout Management

Multi-level timeout hierarchy ensures bounded execution:

| Level | Scope | Example |
|-------|-------|---------|
| **Tool Level** | Individual subprocess | Curl with 15-second max |
| **Wrapper Level** | Docker container | Playwright timeout 30s |
| **Specialist Level** | Agent.maxSteps enforcement | VulnInjectionSpecialist: 500 steps |
| **Supervisor Level** | Entire run | Supervisor: 50 steps, $4.00 budget |

### 8.3 Resource Constraints

**Parallel Execution Limits**:
- Authentication workers: 10 concurrent threads
- ThreadPool for form discovery: 10 workers
- Vulnerability scanner concurrency: 25 (rate-limited to 50/sec)

**Early Termination Conditions**:
- Human intervention required (MFA/CAPTCHA/OAuth): Stop auth probing, continue public reconnaissance
- Cost budget exhausted: Immediately halt all operations
- Evidence threshold met: Skip remaining hypotheses if confidence threshold reached

---

## 9. Lessons & Trade-offs

### 9.1 Anti-Patterns Avoided

**❌ Monolithic Agent**: Single LLM making all decisions → context overload, poor parallelization  
**✅ Hierarchical Delegation**: Supervisor coordinates, specialists focus → clear responsibilities

**❌ Direct Shell Commands**: Subprocess execution without sandboxing → security risk  
**✅ Docker-in-Docker**: Controlled execution environment with audit trail

**❌ Shared Mutable State**: Agents modifying common data structures → race conditions  
**✅ Read-Only Specialists**: Only Supervisor writes; specialists signal intent

### 9.2 Performance Trade-offs

**Latency**: Multi-phase validation adds wall-clock time but improves accuracy  
**Cost**: Larger token consumption for structured outputs vs. efficiency of freeform text  
**Complexity**: Explicit state management vs. implicit LLM reasoning

The design prioritizes **correctness and auditability** over raw speed, acknowledging that security assessments benefit more from thorough analysis than rapid iteration.

---

## 10. Conclusion

This architecture demonstrates that sophisticated, autonomous security assessment requires more than a single capable LLM. The system's strength derives from:

1. **Clear Role Separation**: Each agent has a focused responsibility
2. **Explicit Guarantees**: Guardrails enforce invariants at every boundary
3. **Provenance Integrity**: Complete audit trail enables forensic analysis
4. **Graceful Degradation**: Fallback paths handle adversarial conditions
5. **Tunable Safety**: Cost limits and timeout hierarchies prevent runaway behavior

This design pattern—hierarchical delegation with read-only specialists and a centralized coordinator—offers a reusable blueprint for building trustworthy, autonomous AI systems in security-critical domains.

---

## References

- VoltAgent Framework: Multi-agent workflow orchestration
- FalkorDB: Graph database for security knowledge representation
- Nuclei: Template-based vulnerability scanner
- OWASP Testing Guide: Manual security assessment methodology
- CVSS v3.1: Common Vulnerability Scoring System

---

*This architecture represents the synthesis of offensive security, distributed systems, and software engineering principles. Production deployment requires careful consideration of organizational risk tolerance and operational constraints.*
