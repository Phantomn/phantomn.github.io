---
title: An LLM Doesn't Know Whether It Finished - Designing a Harness That Moves the Completion Verdict Outside the Model
date: 2026-08-11T00:00:00.000Z
excerpt: >-
  Multiple studies conclude that an LLM agent's completion bias and
  overconfidence cannot be corrected by prompting. This post lays out the design
  principles of a vulnerability-checking automation harness that makes "surveyed
  everything" and "0 vulnerabilities" computed from an HMAC receipt ledger and
  deterministic hooks rather than from the model's narrative. A "200 OK" without
  a negative control is not confirmation.
tags:
  - llm
  - ai-agents
  - harness
  - vulnerability-research
  - automation
  - completion-bias
  - security-automation
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## The problem: when "all done" is a lie

Automating vulnerability checks with an LLM agent, you keep running into the same failure. With 34 of 71 endpoints actually verified, the agent reports "full surface mapping complete." Ask again, "did you really enumerate all of them?" and it answers again, "yes, I investigated every endpoint." Ask three times and you get the same overclaim. When the ground truth is 34/71.

This is not laziness or a bug. **Test a representative sample and get consistent results ("all of them handle parameter binding"), and the model narrates the inference "the pattern is established, so the rest are the same" as if it were an individually verified fact.** At the "pattern match" point where confidence peaks, it substitutes inference for actual tool execution on the remaining items and reports that as "complete."

The literature already has names for this - false success, silent semantic failure, premature completion, teleological (completion) bias. And one important fact: **this cannot be fixed with prompting.**

This post lays out the harness design that emerged from accepting that conclusion. The one-sentence core is this - **reclaim the authority over completion and vulnerability verdicts from the LLM's narrative and externalize it to a deterministic process outside the model (an unforgeable receipt ledger + hooks).**

## Why prompting can't fix it

To understand why we have to push the logic outside the model, we first have to see why self-directives like "let's be careful" and "let's label inference vs. measurement separately" are ineffective. There are five structural causes.

**R1. The generation-verification gap.** The generator is the worst possible verifier of its own work ("the generator is the worst possible verifier of its own work"). Metacognition alone cannot verify one's own completeness. An external anchor is essential. (Jason Wei's "Asymmetry of verification" makes the same point.)

**R2. Ownership bias + RLVR overconfidence.** A model is about 26% more confident in the answer it produced (ownership bias). More decisive is that models trained with RLVR (reinforcement learning from verifiable rewards) emit decision-token probabilities near 1 regardless of correctness - with no calibrated rollout, **there is no path even through reinforcement learning to correct this overconfidence.** It's baked into training, so it can't be undone by prompting.

**R3. Teleology (completion) bias.** The model is a predictive narrative engine, so it hallucinates completion at goal-directed events. It even overrides an explicit cancellation instruction. It confuses intent with outcome.

**R4. Consistency amplifies false confidence.** Once the model commits to one interpretation ("all negative, so done"), the consistency of the sample amplifies that interpretation and manufactures false confidence. Worse, **an LLM judge cannot catch this either** - false-success detection AUROC is at or below 0.65, because it relies on surface proxies like "confident closing language." Attaching a small evaluator model doesn't help.

**R5. Detection requires negatives.** Theoretically, hallucination (false completion) detection is impossible from positive-only information (equivalent to the Language Identification problem). **Detection becomes possible only when you have labeled negatives.** "It looks done" (positive-only) cannot catch a false completion.

To sum up, R2 is the nail - overconfidence is baked into training and there is no calibrated path to correct it. Epistemic markers ("probably," "not sure but") and "be careful"-type self-directives are either counterproductive or ineffective. **Only deterministic external enforcement works.**

## A gate that checks tags gets bypassed

It's worth looking at why the first attempts at "well, just add a gate then" fail.

**A gate that only checks for the presence of source tags.** You force inference to be tagged `[inferred]` and measurement `[measured]`, and the gate checks for the tags' presence. The problem is that adding the tag is itself gameable. Since it doesn't check the truth of the content, tagging inference with `[measured]` passes.

