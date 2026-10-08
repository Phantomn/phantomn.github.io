---
title: Designing CTFs That Target LLMs - The Structural Weaknesses of Transformers
date: 2026-07-31T00:00:00.000Z
excerpt: >-
  In an era where LLM agents have started solving CTFs automatically, how do you design a
  challenge that "machines struggle with but a skilled human solves in a reasonable time"? This
  organizes the anti-LLM design principles that target the structural limits of transformers -
  state tracking, carry propagation, tokenization, and context loss.
tags:
  - ctf
  - llm
  - ai-security
  - anti-llm
  - red-teaming
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

LLM agents now solve CTFs. At the high-school level, automatic solving is reportedly close to saturation. But once you move up to finals-grade pwn/web/rev, the success rate remains low. **The core premise of anti-LLM CTF design is that this gap is not coincidental but stems from the structural limits of transformers.**

This article covers how to design a CTF challenge that "machines struggle with but a skilled human solves in a reasonable time." The method is to make what a transformer **cannot do at the architectural level** the bottleneck of the problem. One thing to state up front, though: the success-rate and benchmark figures cited here, along with some concrete techniques, are a synthesis of multiple sources, so there are parts that are not certain. **Anything that is not a definitive fact is cushioned with phrasing like "reportedly" or "an approach such as,"** and I recommend reading with weight on the **design principles** rather than the specific figures.

---

## Why Structural Weaknesses: Distinguishing Them From Environmental Weaknesses

Before discussing anti-LLM design, a decisive distinction is needed. LLM agents have two kinds of weakness.

**Environmental (scaffold) weaknesses** - weaknesses that arise because the agent cannot use a particular tool. For example, if browser automation (Playwright-style) or out-of-band (OOB) interaction tools are absent from the agent's environment, it cannot solve a problem whose flag exists only in DOM rendering, or one that requires DNS exfiltration. **But this weakness disappears the moment the agent comes equipped with that tool by default.** In fact, as browser and MCP tools have been integrated into agents, this class of "sweet spot" is reportedly closing rapidly.

**Structural weaknesses** - weaknesses that come from the limits of the transformer architecture itself. These **do not disappear even if you scale up the model or attach tools.** They remain valid unless the architecture changes.

**The place to invest in anti-LLM design is the latter.** A problem that relies on an environmental weakness has an expiration date tied to advances in the agent toolchain, but a problem that relies on a structural weakness lasts a long time. A good anti-LLM challenge designer targets not "a tool this agent currently cannot use" but "a computation the transformer fundamentally cannot do."

---

## The Structural Weaknesses of Transformers

The theoretical foundation of anti-LLM design is the computational limits of transformers. The following four are reportedly the most robust.

### 1. The Hard Limit on State Tracking (TC⁰)

This is the most fundamental limit. There is a theoretical result that the expressive power of a log-precision transformer is **confined to a computational complexity class called TC⁰** (Merrill & Sabharwal and others). In plain terms, a transformer **fundamentally cannot do deep sequential state tracking.**

Concrete computations reportedly caught by this limit:

- **Permutation composition** - composing several permutations in order (such as the word problem of the group S₅) is classified as NC¹-complete, and a model confined to TC⁰ is reportedly unable to solve it in principle.
- **Deep nested matching** - verifying deeply nested parentheses (Dyck languages).
- **n-step automaton simulation** - following a state machine through many steps and keeping the state exactly.

The key is that this is a **ceiling that cannot be overcome by model size.** No matter how much you increase the parameters, if the complexity class does not change, this computation is still impossible. So a problem that can only be solved by accurately tracking state transitions over many steps becomes a powerful anti-LLM device.

### 2. The Failure of Carry Propagation

LLMs are weak at carry propagation in arithmetic - that is, computations that carry over across many digits. There are reports that the accuracy of large-number multiplication drops sharply as the number of digits grows (e.g., accuracy falls significantly in multi-digit multiplication), and repeated bit operations such as **XOR round chains, bit-rotation (rotl) chains, and modular exponentiation** are reportedly nearly unsolvable without an explicit chain of thought (CoT).

This shares the same root as the state-tracking limit above. Both carrying and repeatedly applying a round function ultimately amount to **keeping sequential state exactly.** So if you put a multi-round bit-operation chain into flag-validation logic, a human can just reproduce it with a script, but an LLM cannot carry that state along in its head.

### 3. The Discontinuity of Tokenization

Transformers process text in units of tokens, and this tokenization creates several discontinuities. Some of the BPE vocabulary is reportedly barely trained - so-called **glitch tokens** - and certain regions of Unicode (zero-width characters, homoglyphs, bidirectional control characters, etc.) disrupt the model's perception. This property is mostly discussed in the context of prompt injection and guardrail bypass, but in CTF it can be used to hide the flag or key data in a representation that tokenization distorts.

