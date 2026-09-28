---
title: 'AI Security Agent Architecture: From Reconnaissance to Exploitation'
date: 2026-05-23T00:00:00.000Z
excerpt: >-
  The architecture of a hierarchical multi-agent system that performs autonomous vulnerability
  assessment, from network reconnaissance to exploit validation. Seven specialists, a five-phase
  workflow, and the confirmation oracle, execution isolation, and RoE reference monitor that pull
  the judgment authority out of the model.
tags:
  - ai-agents
  - voltagent
  - security
  - architecture
  - multi-agent-systems
  - vulnerability-research
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

This covers the architecture of a multi-agent system that autonomously performs a comprehensive security vulnerability assessment. A hierarchical supervisor orchestrates several specialist agents, and each specialist handles a different phase of the vulnerability-discovery workflow — reconnaissance, source analysis, hypothesis generation, exploit validation, bypass enhancement, and reporting.

This article has two axes. **(1) The hierarchical delegation structure** — it handles multi-step security assessments that a single monolithic agent cannot manage, through role separation. **(2) The externalization of judgment authority** — judgments like "is this vulnerability real," "has exploration stagnated," and "is this action within the rules of engagement" are made not by an LLM narrative but by a deterministic oracle and reference monitor. The second axis stands on the same principle as [Harness Design That Pulls LLM Completion Bias Out of the Model](/en/blog/deterministic-completion-gate-harness/).

The production-grade patterns it implements:

- **Hierarchical agent control**: the supervisor holds the execution state, and specialists operate read-only and signal intent.
- **Layered architecture**: workflow orchestration, agent logic, tool interface, and execution isolation are clearly separated.
- **Evidence-based confirmation**: graph-based knowledge accumulation + provenance tracking. Confirmation is done by a negative-control comparison, not by a "200 OK."
- **Deterministic safety boundaries**: guardrails, the confirmation oracle, and the RoE reference monitor enforce invariants at runtime.

## 1. System Layer Overview

The system consists of 6 layers. Each layer has only minimal awareness of the downstream implementation.

```
┌──────────────────────────────────────────────────┐
│ L0: Entry point — HTTP trigger (fire-and-forget)  │
├──────────────────────────────────────────────────┤
│ L1: Orchestration — Supervisor + WorkflowChain    │
│     FSM state machine, phase transitions          │
├──────────────────────────────────────────────────┤
│ L2: Agents — Supervisor + 7 Specialists           │
│     LLM reasoning, tool delegation                 │
├──────────────────────────────────────────────────┤
│ L3: Tools — MCP servers + built-in tools          │
│     context propagation, execution wrapping        │
├──────────────────────────────────────────────────┤
│ L4: Confirmation/Safety — Guardrail · Oracle · RoE monitor │
├──────────────────────────────────────────────────┤
│ L5: State/Isolation — Schema SSOT · Memory · Sandbox │
└──────────────────────────────────────────────────┘
```

Core principle: **L2 agents do not know which tools L4 uses.** The L3 wrapper handles execution details, and the agent focuses solely on security logic. This ignorance is what makes each layer independently replaceable.

## 2. Agent Composition

### 2.1 The Supervisor and 7 Specialists

The supervisor (a hierarchical hybrid system, HHS) acts as the FSM orchestrator and is **the sole interface that records findings to persistent storage**. This single write path fundamentally blocks concurrent write conflicts and orphan records.

| Agent | Role |
|----------|------|
| **Supervisor (HHS)** | FSM orchestrator, single write path (commit_finding), delegation |
| **ReconWeb** | HTTP reconnaissance — endpoint/auth/asset discovery |
| **ReconBinary** | Binary reconnaissance — function/section/symbol mapping |
| **VulnInjection** | Evidence-based attack hypothesis generation |
| **InjectionExploit** | PoC execution and impact confirmation |
| **BypassEnhancement** | WAF/filter bypass enhancement |
| **SourceAnalyst** | Static analysis when source code is leaked |
| **Report** | Findings synthesis and risk assessment |

Each specialist has a **focused context**. The reconnaissance agents do not make vulnerability judgments and only record observations — classification is the orchestrator's job (preventing context pollution).

### 2.2 Delegation Flow

The supervisor does not call specialists directly but **delegates**. A specialist performs the task and returns structured output, only signaling the intent "record this finding" rather than writing directly. The supervisor takes that intent, validates it, and commits.

This read-only specialist pattern prevents three things — concurrent write conflicts, duplicate records, and state inconsistency.

## 3. Workflow (5-Phase)

```
Start
  │
  ├─► Phase 1  RECON
  │     ReconWeb/ReconBinary surface findings → ReconFinding
  │
  ├─► Phase 1.6  SOURCE LEAK (optional)
  │     On source-leak detection, SourceAnalyst does static analysis
  │
  ├─► Phase 2  VULN HYPOTHESIS
  │     VulnInjection generates evidence-based hypotheses → HypothesesFinding
  │
  ├─► Phase 3  POC VALIDATION
  │     InjectionExploit runs/confirms PoCs in a sandbox
  │     ├─ On failure, adapt strategy (error → union → time-based …)
  │     └─► ValidatedFinding
  │
  ├─► Phase 3.5  GATE-B / 3-STRIKE
  │     Check evidence density, apply the 3-consecutive rule
  │
  └─► Phase 4  REPORT
        Report synthesizes findings, maps risk → done
```

