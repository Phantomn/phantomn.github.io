---
title: AI Agent Architecture Fundamentals — Sub-Agents, Multi-Agent Patterns, and the Harness
date: 2026-08-03T00:00:00.000Z
excerpt: >-
  From what an agent is, to sub-agent interaction, to a catalog of multi-agent patterns, to the
  harness engineering that wraps it all. A single-article summary of the fundamentals of
  designing AI agent systems.
tags:
  - ai-agents
  - multi-agent-systems
  - architecture
  - sub-agents
  - harness
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## BLUF

The fundamentals of AI agent architecture can be understood in four layers. **What an agent is** (an autonomous execution loop), **why you split it into sub-agents** (the 3 limits of a single agent), **which patterns you combine them with** (the multi-agent catalog), and **what wraps all of it** (the harness).

Let me throw out three core propositions first.

- **The ability to call tools alone does not make an agent.** The essence of an agent is a loop that decides its next action on its own based on intermediate results.
- **A sub-agent is a disposable specialist.** It works in an independent context, returns only a summary, and vanishes. Not polluting the parent context is the key.
- **Prompt engineering and harness engineering are different layers.** The former is "writing good instructions," the latter is "designing the entire environment in which the agent operates."

This article covers beginner to intermediate level. For hands-on analysis of frameworks, see [Dissecting Open-Source Security AI Agents](/en/blog/oss-security-ai-agents/).

---

## 1. What Is an Agent

### The Structural Difference Between an LLM and an Agent

Let's clear up the most common misconception first. "If an LLM can call an API, it's an agent" is wrong.

An LLM is **reactive**. It takes input, generates output, and stops. It cannot change the outside world, and when the session ends, its memory disappears too. An agent, by contrast, is **goal-oriented**. It sets a goal, makes a plan, acts, observes the result, reflects, and loops through this until it reaches the goal.

```
LLM:                    Agent:
input → [process] → output   goal → plan → act → observe → reflect → (repeat)
       (end)                        goal reached? No → return to plan
```

Let's see the difference with a concrete example.

```
# LLM: reactive
User: "Find the bug in this code"
LLM:  "There is an off-by-one error on line 3"   # Done. Does not fix it

# Agent: goal-oriented
User: "Fix the bug in this code"
Agent:
  1. Reads the code (Read)
  2. Analyzes the bug (reasoning)
  3. Makes a fix proposal (plan)
  4. Edits the code (Edit)
  5. Runs the tests (Bash)
  6. Fail? → return to step 3
  7. Pass → report completion
```

The essence of the difference is one thing. **An agent decides its next action on its own based on intermediate results.** Given the request "schedule an outdoor meeting in Seoul tomorrow," it checks the weather ("rain forecast"), judges on its own ("better to move it indoors"), checks the calendar, and books a room — this chain of self-judgment is the agent.

### MIT's 4 Essential Characteristics and Levels of Autonomy

The MIT AI Agent Index (2025) defines four characteristics a true agent must have. It must satisfy **all** four.

| Characteristic | When absent |
|------|---------|
| **Autonomy** (operates independently with minimal supervision) | A chatbot that needs instruction every time |
| **Goal complexity** (pursues high-level goals through planning) | A simple reactive FAQ bot |
| **Environment interaction** (directly manipulates tools, APIs, filesystem) | An LLM that only talks |
| **Generality** (handles new, unspecified situations) | A hardcoded RPA script |

Autonomy is not a switch but a spectrum. It splits into five levels, from L1 (suggestion only, GitHub Copilot), through L2 (approval at every step), L3 (plan + execute, human only supervises), L4 (intervene only on exceptions), up to L5 (fully autonomous, not yet practical).

### The 3 Elements of an Agent and the Memory System

An agent is defined by three elements: Role (what kind of entity it is), Tools (what actions are possible), and Instructions (what rules it follows).

Another axis that separates an LLM from an agent is **memory**. An LLM's context is volatile and single-layered, but an agent leverages a 3-layer memory with different time scales.

| Memory type | LLM | Agent | Actual implementation example |
|-----------|-----|-------|-------------|
| Short-term | Context window | Working memory | Task state tracking |
| Medium-term | None | Episodic memory | Records of past failures (`[DEAD END]`) |
| Long-term | None | Semantic memory | Learned rules (Lessons Learned) |

### Why Use an Agent — and When Not To