### 4. Context Loss (Lost in the Middle / Context Rot)

There are reports of a phenomenon where the model misses information placed in the **middle** of a long input (research showing performance draws a U-shape by position). If you hide a key clue in the very middle of a long disassembly result or a vast body of source code, the LLM may miss it for purely structural reasons. This weakness, however, has room to be mitigated by advances in context length and retrieval augmentation, so it can be seen as belonging to a less durable axis than the first two (state tracking and carry).

---

## Common Design Principles

Before getting into concrete techniques, let me organize the design principles that multiple sources have converged on in common.

**Distribution shift.** Deviate from the model's training distribution. Constructing a problem in a form that appears rarely in training data - a non-mainstream architecture (e.g., a less common embedded ISA), an esoteric language, messy decompiler output - neutralizes the model's strength (memorizing patterns).

**Make it impossible by static reading; force dynamic interaction.** This is the core conclusion that multiple sources emphasized in common. If it can be solved just by "reading" the code, that favors the LLM. If you make it solvable only by experimenting and observing while changing state (dynamic debugging), the weakness in sequential state tracking is exposed head-on.

**Multi-artifact, multi-format.** Making the solver track state across a binary, a packet capture, logs, and scripts increases the burden of maintaining consistent state while moving across contexts.

**Protection at just one layer is weak - a chain is strong.** A single technique can be broken by a stronger model or a specific tool. **A combination that requires multiple modalities in sequence** is far stronger. Because the failure probability of each step multiplies, the overall success rate plummets. For example, chaining heterogeneous abilities like `math → crypto → custom VM`.

**Prompt injection only as an auxiliary layer.** You can disrupt the model by planting instructions like "stop the analysis" in the source or comments, but **you must not make this the core difficulty device.** It is easily neutralized by a stronger model. It is, at most, a secondary friction element.

---

## Techniques by Field (Read With a Cushion)

The techniques below are a synthesis of community discourse and the answers of various models, and **the effect or success rate of an individual technique depends heavily on conditions.** I recommend reading them to understand the principles.

### Reversing

- **Custom VM / proprietary ISA** - an approach that makes you reverse a VM interpreter instead of the original code. What the decompiler shows is not the original logic but the control flow of the VM interpreter. If you keep the number of handlers moderate, a human solves it in about a day but it is reportedly very hard for an LLM.
- **Mixed Boolean-Arithmetic (MBA)** - an approach that wraps the flag comparison `if(computed == target)` in an MBA expression. However, fixed MBA alone can be solved by symbolic execution and simplification tools, so it is reportedly better used as glue combined with other layers.
- **anti-disassembly** - distorting the disassembly result with tricks that poison overlapping instructions or the linear sweep. It is said to be low in authoring cost and high in effect.
- **Debug-info misdirection** - an approach that renames the symbol of the flag-validation function to an innocuous name to lure the model into ignoring it.

The core principle is consistent: **make the surface shown by the decompiler/disassembler not the real logic.** Because LLMs rely heavily on patterns in tool output, making that output untrustworthy collapses their strength.

### Pwnable

