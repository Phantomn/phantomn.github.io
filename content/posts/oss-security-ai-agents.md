---
title: Dissecting Open-Source Security AI Agents — CAI, PentAGI, OpenManus, CRS
date: 2026-08-04T00:00:00.000Z
excerpt: >-
  A breakdown of four open-source agent frameworks (CAI, PentAGI, OpenManus, CRS) grounded in
  their actual code and papers, plus what DARPA AIxCC revealed about the current state of
  autonomous vulnerability discovery and patching.
tags:
  - security
  - ai-agents
  - aixcc
  - crs
  - offensive-security
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## TL;DR

Security AI agents currently split into **four distinct design philosophies**: full automation (CRS), autonomous + hierarchical (PentAGI), semi-autonomous HITL (CAI), and a minimalist general-purpose framework (OpenManus). This post dissects each framework based on actual open-source code and papers, and summarizes what the DARPA AIxCC final round demonstrated about "what actually works."

The core conclusions up front:

- **Autonomy is a spectrum, not a switch.** Fully automated approaches win for reproducing well-formed CVEs, while human-in-the-loop (HITL) intervention raises success rates for real-world pentesting.
- **AIxCC's winning factor wasn't technical sophistication, it was stability.** The team that won wasn't the most sophisticated — it was the one that stayed available for all 143 hours.
- **LLMs' actual contribution is measurable.** LLMs caught 22 additional vulnerabilities that parallel fuzzers missed. However, **37-45% of patches that passed automated validation were semantically wrong.**

The self-architecture from an internal system-design perspective is covered separately in [AI Security Agent Architecture](/en/blog/ai-security-agent-architecture/). This post focuses on analyzing open-source frameworks.

---

## Part 1 — Overview of the Four Frameworks

First, a table condensing the four systems. Details follow in later sections at the code level.

| Item | CAI | PentAGI | OpenManus | CRS |
|------|-----|---------|-----------|-----|
| Developer | Alias Robotics | vxcontrol | MetaGPT (FoundationAgents) | Theori (AIxCC finalist team) |
| Language/stack | Python, extended OpenAI Agents SDK | Go backend + React | Python, OpenAI SDK + Pydantic | Python + Rust FFI |
| Autonomy | Semi-autonomous (HITL) | Autonomous + hierarchical | Simple ReAct | Fully autonomous |
| Specialization | CTF / bug bounty | Network penetration | General-purpose tasks | Code vulnerability discovery/patching |
| Memory | Stateless | pgvector + Graphiti | Sliding window, 100 msgs | Stateless |
| Plan revision | Planner re-planning | Delta Patch | Not supported | None |
| Guardrails | 4 layers | Quadruple | Stuck detection only | Tool hooks |
| Code size | Medium-large SDK | Large full-stack | ~2,500 lines | Large (12 agents, 11 modules) |

Each of these four systems answers a different question. CRS asks "can it go all the way without a human?", PentAGI asks "how do you combine autonomy with hierarchical control?", CAI asks "where should a human intervene?", and OpenManus asks "how simple can this be made?"

---

## Part 2 — CAI: An Eight-Pillar Semi-Autonomous Architecture

**CAI (Cybersecurity AI)** is Alias Robotics' open-source cybersecurity AI. It has ranked near the top of HackTheBox AI leaderboards and, in arXiv `2504.06017`, reported speeds up to 3,600x faster than humans. It's built by extending the OpenAI Agents SDK.

The principle running through CAI is **semi-autonomy**. Full automation works well for well-formed tasks, but its failure rate climbs the moment complex security judgment calls are needed. So CAI maintains an HITL structure where a human can always step in via `Ctrl+C`. The six-tier classification of automation vs. autonomy is laid out in `2506.23592`.

### The Eight Pillars

CAI's architecture is built from eight concepts.