There are six technical grounds for needing an agent: overcoming context limits, quality improvement through specialization, parallel speed, permission-control safety, failure isolation, and cost optimization. Several of these are covered in detail in the next section on sub-agents.

What matters is knowing **when not to use one**.

| Situation | Reason | Alternative |
|------|------|------|
| Simple Q&A | Overhead unnecessary | A plain LLM call |
| Deterministic tasks | Need the same result every time | Traditional programming |
| Latency-critical | The agent loop is slow | A pre-defined pipeline |
| Extremely low-cost | Cost of multiple LLM calls | A single call + rules |
| Full audit required | Non-determinism of judgment | A rule-based system |

An agent is powerful but not unconditionally advantageous. Use an agent for multi-step decision-making, external system integration, continuous monitoring, and complex, dynamic tasks; for everything else, an LLM or traditional programming is better.

---

## 2. Why Sub-Agents

### Evolution: LLM → Agent → Sub-Agent

The evolution of agents has two stages. The LLM "could only talk," so it needed tools, and thus the Agent appeared. A single Agent was "limited on its own," so it needed a division of labor, and thus the Sub-Agent appeared. Sub-agents came about to overcome the structural limits of a single agent.

### The 3 Limits of a Single Agent

**1. Context pollution.** When you do a complex task, the context fills up with irrelevant information. While doing a "bug fix," if 2K of system prompt, 13K of files A~D, and 13K of tests + error logs pile up — file C, which turned out to be irrelevant, still occupies context and starts to make it miss the point.

Splitting into a sub solves it.

```
Main: "Find the cause of the bug among files A~D"
  └→ Sub (search-only, independent context)
       Reads A, B, C(irrelevant), D all
       → "Line 42 of B is the cause" (returns only a summary)
Main: Receives just a one-line summary (context stays clean)
```

**2. Role conflict.** Giving one agent conflicting roles creates confirmation bias. If it reviews the code it wrote itself, it becomes "I wrote it, so it's probably fine." Separating implementer (creation mindset) and reviewer (problem-finding mindset) into distinct contexts is the same principle by which real software teams separate the author and the reviewer.

**3. Single point of failure.** If a single agent fails at step 7 of 10, everything after it is polluted and you have to start over from the beginning. Splitting into subs lets you preserve the A·B results when only Sub-C failed and retry only C.

### How It Works: The Disposable Specialist

How a sub-agent works is summarized in three steps.

| Step | Description |
|------|------|
| **Independent context creation** | Has a context separate from the parent |
| **Summary return** | Passes back only a summary of the result, not the full log |
| **Context destruction** | Frees memory after the task completes |

Seen in numbers, the effect is clear. Even if a sub-agent consumes about 15K tokens with a Glob + Read of 7 files, only a ~200-token summary like "7 agents, roles..." is returned to the parent. Had the parent done it directly, half its context would have been filled with search results, degrading subsequent performance.

Two more benefits are added here. **Cost optimization** — using opus for the parent, haiku for a document-search sub, and sonnet for a code-generation sub saves about 40% versus using opus for everything. **Parallel speed** — running independent tasks concurrently reduces total time to max(A, B, C).

### Interaction: Lifecycle, Communication, Execution Modes

A sub-agent's **lifecycle** has 6 stages. Receive request → decompose task → create and delegate sub → receive result (summary) → decide next → final report.

On creation, **what is passed and what is not** is clearly distinguished.

| Passed | Not passed |
|------|--------|
| prompt (task instruction) | The parent's conversation history |
| subagent_type (role + tools) | Other subs' results |
| model (cost/performance) | Prior conversation with the user |
| mode (permissions) | The parent's reasoning process |

**Only parent-child communication** is allowed. Direct sibling communication is prohibited.

```
        Main
       /  |  \
    Sub-A Sub-B Sub-C

✅ Main ↔ Sub-X (bidirectional)
❌ Sub-A ↔ Sub-B (direct not allowed)
```

There are three reasons. Risk of circular reference (Sub-A → Sub-B → Sub-C → Sub-A), unclear decision authority, and debugging difficulty. Because all communication passes through the parent, the Main always grasps and can trace the full situation.

**The scope of state sharing** is summarized as "external resources shared, internal cognition isolated." The filesystem, Git, environment variables, and MCP servers are shared, while the context window, reasoning state, and tool-call history are isolated. A conflict where two subs edit the same file simultaneously is prevented by worktree isolation (an independent Git copy).