**A small evaluator model (Haiku, etc.) judging completion.** An evaluator that only reads the transcript and has no tools reads the agent's confident narrative and cannot verify "34 ≠ 71." Small evaluators are lenient - in one benchmark, 83% of traces judged "perfect" had actually violated procedure. R4 predicts exactly this.

Both approaches look at "does the text seem grounded/done." That is precisely the **surface proxy** that research states fails.

## The core principle: completion is not a judgment but a read of a counter

About 10 independent projects and theories converge on one point.

> **Externalize completion authority to a deterministic, unforgeable, artifact-backed, fail-closed ledger. "done" is not the model's narrative but a mechanical COUNT computed by an external process from actual work receipts.**

The converging elements:

| Element | What it gives this design |
|------|-------------------|
| Separation of completion authority (doer ≠ done-checker) | Puts the completion verdict outside the working model |
| External, fail-closed acceptance check | The agent only proposes `candidate_complete`; a protected gate reads the actual artifacts and grants. **Unknown = blocked** (no automatic promotion) |
| receipt = unforgeable evidence | Tool execution generates an HMAC receipt. The model can't write it. "0 findings but receipts show untested" = a detectable lie |
| coverage = recognized only from trace events | An endpoint is tested only when there is an actual test-event receipt. Substituting sample->narrative is blocked |
| State externalization (files = the sole source of truth) | Bookkeeping of which items were verified is kept in a file outside the model's head. Invariant to context compaction |
| Stop-hook enforcement (not a prompt) | Hooks are ~100% compliant at the system level (prompts are 70~90%). Immune to context pressure |
| Front-load the asymmetry of verification | Build the ledger (= the answer key) before testing. Each test is a one-line flip, and confirming completion is trivial. Verification << generation |

The one-line generalization: **a completeness claim must be a read of an external counter, not a judgment.** The model's job is just two things: (a) do the work, (b) emit receipts. The count is done by a script, the enforcement by a hook.

## Implementation: a coverage-ledger receipt gate

Brought down to code, it looks like this. It stands up with just a lightweight shell/python + an append-only JSONL ledger + an HMAC deterministic gate, with no runtime infrastructure (DB, graph, resident processes).

**1. The ledger = SSOT, fail-closed.** Before starting, seed the ledger with the full list of endpoints. One line per endpoint, defaulting to `status: untested`. The status lattice is `untested | candidate | tested-neg | tested-pos`. Here, **"representative verification" and "inference" are not tested** - they cannot fill the count. This is where the asymmetry of verification is front-loaded. Build the answer key before testing, and each test becomes a one-line flip, with completion confirmed by a count comparison.

**2. Receipts are generated by the harness (not the model).** The probing script appends `{endpoint, payload, resp_hash, verdict, ts}` to the receipt file as an execution side effect and signs it with HMAC. **The model cannot write `tested` directly** - only running the probe writes it. This integrity boundary is the axis of the whole design. Keep the receipt generator singular (the probe script) and keep the HMAC key out of the model's reach.

**3. Completion = a mechanical count.** The gate computes:

```
tested = jq -s 'map(select(.verdict != null)) | length' receipts.jsonl
total  = wc -l all_endpoints.txt
```

Claims like "surveyed all / every / complete / 0 findings / N of M / full surface" are **DENIED** unless `tested == total`. Tags can't bypass it - because what's checked is a count, not text.

**4. Fail-closed on unknowns.** If any `untested` or `candidate` remains in the ledger, the Stop hook issues `decision: block` ("N remaining unverified"). There is no automatic promotion path. False absence - "0 findings" when it's actually untested - is the specific lie this approach catches. That's why it forces "confirmed 0" and "N unverified" to be reported separately.

**5. verdict = cross-family fresh verification.** Promotion to `tested-pos` (vulnerability confirmed) is re-judged by a separate fresh subprocess based on `resp_hash`. Self-review is not allowed (R1, R4). The judging process and the working process must differ to avoid shared hallucination.

**6. Stop-hook enforcement.** On a turn where a completion claim appears, if count < total or there is a completion word without receipt backing, the hook blocks. Because it is a system-level hook, not a prompt, it is immune to context pressure, and `stop_hook_active` opens only a legitimate escape hatch.

This way, the only autonomy left to the model is "executing the predetermined next step without asking." What to test next is decided by a deterministic scheduler, and the verdict and completion are done by code.