- **State-based I/O / stage gating** - an approach where the attack surface is exposed only after going through state transitions, like `banner → nonce → capability unlock → vulnerable behavior`. Instead of terminating immediately on a mismatch, giving a plausible fake response (fail-soft) further disrupts automated exploration.
- **Non-standard heap/allocator** - requiring an exploit on an allocator other than standard glibc (e.g., what is reportedly musl's mallocng) can lure the model into misapplying common ptmalloc patterns.
- **Race/nondeterminism** - nondeterministic elements like race, TOCTOU, and userfaultfd neutralize static analysis.
- **Kernel/eBPF** - an area reportedly with relatively thin training coverage.
- **Deep state machines** - a structure that is triggered only by entering many stages in a specific order. It directly targets the state-tracking limit mentioned earlier.

The most powerful thing in Pwnable is **the combination of nondeterminism and deep state transitions.** If the very success condition of the exploit requires passing exactly through many states, the weakness in sequential state tracking becomes the bottleneck directly.

### Web

- **DOM/rendering dependence** - an approach that places the flag not in the HTTP response body but only in the rendering result (e.g., an element hidden on screen, a Canvas, a closed Shadow DOM). But this is the **environmental weakness** mentioned earlier, so it disappears once the agent supports browser automation.
- **HTTP/2 concurrent-send race** - a race where you have to send multiple requests precisely at the same time. A human does it with a tool in a minute, but an LLM reportedly finds the very abstraction of "concurrent sending" hard to handle.
- **OOB / live environment** - a problem that requires out-of-band interaction (DNS/HTTP callback). This too is on the environmental-weakness side.
- **Endpoint noise / decoys** - misleading automated exploration by scattering numerous fake vulnerability hints (honeypots). There are reports that agents chase red herrings.
- **Parser differential** - a mismatch that makes the validating side and the processing side trust different fields.
- **Asynchronous privilege-escalation chain** - a structure where a normal user creates a state, an admin bot asynchronously processes it, and the flag comes out. It is solvable only by modeling the entire causal chain.

What lasts **structurally** in Web is things that require accurately reasoning about **causal relationships spanning multiple components** - parser differentials, asynchronous privilege chains, and business-logic flaws. DOM/OOB dependence has an expiration date.

### Combination Strategy

As emphasized earlier, a **cross-field chain** is stronger than a single technique. For example, chaining heterogeneous stages like `obfuscated binary → custom VM → network protocol parsing → web race entry → non-standard heap pwn → read the flag with restricted syscalls` makes the whole thing very low as the product of each stage's success rate. This is understood to be the structural reason finals-grade problems resist automatic solving.

---

## Fairness: The Goal Is Not "Make It Unsolvable for Humans Too"

This is the most frequently misunderstood point in anti-LLM design. **The goal is to block the LLM, not to block humans.** A good educational CTF must keep the following.

- **Fail-soft** - do not terminate immediately on one mistake (fail-hard); fail gently and leave room to retry. Immediate termination destroys the human player's learning experience.
- **A stable path to victory** - there must exist a reproducible solution path reached by understanding, not luck.
- **An observable invariant** - there must be at least one observable signal by which a player can confirm they are on the right track.
- **Timely hints** - a hint system that helps progress when stuck.
- **Prompt traps must not be the core difficulty** - as said earlier, prompt injection should be secondary.

For a verification procedure, an approach of evaluating baselines under several conditions before release (pure LLM only / LLM + tools / fully automated / human pilot) is recommended. An especially important metric is the **family robustness gap** - if merely renaming the problem's variables suddenly makes it harder, it is a bad problem. Good anti-LLM difficulty should come from structural difficulty, not surface-level variation.

---

## An Adjacent Horizon: VLA Physical Red-Teaming

If an anti-LLM CTF is about "targeting the limits of LLMs in the text/code domain," an adjacent area has a new attack surface where **a language-model jailbreak transfers into physical action.** It is a problem that arises as vision-language-action (VLA) models get integrated into physical platforms like robots and autonomous driving.

The key insight is that the fact that **the result of a jailbreak is not text but physical motion** qualitatively changes the risk. Benchmarks like RoboJailBench are systematizing this attack surface (research reportedly under arXiv 2605.19328), and the gist is:

- Jailbreak techniques that work on LLMs/VLMs **transfer to embodied robot policies.** Conceptual-deception-style attacks reportedly showed a high success rate (reported in the 70s percent) on certain VLA models.
- Multiple attacks show substantial success rates per dataset, and **they do not generalize to a single defense.** There is a report that the ranking of two defense techniques flips depending on the dataset, so the conclusion of this research is that there is not yet a decisively robust defense.
- The benchmark's violation categories are reportedly derived not from arbitrary classification but from **ISO standards, regulations, and documented incident cases.**

An ordinary LLM jailbreak ends in harmful text generation, but a VLA jailbreak can induce **behavior that bypasses physical constraints such as contact force and the safe distance from bystanders in real time.** That is, unlike "safety violations that occur accidentally during normal operation," this one has a different threat model in that it is a **violation induced by intentional adversarial input.**

Here too, though, a cushion is needed. The reported attack success rates are figures limited to specific models and specific dataset conditions, and are hard to generalize as-is to other VLA architectures or actual commercial deployment environments. Reproduction on real robot hardware (beyond simulation) does not appear to be sufficiently reported. This area is still early, and it is appropriate to take what is written here not as a settled conclusion but as a **noteworthy research trend.**

---

## Summary

The essence of anti-LLM CTF design is compressed into the following.

1. **Target structural weaknesses, not environmental ones.** Do not rely on weaknesses that disappear when a tool is attached (DOM/OOB); invest in weaknesses that disappear only if the architecture changes (state tracking, carry propagation).
2. **Make it require dynamic interaction, not static reading.** A problem that can only be solved by experimenting while changing state hits the transformer's sequential state-tracking weakness head-on.
3. **Use a chain, not a single technique.** A chain of heterogeneous stages collapses automatic solving as the product of the success rates.
4. **Do not lose fairness.** The goal is to block the LLM, not humans. Maintain fail-soft, a reproducible path to victory, and an observable invariant.

And behind all of this is one fact. **The agent toolchain is advancing rapidly, and the environmental sweet spots keep closing.** Anti-LLM difficulty that survives a long time comes from computations the transformer fundamentally cannot do. That is why this article spent more space on structural limits than on tool tricks.