| Pillar | Role |
|------|------|
| **Agents** | The unit of LLM thought/action (the worker) |
| **Tools** | Python functions wrapped with `@function_tool` (the toolbox) |
| **Handoffs** | Transferring control via a `transfer_to_<agent>` tool (the baton pass) |
| **Patterns** | Team operating modes such as distributed (Swarm) or top-down (Hierarchical) |
| **Turns** | The cycle unit, used for cost/progress tracking |
| **Tracing** | Full record, for debugging (the black box) |
| **Guardrails** | Four-layer defense (the safety mechanism) |
| **HITL** | `Ctrl+C` intervention (the emergency brake) |

Summed up in one sentence: a worker (Agent) picks up tools (Tools), hands off the baton (Handoffs), operates under a team mode (Patterns), gets logged (Tracing) every turn (Turns), is protected by safety mechanisms (Guardrails), and gets caught by a human (HITL) when things get dangerous.

### Why Handoffs Are Expressed as Tools

CAI's most distinctive design choice is **expressing control transfer between agents as a tool call rather than as a separate mechanism**. LLMs are already optimized for tool calling. So if calling a tool named `transfer_to_<agent_name>` transfers control, the LLM can decide to delegate naturally without having to learn a new concept.

The history that carries over during a handoff splits into three kinds: the full prior history (`input_history`), the items up to just before the handoff (`pre_handoff_items`), and the items newly generated during the handoff turn (`new_items`). An `input_filter` can manipulate what history gets passed to the new agent, letting failed-attempt traces be wiped so the next agent starts with a clean context.

The `as_tool()` method stands in contrast to this. Where a handoff transfers control, `as_tool()` turns an agent into a **subroutine tool for another agent**. Control never transfers — only the result comes back.

### The Runner Execution Loop

`Runner.run()` drives the entire loop, repeating three stages.

1. **Parallel Input Guardrail execution** — only for the first agent, run concurrently with LLM inference.
2. **LLM inference** — decides the next action based on the system prompt plus history.
3. **Parallel tool execution**

There are three branch conditions: if a handoff occurs, control moves to the new agent and restarts from stage 1; if a final output is produced, it passes through the Output Guardrail and terminates; if more work is needed, it loops back to stage 2. CAI operates **statelessly** on top of the Chat Completions API, so each call is independent and switching between multiple models is unconstrained. It handles over 300 models via LiteLLM.

### Four-Layer Guardrails and Prompt Injection Defense

CAI's guardrails are designed as defense-in-depth across four layers. The basis is `2508.21669`.

| Layer | When it fires |
|------|----------|
| Layer 1 InputGuardrail | On the first agent's input, **in parallel** with LLM inference |
| Layer 2 Tool-level | **Immediately before** each tool executes |
| Layer 3 OutputGuardrail | When the final output is produced |
| Layer 4 Unicode/Encoding | Re-checked after normalizing homoglyphs/encoding |

The reason guardrails run in parallel is to minimize latency: fast regex checks and slow LLM analysis run simultaneously, cutting wait time. This parallelization is consistent with the design of CAI's execution loop — the Runner also runs the Input Guardrail concurrently with LLM inference in its first stage, for the same reason: securing safety without adding latency.