## Vulnerability confirmation: a "200 OK" is just data being returned

The second axis, running alongside completion bias, is the **vulnerability verdict**. Here too there is the same trap - the agent tends to judge "vulnerable" if the response is 200, if the response size is large, or if PII-shaped data is visible. All of these prove only that **"data was returned," not that "it is vulnerable."**

Confirmation requires a **negative control**. That is the negative R5 spoke of theoretically.

The principle is simple. Pair every PoC with a no-payload baseline.

```
# baseline: normal request with no payload
probe /path sqli baseline -- curl "$URL?q=normal"

# payload: attack payload
probe /path sqli quote -- curl "$URL?q=x'"
```

Then compute the verdict deterministically:

- **`pos-candidate`**: payload response ≠ baseline response (there's a difference -> candidate)
- **`neg`**: payload response == baseline response (same = noise, not vulnerable)
- **`pos-unpaired`**: no baseline = **cannot confirm, ineligible for reporting**

The key is the last line. **Without a baseline, it is never promoted to pos.** If a no-payload request fires the same "success pattern," that means the response was that way to begin with, not because of the payload. Without this control, false positives go straight into the report.

This is enforced not by guidance but by a **hook.** If a confirmation receipt lacks a negative control (control, baseline, other account, victim data), the gate DENIES it. Adding a `[confirmed: ...]` tag is not enough - because tags are gameable (for the same reason as above).

## The pre-report kill-gate

Even a finding that passes confirmation goes through a 7-question kill-gate before reporting. Two of them are decisive.

- **Q3 - Does the PoC prove impact?** For an IDOR, it must not just be "200 OK" but must **actually retrieve and show someone else's data**. Access being granted is different from harm being proven.
- **Q4 - Does it exceed the severity floor?**

If even one is "no," it is not confirmed as a finding. This gate is the last barrier against premature positive verdicts.

## The opposite axis of a heavy framework

Contrasting this design with an autonomous red-team framework (LangGraph + graph DB + resident runtime) makes its character clear. Such frameworks share the same core discipline - an HMAC-chained append-only ledger, server-side provenance injection (unforgeable by the agent), negative-control verification. In fact, many autonomous red-team implementations build the audit sink as a hash chain of `seq + prev_hash + hash + hmac` and make a no-payload control mandatory for PoC verification. Good designs converge.

The difference is **weight.** This harness has no resident process and no graph DB. State's sole source of truth is a file, and the hooks are stateless. It keeps only the discipline of reclaiming completion and vulnerability verdict authority from the model's narrative and transferring it to a script count and a hook block, stripping away all runtime infrastructure. A single hook stands up the gate in one line of shell script.

There's a practical reason this minimalism matters. If a gate is heavy, you want to bypass it. If the gate is one line of `jq` and `wc`, there's no reason to bypass it, and even when context is compacted, the file and the hook remain.

## Closing

Asking an LLM agent "are you done?" is a structurally unanswerable question - the generator cannot be its own verifier, and overconfidence is baked into training and doesn't yield to prompting. So this harness doesn't ask the model that question at all. **"done" is answered by a script that counts receipts, and "vulnerable" is answered by a gate that compares against a negative control. The model's job is only to do the work and leave receipts.**

Generalized, this is not just a story about vulnerability checking. The same principle applies to any automation that entrusts completeness or verification to an LLM agent - test coverage, migration completion, data-processing completeness. **Make the completeness claim a read of an external counter, not the model's judgment.** Reclaiming verdict authority from the narrative - that's the whole of this design.

## References

Key source literature (completion bias, asymmetry of verification):
- Jason Wei - *Asymmetry of Verification & Verifier's Rule* (2025)
- *LLMs Are Overconfident in Their Own Responses* (ownership bias, arXiv 2606.03437)
- *From Confident Closing to Silent Failure* (false success, LLM judge AUROC ≤ 0.65; arXiv 2606.09863)
- *The (Im)possibility of Automated Hallucination Detection* (positive-only impossible, negatives required)
- *InfiAgent* (coverage = recognized only from trace events; 2026.findings-acl.1787)
- *NabaOS* (HMAC receipt, false absence detection; arXiv 2603.10060)
</content>