There are three **execution modes**. Sequential (when a prior result is needed later, total time = A+B+C), parallel (when independent, calling multiple agents in one message, total time = max(A,B,C)), and background (a long-running task, while the parent keeps doing other things). You can send additional instructions to a running sub via `SendMessage`, so a long-running sub adapts to changes in external information.

### Parent-Child vs A2A

The parent-child model contrasts with the A2A (Agent-to-Agent) protocol. The former is a hierarchical division of labor within one process; the latter is horizontal collaboration between independent services.

| Dimension | Parent-child | A2A |
|------|----------|-----|
| Relationship | Hierarchical (parent controls) | Horizontal (equal peers) |
| Lifecycle | Parent creates/destroys | Each independent |
| Communication | Via the parent | Direct possible |
| Suited for | Division of labor within one process | Collaboration between independent services |
| Analogy | A team directed by a team lead | Inter-department collaboration |

Interoperability standards including A2A are covered separately in [Agent Interoperability Standards](/en/blog/agent-interop-standards/).

---

## 3. The Multi-Agent Pattern Catalog

How you combine sub-agents is what makes a multi-agent pattern. Remember in advance that most real systems are not a single pattern but a **Composite**.

### Anthropic's 6 Production Patterns

Anthropic distinguishes workflows (orchestrated by pre-defined code paths) from agents (the LLM decides autonomously) and presents six production patterns. There is one core question — **who decides the next step (the programmer vs the LLM)**.

1. **Augmented LLM** — the most basic. Attach search, tools, and memory to an LLM. The other five are combinations of this.
2. **Prompt Chaining** — sequential steps. Handling 10K characters at once misses mid-process mistakes, but splitting into 1K chunks catches them early.
3. **Routing** — classify then specialize. A classifier judges the input and sends it to a specialized process.
4. **Parallelization** — concurrent execution. Handle a task by dividing it (Sectioning) or by majority vote (Voting).
5. **Orchestrator-Workers** — dynamic distribution. Similar to Parallelization, but you don't know the number and kind of tasks in advance.
6. **Evaluator-Optimizer** — iterate generation and review. The Generator makes a draft and the Evaluator gives feedback, iterating until criteria are met.

The distinction between Chaining, Routing, and Parallel is often confusing. The criteria are the number of executions and dependencies.

```
Chaining:  A → B → C         (a straight line, all sequential, has dependencies)
Routing:   A or B or C       (a fork, only one, no dependencies)
Parallel:  A + B + C → merge (concurrent, all, no dependencies)
```

Even for the same "code review," Chaining is "read → problem list → fix proposal" (dependent), Routing is "Python? → Python reviewer" (only one), and Parallel is "security + performance + style concurrently → integrate" (independent).

The selection order is "from the simplest pattern first." Is Augmented LLM enough → can it be split sequentially → is it branching by type → is it independent parallel → is the number dynamic → is it iterative refinement → and only if still insufficient, an autonomous agent. This is Anthropic's principle exactly: "complex is not always better."

### Google ADK's 8 Patterns

Google ADK presents eight more finely divided patterns.

| Pattern | Use | Downside |
|------|------|------|
| Sequential Pipeline | Linear workflow | Whole thing halts if one step fails |
| Coordinator/Dispatcher | Routing by type | The Coordinator is a bottleneck / single point of failure |
| Parallel Fan-Out/Gather | Concurrent execution of independent tasks | Aggregator logic is complex |
| Hierarchical Decomposition | Tree-structured decomposition | Deep hierarchy = cumulative latency |
| Generator + Critic | Generate then critique/regenerate | An exit condition for the loop is essential |
| Iterative Refinement | Self-evaluation iteration | Infinite-loop risk |
| Human-in-the-Loop | Human review checkpoint | Speed constraint |
| Composite | Real production systems | (combination) |

To this, Azure adds Magentic-One Orchestrator, Group Chat (reaching consensus), Supervisor (strong control with retry/skip authority), Swarm (calling each other via handoff without a central coordinator), and more. Swarm is hard to trace, so you should be cautious about using it in production.

The pattern selection guide is organized as a decision tree.

```
Order-dependent?      → YES: Sequential / Hierarchical
Independent?          → YES: Parallel Fan-Out
Iterative quality?    → YES: Generator+Critic / Iterative
Human approval?       → YES: Human-in-the-Loop
Diverse types?        → YES: Coordinator/Dispatcher
                      → NO:  Sequential Pipeline
```