### 3.1 Reconnaissance — Stack-Agnostic Fingerprinting

Reconnaissance detects the technology stack via runtime fingerprinting, with no hardcoded selectors. Auth discovery is a multi-stage pipeline — provided credentials → default login templates → auth-bypass detection → feature-surface collection → public-only fallback. At points that require human intervention (MFA/CAPTCHA/OAuth), it stops the auth probe and continues only public reconnaissance.

### 3.2 Hypothesis Generation — Evidence Density Threshold

Vulnerability hypotheses are not made without grounds. Each hypothesis requires **at least 2 independent evidence sources per hypothesis** and rates confidence (low/medium/high) on an evidence basis. Only hypotheses that exceed the confidence threshold proceed to the validation phase.

### 3.3 Exploit Validation — Strategy Adaptation

PoCs run in an isolated sandbox, and on failure the strategy is changed in stages.

- **1st failure**: root-cause analysis (auth failure / WAF block / timeout)
- **2nd failure**: technique adjustment within the same class (SQLi: error → union → time-based)
- **3rd failure**: class escalation (XSS: reflected → DOM → stored)
- **4th or more**: mark as exhausted, move to the next finding

### 3.4 Reporting — CVSS and KISA Mapping

Only confirmed findings pass to the reporting phase. The Report specialist quantifies each finding with CVSS and maps it to a risk level.

- **CVSS → risk level**: 7.0 or above → high, 4.0~6.9 → medium, below 4.0 → low

For domestic (Korean) web vulnerability assessment practice, it also maps to the **KISA web vulnerability classification** — e.g. SQL injection (WEB-05), XSS (WEB-08), CSRF (WEB-09). By attaching both an international standard (CVSS) and the domestic regulatory scheme, findings can be immediately digested in whichever framework is in use. It also adds environmental context (whether a WAF was detected, auth-probe results, exposed sensitive assets) to raise the report's practical usefulness.

## 4. Confirmation Architecture — Judgment Outside the Model

What sets this system apart is that **it does not give judgment authority to the LLM**. "Is it vulnerable," "has it stagnated" is answered by deterministic code, not by the model's narrative.

### 4.1 Guardrails — Schema Enforced at Every Boundary

Guardrails are registered in a registry and run at every agent input/output boundary.

- **Input guardrails**: task schema validation, provenance-metadata completeness (Gate-A), evidence-density threshold
- **Output guardrails**: finding-schema enforcement, "confirmed" shown only after explicit validation
- **PoC confirmation gate (Gate-B)**: only findings with `impact_confirmed=true` are promoted to a report

The key is that **a guardrail is an independent oracle, not an SSOT consumer**. If you fetch the value to be validated from the validation target itself, you can't see the pollution — the guardrail judges from the outside.

### 4.2 Confirmation Oracle — Canary and Stagnation Detection

There are two kinds of oracle.

**Canary oracle.** To confirm that an exploit actually had an impact, merely seeing data in the response is not enough (a "200 OK" is just a data return). Instead, at execution time it **mints a canary value** and injects it, and confirms by whether that specific canary comes back. If a no-payload control fires the same pattern, it is downgraded — the negative-control principle.

**Stagnation oracle.** If an agent circles the same spot, it just burns tokens. It accumulates the response history as a hash (FNV-1a), and if there is no new information within a given window (default 5), it judges stagnation and triggers a transition. It detects "repeating attempts with no new findings" through history-based determinism, not the model's self-judgment.

### 4.3 3-Strike / Anti-Loop

If the same hypothesis fails 3 times in a row, it is marked as exhausted and moves on. Information-gain evaluation (escalate if there is no new information in 3 attempts) and stagnation detection prevent runaway.

## 5. Safety and Isolation

In an autonomous security agent, the most dangerous failure is "unintended action." It is blocked in two layers.

### 5.1 RoE Reference Monitor

The Rules of Engagement are enforced by a **deterministic reference monitor**. Every function of this monitor is pure — it always renders the same judgment for the same input. Before an agent takes any action, the monitor inspects that action descriptor and judges whether it is within the RoE policy. Because the judgment does not depend on LLM reasoning, it cannot be bypassed by prompt injection.

The decision line is clear — **"does it actually breach someone else's data or change system state?"** If yes, prove it procedurally; if out of scope, block it.

### 5.2 Execution Isolation — Multiple Sandbox Backends

All tool execution happens in an isolated sandbox. To avoid being tied to a single method, multiple backends are supported — rootless OCI containers, kernel-isolation-hardened runtimes, and remote sandboxes. Each execution gets a dedicated network policy that blocks egress to out-of-scope assets (fail-closed).

Isolation is a **safety boundary**, not a performance concern. Because a heavy gate makes you want to bypass it, the policy is kept declarative and the execution layer enforces it.