Prompt injection is detected via five patterns: direct instruction override ("ignore previous"), hidden commands (`<system>`/`<admin>` tags), leetspeak obfuscation, encoding tricks (Base32/64), and shell metacharacters (`$`, `` ` ``, `|`, `&`, etc.). Layer 4 normalizes Unicode homoglyphs — such as Cyrillic а (which looks like a) or Greek ο (which looks like o) — to ASCII before re-checking.

### Context Management and Lifecycle Hooks

CAI clearly separates two kinds of context: **local Context** (`RunContextWrapper`) and **LLM Context** (history).

| | Local Context | LLM Context |
|--|-------------|-------------|
| LLM access | Not possible | Direct reference |
| User | Tools/hooks only | Passed via system prompt |
| Data | Python objects (dataclass, Pydantic) | JSON-serialized messages |

This separation matters for security. For example, if a `SecurityAlert(ip, threat_id)` dataclass is passed as local Context, a tool can access it via `wrapper.context.ip_address`, but the LLM never sees that value. It isolates sensitive information from the LLM's history. Any `@function_tool` function whose first parameter is typed `RunContextWrapper` gets the runtime context injected automatically.

There are also two kinds of lifecycle hooks. **RunHooks** (global: `on_agent_start/end`, `on_handoff`, `on_tool_start/end`) observe everything like "CCTV," while **AgentHooks** (per-agent) watch only a specific agent, like a "personal assistant."

### Council — the LLM Council

One of CAI's distinctive features is **Council**. Multiple models respond in parallel, evaluate each other, and a chair synthesizes the result. It runs in three stages: (1) models such as the GPT family and Claude each independently generate text, (2) they rank each other anonymously, and (3) the current agent synthesizes the final consensus. With N members this costs roughly 2N+1 calls, 3-4x more expensive, but it reduces single-model bias on important decisions.

### 11 Specialized Agents and the Cyber Kill Chain

CAI groups its 11 specialized agents into three categories.

- **4 offensive**: Red Teamer (penetration/privilege escalation), Bug Bounter (vulnerability discovery), Web Pentester (web apps/APIs), One Tool Agent (minimal-tool CTF challenges)
- **2 defensive**: Blue Teamer (monitoring), DFIR Agent (forensics)
- **5 support**: Thought Agent (strategic routing), Reporter (reporting), Retester (false-positive elimination), Memory Agent (RAG store/retrieve), Flag Discriminator (CTF flag verification)

The Red Teamer's prompt strategy shows real-world pentesting instincts well. Alongside the instruction "never stop iterate until root access," it hardcodes rules such as: use only non-interactive commands (`--batch`, `--non-interactive` required), one command at a time, always attach a timeout (to prevent hangs), and never repeat the same approach (fall back to the Thought Agent when stuck).

Long-running processes such as reverse shells are managed via a four-stage session flow: spin up a netcat listener to get a `session_id`, check output with `session output <id>`, remote-execute commands against the session, and terminate with `session kill <id>`.

Tools are organized into directories by the **six stages of the Cyber Kill Chain**: `reconnaissance/`, `exploitation/`, `privilege_scalation/`, `lateral_movement/`, `data_exfiltration/`, and `command_and_control/`.

### 5 Patterns and CAIBench

CAI splits its coordination modes along two axes: **LLM-based** (Swarm autonomous handoffs — exploratory, non-deterministic) and **code-based** (Parallel configuration — deterministic, reproducible). Agent patterns are formalized as a five-dimensional tuple: the participant set (Agents), transition rules (Handoffs), flow decision (Decision: LLM-autonomous or code), history sharing (Communication: unified/isolated), and execution mode (Execution: sequential/parallel/recursive).

These five dimensions are expressed as a single `Pattern` dataclass and concretized via a five-member `PatternType` enum (PARALLEL, SWARM, HIERARCHICAL, SEQUENTIAL, CONDITIONAL). `CAIBench` isn't a single benchmark but a meta-benchmark that integrates multiple domains — CTF, fuzzing, patch quality, CVE reproduction, HITL intervention frequency, and more — used to optimize the choice of agent, model, and pattern.

---

## Part 3 — PentAGI: A Go-Based Autonomous Pentesting Platform

**PentAGI** is vxcontrol's autonomous AI penetration testing platform. Given a request like "find vulnerabilities on server 10.10.10.5," the AI autonomously scans, attacks, and reports. Its stack is a Go backend (Gin, gqlgen GraphQL, GORM) with a React frontend, PostgreSQL + pgvector, an optional Neo4j + Graphiti knowledge graph, and a Docker (Kali Linux) execution environment.

### A Five-Stage Flow

Operation proceeds through five stages.

1. **User request** — task input via the web UI
2. **Environment preparation** — the Image Chooser picks an appropriate Docker image and boots a Kali container. Two OOB callback TCP ports are auto-allocated per Flow.
3. **Plan formation** — the Generator decomposes the task into subtasks
4. **Subtask execution loop** — orchestrated by the Primary Agent
5. **Final evaluation** — judged by the Reporter

The structure of the subtask execution loop is the core of the system. Under the Primary Agent, the Task Planner (Adviser) builds a 3-7 step checklist, delegates to the Pentester, and the Pentester either runs a tool in Docker via `terminal("nmap -sV ...")`, delegates CVE searches to the Searcher, or has the Coder write an exploit script. Once a finding is confirmed, `hack_result()` is called to close out the subtask (Barrier).

After that, the Refiner revises the remaining plan as a **Delta Patch**. Rather than re-planning the whole thing, it applies only add/remove/modify/reorder deltas for efficiency. This contrasts with CAI's full re-planning approach.

### Final Judgment Is Outcome-Based

PentAGI's Reporter judges independently, but **looks at the outcome, not the process.** Even after 100 attempts, if no real vulnerability was found, it's a FAILURE. Each subtask closes with a `hack_result` call, and the Reporter determines SUCCESS/FAILURE based on that result.

### Quadruple Guardrails

PentAGI blocks infinite loops and stagnation at the code level.

1. **repeatingDetector** — warns after the same tool+arguments repeat 3 times in a row, force-terminates at 7
2. **executionMonitor** — once calls exceed a threshold, the Adviser (mentor) steps in and suggests alternate strategies
3. **Enhanced Response** — mentor analysis is automatically injected into tool responses as XML (the `<enhanced_response>` wrapper bundles the original result together with the mentor's analysis, presenting a progress assessment, problems, alternatives, and next steps)
4. **Reflector** — if a tool call is missing and only text is returned, redirects up to 3 times

### Triple-Layer Memory and Anonymization

PentAGI uses three memory layers: Working Memory (LLM context + summary, session-scoped), Long-term Memory (PostgreSQL + pgvector, persistent), and Knowledge Graph (Neo4j + Graphiti, persistent).

A notable design is the **Anonymization Protocol**. When memory is stored, IPs, domains, and credentials are replaced with placeholders like `{target_ip}` and `{password}`. This way, what's accumulated isn't a log tied to a specific target but generalized knowledge reusable across other targets.

### Combining Workflow Patterns

PentAGI combines Anthropic's production patterns: Prompt Chaining (generator -> primary_agent -> reporter), Routing (primary selects pentester/coder/searcher), Augmented LLM (pentester runs nmap), and Evaluator-Optimizer (Refiner improves via Delta Patch). These patterns are covered conceptually in [AI Agent Architecture Basics](/en/blog/ai-agent-architecture-basics/).

---

## Part 4 — OpenManus: A Minimalist General-Purpose Framework

**OpenManus** is the MetaGPT team's open-source general-purpose agent framework, an open-source alternative to Manus AI. Its philosophy is clear: "simple and fast." The entire codebase is roughly **2,500 lines**, and it avoids complex abstraction layers like LangChain or CrewAI, using the OpenAI SDK and Pydantic directly instead.

It's not a security-specialized framework, but it's worth comparing as a baseline for what a minimally-built agent looks like.

### Two Execution Modes

- **Single-agent mode** (`main.py`): builds an agent via `Manus.create()` and runs a ReAct loop. It picks a tool with `think()`, executes with `act()`, observes, and repeats until it picks the `terminate` tool.
- **Multi-agent mode** (`run_flow.py`): `PlanningFlow` builds a plan using an LLM + PlanningTool and executes step by step.

The routing in multi-agent mode is interesting. Each step's text is tagged with something like `[MANUS]` or `[DATA_ANALYSIS]`, and the regex `\[([A-Z_]+)\]` extracts the tag to assign the step to the corresponding agent. If there's no tag, it falls back to the primary_agent. It's a textbook example of minimalism: text tags and regex instead of a sophisticated router.

### Four-Layer Inheritance

OpenManus builds up functionality through inheritance.

```
BaseAgent      — name, memory, state / create(), run(), step()
  └ ReActAgent  — think() → bool, act() → str
      └ ToolCallAgent — tool call decision/execution, tools management
          └ Manus     — python_execute, browser_use, MCP connection
```

`BaseAgent.run()` fixes the `step()` skeleton in a Template Method pattern, and subclasses flesh it out. MCP supports both client and server directions — it can either receive tools injected from an external MCP server or expose its own agent as an MCP server. The browser uses Playwright (browser-use), and code execution uses a Docker sandbox.

### The One Safety Mechanism: Stuck Detection

OpenManus has no dedicated guardrails. Its only loop safety mechanism is `BaseAgent`'s **duplicate response detection**. If the last assistant message repeats `duplicate_threshold` (default 2) times, it's judged stuck, and a prompt is injected — "Observed duplicate responses. Consider a new strategy and avoid repeating ineffective paths already tried" — to prompt an escape from the loop. It intervenes only when identical output repeats; there's no prompt injection defense, tool permission control, or input/output guardrails.

Memory is also minimal. There's no persistent memory — `Memory.add_message()` only maintains a sliding window of up to 100 messages, all of which vanish once the session ends.

This simplicity comes with clear tradeoffs. Its strengths are a clear inheritance structure, minimal dependencies, native bidirectional MCP support, and high readability. Its weaknesses are no memory persistence, no inter-agent communication, no dynamic re-planning, and no security/permission controls. It's a baseline for prototyping and learning, not for real-world security use.

---

## Part 5 — CRS and AIxCC: The Reality of Full Autonomy

**CRS (Cyber Reasoning System)** sits at the opposite end of the spectrum: full autonomy. It's covered here together with the DARPA AIxCC context.

### What AIxCC Is

**AIxCC (AI Cyber Challenge)** was a DARPA-run 2023-2025 competition whose goal was to build a CRS capable of **autonomously discovering and patching vulnerabilities** in real open-source software. Where the 2016 CGC (Cyber Grand Challenge) dealt with custom binaries in an isolated CTF environment, AIxCC dealt with real C/Java OSS in a GitHub-integrated development environment, with Anthropic, Google, and OpenAI providing LLM infrastructure.

The scale of the final competition (AFC):

- **Duration**: 143 hours of fully autonomous operation
- **Challenges**: 24 OSS repositories -> 48 CPs, 63 CPVs
- **Resources**: $85,000 in Azure credit + $50,000 in LLM credit per team
- **Language breakdown**: 40 C vulnerabilities, 23 Java vulnerabilities, 34 distinct CWE types

CRS has four core functions: Full Scan (triggered by new release tags, detects/patches across the whole codebase), Delta Scan (triggered by PR merges, analyzes the diff), SARIF Review (evaluates the validity of static analyzer warnings), and Report Synthesis (consolidates per-vulnerability reports).

The scoring structure strongly shaped system design. PoV (proof of vulnerability input) was worth 1-2 points, Patch (fixing while preserving functionality) 3-6 points, SARIF assessment 0.5-1 point, and Bundle (linking PoV/Patch/SARIF) ranged from -7 to 7 points including a penalty for mis-linking. On top of that came **time decay** (100% for immediate submission, 50% near the deadline) and an **accuracy multiplier** (50% accuracy cuts the overall score by 6%). This scoring structure made the strategic choice between "fast but inaccurate submissions" and "slow but accurate submissions" a deciding factor in the rankings.

### CRS Architecture (Theori's roboduck)

Theori's finalist CRS is built from the following layers.

```
CRS Orchestrator (WorkDB + ProductsDB + TaskDB)
LLM Agents (12: VulnAnalyzer · PovProducer · Patcher · Triage · ...)
Tool Modules (11: Project · Fuzzing · Coverage · Debugger · Searcher · ...)
Common Library (LLM API · Types · VFS · Docker · Prompts)
Rust FFI (HTTP · Logger · Metrics · Coverage)
```

The agent framework has a **1 common root + 6 subclass** structure. The common root, `AgentGeneric[T]`, handles LLM calls (`_completion()` via litellm), tool execution, the ReAct loop (max 30-40 iterations), cost tracking, context management, serialization (jsonpickle, cloning via `fork()`), and model fallback. Subclasses differ by termination style.

- **XMLAgent** — parses XML tags out of free text and validates via Pydantic. On validation failure, an error message is injected and it retries.
- **ToolRequiredAgent** — must terminate via a `terminate` tool call. It analyzes the return type's Pydantic fields with `inspect.signature` to dynamically generate the `terminate` signature.
- **Classifier** — classifies via logprobs. With temperature=0 and max_tokens=1, it generates a single token, then normalizes the probability of each option token. For example, if logprobs give "likely"=-0.139 and "unlikely"=-2.207, that's computed as likely 87% / unlikely 11%. Because the cost is about one token's worth (roughly $0.00001), it's used as a low-cost gate. However, since it's GPT-only (Claude/Gemini don't support logprobs), it forces `gpt-4o-mini`.

**Multiple inheritance** is used frequently in this structure. `CRSAgent[T, U]` provides CRS context (task, project, searcher, coverage, debugger) but has no termination logic of its own, so it's inherited alongside a class that handles termination. For example, VulnAnalyzer inherits both `CRSAgent` and `XMLAgent` simultaneously, combining CRS context with XML-based termination logic. jsonpickle can serialize and clone (`fork()`) an entire agent's state, making it possible to branch state at a promising analysis point and explore in parallel.

### The Orchestrator and Cost Escalation

CRS's WorkDB is a SQLite-based priority queue that fairly distributes 32 kinds of work using a **Linux CFS scheduler-style** approach. It handles per-task concurrency limits (50 for PoV, 32 for patches), vruntime-based fair scheduling, priority execution, exponential backoff retries, expiration tied to the competition deadline, and bulk batching.

Cost management works via a gate pipeline: cheap filtering weeds out candidates, and expensive stages promote the survivors.

```
Vulnerability candidates (fuzzer · static analysis · LLM)
  ↓ [Gate 1] Classifier — ~$0.001 (discard if logprobs probability is low)
  ↓ [Gate 2] VulnAnalyzer — ~$0.5-2 (source exploration + analysis, discard if triggerable=false)
  ↓ [Gate 3] PovProducer — ~$5-20 (PoV generation + actual testing)
  ↓ [Gate 4] Patcher — ~$5-20 (patch + build + functional testing + PoV re-verification)
```

When context is exceeded, `_compress_context()` preserves the first 2 messages and keeps only the last 1/3. Model fallback goes from GPT-4.1 to Claude Sonnet on failure, then to o4-mini.

### What AIxCC Demonstrated

The competition results broke a few common assumptions about security AI.

**The winning factor was stability.** First place, AT Atlantis, scored 392.8, 80% higher than second place — and the decisive factor wasn't the most sophisticated technology, it was **maintaining availability across all 7 rounds** for 143 hours. They used the most resources aggressively, 87% of Azure credit and 59% of LLM credit. Second place, TI RoboDuck, was the most technically sophisticated and posted the best Java PoV score, but its aggressive strategy led to accuracy penalties. A good number of competitors stopped functioning after round P3-P4, and some teams' over-engineering caused them to fail even basic CPVs.

The seven finalist teams' design philosophies also varied widely.

| Team | Philosophy |
|----|------|
| AT Atlantis | Ensemble-first — 8 patch agents, build caching |
| TB Buttercup | Expertise-based decomposition — deterministic workflows, LLM only when tools fall short |
| TI RoboDuck | Agent-centric — maximizing autonomous LLM operation |
| FB FuzzingBrain | Simple architecture — 23 independent Python strategies |
| SP Artiphishell | Comprehensive engineering — coordinating 53 components |
| 42 BugBuster | Pragmatism — traditional fuzzing-centric, LLM assists with seed generation |
| LC Lacrosse | DSPy multi-LLM — Lisp-based task distribution |

**The LLM's actual contribution was measurable.** Parallel fuzzers (PF) found 34 of 63 (54%) — 75% for C, but only 17% for Java (due to complex input semantic constraints). Where CRS beat PF was on 22 additional vulnerabilities (8 C + 14 Java), sourced from delta code change analysis, overcoming complex input grammar barriers (e.g., XML), and resolving logic constraints like regex, encoding, compression, and path obfuscation.

**Patch quality remains unresolved.** The semantic error rate among patches that passed automated validation wasn't low: 37.7% for the Claude Code baseline agent, 45.6% for the MultiRetrieval baseline. Sources of error included incorrect root cause (suppressing symptoms only), incomplete fixes (only specific paths), functional drift (semantic changes tests can't catch), newly introduced bugs, and lack of domain knowledge. That said, CRS achieved a lower error rate than the baseline agents thanks to contextualization that integrated static analysis reports, execution traces, PoV bytes, and CWE guidance.

Core patch pipeline techniques also converged across teams: **standalone RCA** (the LLM separates root cause analysis and patch synthesis into distinct sub-problems), **contextualization** (integrating static analysis reports + execution traces + PoV bytes + CWE guidance), **LLM reflection** (learning from failed attempts, adopted by most CRS teams), and **post-patch fuzzing** (short fuzzing runs to catch incomplete patches). For submission optimization, teams grouped PoVs sharing the same root cause to compute a minimal patch set, and delayed submission of low-confidence No-PoV patches to reduce penalties.

SARIF validation also split into three strategies: PoV-centric (submit only when a PoV-SARIF location match is found), LLM-judgment-centric (submits both Correct/Incorrect but risks errors), and bug-candidate-centric (starts as Incorrect and revises to Correct once evidence is found).

In the end, all 7 teams found at least one 0-day each, for a total of 25 0-days found across 10 OSS projects, 12 of which (48%) were patched.

### The Triple Challenge

AIxCC's lesson compresses into one triangle: balancing research (technical capability), engineering (system stability), and strategy (accuracy/timing). AT Atlantis won by balancing all three; TI RoboDuck was strong on research but failed on strategy; and over-engineering actually undermined strategy elsewhere. **The real bottleneck wasn't technical capability — it was robust system integration.**

The challenges for industrial deployment are also clear: resource efficiency (the AFC CRS spent $85K in Azure credit; individual developers need a lightweight, single-machine version), OSS community integration (LLM provisioning, standardizing the CRS interface, defining end-to-end workflows), better telemetry, and exploring open-source LLMs.

---

## Synthesis — The Autonomy Spectrum and Selection Criteria

Placing the four frameworks on an autonomy axis, they line up like this:

```
Fully autonomous ─────────────────────────────── Semi-autonomous
CRS              PentAGI           OpenManus       CAI
(code vulns)      (network pentest)  (general-purpose min.) (CTF/pentest)
```

The right choice depends on the nature of the task.

- For **reproducing/patching well-formed CVEs**, CRS-style full autonomy wins — repetition and verification dominate over judgment.
- For **network penetration**, where the plan keeps changing, PentAGI's autonomy + hierarchy + Delta Patch fits.
- For **real-world pentesting/bug bounty**, where human judgment drives success rate, CAI's semi-autonomous HITL is better.
- For **learning/prototyping**, OpenManus's 2,500-line minimalism is the baseline.

The biggest lesson from AIxCC is that **stability and system integration dominate the outcome** more than architectural choice. It wasn't the team with the most sophisticated agent library that won — it was the team that stayed alive for 143 hours. If you're designing a security AI agent, that means investing in a robust harness and guardrails before flashy autonomy.

---

## References

- CAI (Alias Robotics) — arXiv `2504.06017` (3,600x speed), `2506.23592` (six-tier autonomy scale), `2508.21669` (four-layer prompt injection defense), `2510.24317` (CAIBench)
- PentAGI (vxcontrol) — Go-based autonomous pentesting platform
- OpenManus (MetaGPT / FoundationAgents) — OpenAI SDK + Pydantic general-purpose agent
- CRS / AIxCC — analysis of Theori's roboduck, DARPA AIxCC SoK
- Related posts: [AI Security Agent Architecture](/en/blog/ai-security-agent-architecture/), [AI Agent Architecture Basics](/en/blog/ai-agent-architecture-basics/)