### Real Systems Are Combinations

Production systems combine these patterns. For example, an autonomous pentest platform layers Prompt Chaining (generator → primary → reporter) with Routing (choosing pentester/coder/searcher) and Augmented LLM (running nmap), and a fully autonomous CRS combines Chaining (analysis → PoV → patch) with Parallel (multiple PoVs at once) and Routing (choosing tools per language). Such real combinations are covered at the code level in [Dissecting Open-Source Security AI Agents](/en/blog/oss-security-ai-agents/).

---

## 4. Harness Engineering — The Layer That Wraps Everything

### The Difference from Prompt Engineering

The higher-level concept that holds all the concepts so far is the **Harness**. Prompt engineering and harness engineering are at different layers.

| | Prompt engineering | Harness engineering |
|--|--------------------|--------------------|
| Focus | A single model call | The entire agent lifecycle |
| Time axis | One-off | Long-term (multiple sessions) |
| Scope | Improving instructions | Tools, memory, state, safety |
| Analogy | "Writing good instructions" | "Designing the horse's saddle, reins, fence, and roads" |

Why is a harness needed. An LLM alone forgets when context overflows, calls tools incorrectly, may take dangerous actions, and cannot manage work across sessions. A harness compresses and manages context, validates and restricts tool calls, enforces safety with permissions and approvals, and gives session continuity with memory. Even in OpenAI's actual experience (3 people × 5 months = 1 million auto-generated lines), a significant amount of time went into building deterministic tools — long-term operation is impossible without a harness.

### Two Layers: Scaffolding and Runtime

The harness splits into two layers along the time axis.

```
──── time ────────────────────→
[Scaffolding]          [Harness Runtime]
  before execution       during execution
  ├─ System Prompt       ├─ tool-call validation
  ├─ Agent Registry      ├─ context compression
  ├─ Skill Registry      ├─ safety enforcement
  ├─ MCP server(tool schema) ├─ memory update
  ├─ Configuration       ├─ error recovery
  └─ Memory Schema       └─ state tracking
```

**Scaffolding** is what you prepare in advance before the agent operates. The system prompt template (role, goal, constraints), tool schemas, the sub-agent registry, the memory schema, and configuration (mode, model, parameters).

**Runtime** is what you manage during execution. User-custom hooks (PreToolUse to validate before a call, PostToolUse for post-processing), the internal engine (automatic context compression, permission approval, sub-agent lifecycle, tool dispatch, token counting), and the rules the LLM obeys (Anti-Loop 3-Strike, THINK-THEN-ACT, etc.).

### The 6-Step ReAct Loop and 5-Stage Safety

Inside the harness, every turn runs a 6-step ReAct loop. Pre-Check (state validation, token budget) → Thinking (internal reasoning) → Self-Critique (reviewing its own plan) → Action (deciding the tool call) → Tool Execution (running it) → Post-Processing (cleanup, memory update).

Safety is built up with 5-stage Defense-in-Depth. ① Prompt guardrails (rule documents) → ② schema constraints (tool-input JSON Schema) → ③ runtime approval (requesting user approval) → ④ tool-level validation (inside the tool) → ⑤ lifecycle hooks (PreToolUse/PostToolUse).

### Everything Learned So Far Is Part of the Harness

The concepts covered in this article all converge as components of the harness.

| Concept | Harness role |
|------|-------------|
| Agent | The execution subject |
| Sub-Agent | Division of labor |
| Skills | Methodology injection (Scaffolding) |
| Tools | Action capability |
| MCP | Standard tool access |
| A2A | External communication |
| Workflow | Order management (Runtime) |
| RAG | Knowledge retrieval (Runtime) |
| Memory | Experience memory (Runtime) |

Once you understand what an agent is, know why you split it, and have learned which patterns to combine it with, the final piece of agent architecture fundamentals is designing the harness that robustly wraps them. Robust environment design comes before flashy autonomy.

---

## References

- MIT AI Agent Index (2025) — 4 essential characteristics
- Anthropic — "Building Effective Agents," 6 production patterns
- Google ADK / Azure Architecture Center — multi-agent pattern catalog
- Related articles: [Dissecting Open-Source Security AI Agents](/en/blog/oss-security-ai-agents/), [Agent Interoperability Standards](/en/blog/agent-interop-standards/)