## 6. Data Model and Provenance Tracking

### 6.1 Graph-Based Knowledge

Findings are represented as interconnected nodes.

- **Web domain**: Host, Service, Endpoint, Parameter, Form, AuthFlow
- **Binary domain**: Binary, Function, Section, Symbol
- **Attack analysis**: AttackVector, Vulnerability, RejectedCandidate
- **Exploit**: ValidatedFinding
- **Knowledge**: Lesson (learned patterns), DeadEnd (failed approaches), TargetProfile

The DeadEnd node is important — recording failed approaches means you don't step onto the same dead end again later.

### 6.2 Provenance Chain

Every finding is traced back to its reconnaissance source.

```
Recon evidence
 └─ Endpoint {path, method, _source: source_tool}
     └─ Attack hypothesis {confidence, evidence[], reasoning}
         └─ PoC execution {stdout, stderr, canary}
             └─ Impact confirmation {confirmed: true, cvss}
                 └─ Final report {risk_level, summary}
```

Thanks to this chain, every finding is fully traceable back to its original reconnaissance source and intermediate validation steps — a forensic audit is possible.

## 7. Coordination and Memory

### 7.1 Coordinator — Attack Graph and Capability Registry

Beyond simple sequential execution, the coordinator maintains an **attack graph**. It places discovered surfaces and hypotheses as nodes and edges, and manages "which specialist can take which action right now" with a capability registry. A delegation budget prevents runaway — instead of infinite delegation, it stops and freezes when the budget is exhausted.

### 7.2 Memory — Dead-Ends and Decomposition

The memory layer manages failure paths (dead-ends) and task decomposition (decomposer), and recalls similar past situations with embedding-based search. Because it externalizes state to **files/storage outside the model's head**, "what has already been tried" is preserved even when context is compressed.

## 8. Design Patterns

### 8.1 Function-Context Separation

Remove system-internal values from LLM-facing parameters.

```
// Pattern to avoid — system noise mixed into LLM input
{ target_url: "...", run_id: "uuid...", workspace_path: "/data/..." }

// Correct pattern — clean LLM input
{ target_url: "...", mode: "normal" }

// System values are injected as a separate context
context.set("run_id", runUuid);
context.set("workspace", workspacePath);
```

It focuses the LLM's attention on security logic, not on infrastructure plumbing.

### 8.2 Single Write Path

Only the supervisor writes to persistent storage. Specialists signal intent and the supervisor executes.

### 8.3 Stack-Agnostic Design

There are no hardcoded selectors, timeouts, or credentials in the agent code. The auth probe is driven by a runtime configuration that adapts to the detected stack.

## 9. Operational Considerations

### 9.1 Multi-Layer Timeouts

| Level | Scope |
|------|------|
| Tool level | An individual subprocess (a short curl timeout) |
| Wrapper level | The sandbox container |
| Specialist level | The agent's maxSteps |
| Supervisor level | The whole run (step/cost budget) |

### 9.2 Early Termination

- **Human intervention required** (MFA/CAPTCHA/OAuth): stop the auth probe, continue public reconnaissance
- **Cost budget exhausted**: immediately halt everything
- **Evidence threshold reached**: on reaching confidence, skip the remaining hypotheses

## 10. Design Lessons

| Anti-pattern | The right way |
|----------|--------|
| A single monolithic agent → context overload | Hierarchical delegation → focused responsibility |
| Shell execution without sandboxing → security risk | Multi-backend isolation → auditable execution |
| Shared mutable state → race conditions | Read-only specialists → single write path |
| LLM self-judgment → completion/confirmation bias | Deterministic oracle/monitor → externalized judgment |

The trade-off is clear. Multi-step validation spends more wall-clock time and tokens. But a security assessment gains more from **accuracy and auditability** than from fast iteration. This design prioritizes those two over speed.

## Closing

A sophisticated autonomous security assessment needs more than a single capable LLM. The strength of this architecture comes from five things.

1. **Role separation** — each agent has a focused responsibility
2. **Deterministic judgment** — guardrails, oracle, and RoE monitor enforce invariants at every boundary, putting judgment outside the model
3. **Provenance integrity** — a complete audit trail
4. **Graceful degradation** — fallback paths handle adversarial conditions
5. **Tunable safety** — budgets, timeouts, and isolation block runaway

Generalized, hierarchical delegation, read-only specialists, and **the discipline of externalizing judgment authority into deterministic code** are the heart of this blueprint. It is a reusable pattern for building trustworthy autonomous AI in a domain like security, where the cost of a misjudgment is high.

## References

- [Harness Design That Pulls LLM Completion Bias Out of the Model](/en/blog/deterministic-completion-gate-harness/) — the principle underlying the confirmation oracle
- [Dissecting Open-Source Security AI Agents — CAI, PentAGI, OpenManus, CRS](/en/blog/oss-security-ai-agents/) — comparison of similar systems
- VoltAgent — a multi-agent workflow orchestration framework
- OWASP Testing Guide · CVSS v3.1 · KISA Web Vulnerability Assessment Guide
