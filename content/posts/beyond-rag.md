---
title: Beyond RAG — 8 RAG Variants and Agent Memory Design
date: 2026-08-01T00:00:00.000Z
excerpt: >-
  Starting from Naive RAG's 7 limitations, this post compares 8 variants including
  Graph RAG, RAPTOR, and Agentic RAG, and covers practical design for embedding
  dimensions, chunking, and hybrid search through the 3 levels of agent memory.
tags:
  - rag
  - agent-memory
  - embeddings
  - retrieval
  - ai-agents
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## TL;DR

Naive RAG (question -> retrieve -> generate) runs into seven limitations in practice. Attempts to overcome them spawned many variants such as Graph RAG, RAPTOR, and Agentic RAG, but **as of 2025 the answer is not a single silver bullet — it's a hybrid combination tailored to the domain**.

Three core claims first.

- **Retrieval quality is the foundation of overall system quality.** Noise can be cleaned up by the LLM, but Missing Evidence (a missing correct document) is unrecoverable. That's why Recall@k takes priority over Precision@k.
- **RAG and Memory are different.** RAG is external knowledge (a textbook); Memory is personal experience (a medical chart). Neither can substitute for the other.
- **Variant choice depends on the nature of the problem.** Relational reasoning calls for Graph RAG, multi-level abstraction calls for RAPTOR, and complex/varied questions call for Agentic RAG.

---

## 1. Naive RAG and Its 7 Limitations

### What is RAG

RAG (Retrieval-Augmented Generation) is a technique where an LLM first retrieves relevant information from an external knowledge base and injects it as context before answering. Traditional RAG operates in four stages.

1. **Ingestion** — split documents into chunks and convert them into vector embeddings
2. **Storage** — store the embeddings in a vector DB
3. **Retrieval** — embed the query as well, then search for similar chunks by cosine similarity
4. **Generation** — inject the retrieved chunks into the LLM as context

The reason to use RAG comes from the trade-off with fine-tuning. If you need up-to-date information, private internal documents, or real-time data, RAG is the right fit; if the goal is learning a specific style or domain language pattern, fine-tuning is the right fit. RAG is cheap (vector DB + retrieval), updates instantly just by adding documents, and carries low hallucination risk since it's grounded in source documents.

### 7 Fundamental Limitations

Naive RAG breaks down at the following seven points.

```
1. No relationships    — chunks are independent, can't be linked to each other
2. Context loss        — chunking destroys surrounding context
3. Single retrieval    — one retrieval pass isn't enough for complex questions
4. Middle omission     — Lost in the Middle (ignores info in the middle of long context)
5. No abstraction      — only fine-grained chunks exist, no overall summary
6. No time awareness   — can't distinguish recency of information
7. No contradiction handling — can't judge between conflicting information
```

There are also structural limitations of the vector DB itself: infrastructure burden (vector DB + embedding model + API), context loss at chunk boundaries, "similarity != relevance" (cosine similarity doesn't always capture actual semantic relevance), being a black box (hard for humans to directly inspect/audit the store), and re-indexing overhead.

These limitations gave rise to every RAG variant that followed.

---

## 2. The 3 Generations of RAG Evolution

RAG evolved through three generations.

```
Gen 1 Naive     question -> retrieve -> generate (simple)
Gen 2 Advanced  quality improvements before/after retrieval
Gen 3 Agentic   Agent autonomously decides the retrieval strategy
```

### Generation 2: Advanced RAG

Advanced RAG optimizes both before and after retrieval.

**Pre-Retrieval.** Query Rewriting ("tell me about that" -> "explain the definition of AI Agent"), Query Expansion ("agent" -> "agent OR AI agent OR autonomous system"), HyDE (generate a hypothetical answer to the question, then search using that answer).

**Post-Retrieval.** Reranking (reorder by relevance), Filtering (remove low-relevance documents), Compression (extract only the essentials from long documents).

On top of this, Anthropic's **Contextual Retrieval** improves the indexing stage — a method of adding context to each chunk.

```
Original: "Company revenue grew 3%"
+ Context: "In ACME Corp's 2023 Q2 SEC filing..."
-> "ACME Corp 2023 Q2... revenue grew 3%" (embedded in this form)

Performance: retrieval failure rate reduced by 67% (including Reranking)
Cost: 69% reduction via prompt caching
```

### Generation 3: Agentic RAG

Agentic RAG lets the Agent autonomously decide its retrieval strategy. It judges "this is complex, let's search twice," evaluates the first result and revises the query, re-searches, and even attaches self-verification to the answer. It's flexible, but going through multiple reasoning passes makes it slow and costly.

---

## 3. 8 Structural Variants

Separate from the three-generation evolution, there are 8 variants based on structure.

| Type | Core idea | Suited to |
|------|------|------------|
| **Single-hop** | one retrieval pass | simple facts |
| **Multi-hop** | retrieve -> reason -> re-retrieve | "What is C of B of A?" |
| **Graph RAG** | knowledge graph | relational reasoning |
| **Self-RAG** | LLM self-judgment | hallucination prevention |
| **CRAG** | corrects the result | when confidence is low |
| **Adaptive RAG** | strategy auto-selected by complexity | mixed question types |
| **RAG-Fusion** | multiple queries | ensuring diversity |
| **RAPTOR** | tree summarization | multi-level abstraction |

Let's look at a few in detail.

**Graph RAG** — uses a knowledge graph instead of vectors. By explicitly representing entities and relationships like `[Kim Cheolsu] --belongs to--> [Security Team] --led by--> [Park Younghee]`, it's strong at relational reasoning and multi-hop questions.

**Self-RAG** — the LLM judges for itself "is retrieval needed?", "is this relevant?", "is there evidence?" to reduce hallucination.

**Corrective RAG (CRAG)** — an evaluator judges the retrieval result: use it if accurate, re-retrieve if ambiguous, fall back to web search if wrong.

**Adaptive RAG** — automatically selects a strategy based on question complexity. Simple questions go to the LLM alone, moderate ones to Single RAG, complex ones to Multi-hop + Self-RAG.

**RAG-Fusion** — expands the question into multiple variants, retrieves for each, then merges the results. "Python async" -> split into "asyncio", "concurrent.futures", "threading vs async" searches, unified via Reciprocal Rank Fusion.

**RAPTOR** — summarizes documents as a tree. In the `[whole] -> [section] -> [chunk]` hierarchy, details come from the leaves and overviews come from the root.

---

## 4. Beyond RAG — 6 Approaches That Overcome the Limitations

Here are six approaches that directly target the seven limitations above, along with their performance and cost.

### 1. Graph RAG — Making relationships explicit

Extracts entities and relationships from documents to build a graph, pre-summarizes community clusters, and retrieves based on relationships. It gives roughly a 20% improvement on multi-hop questions and clear evidence provenance, but construction cost is high and real-time updates are difficult.

### 2. CAG (Cache-Augmented) — Removing retrieval

Eliminates retrieval entirely. The entire knowledge base is loaded into a cache up front, and the LLM generates directly from it.

```
RAG = finding and reading a book in a library (retrieval errors possible)
CAG = spreading every book out on your desk (no retrieval)
```

Retrieval errors disappear, caching cuts cost by 90%, and responses are very fast. The downside: knowledge size is capped at roughly 1M tokens, and real-time updates aren't possible.

### 3. RAPTOR — Multi-level abstraction

The tree-summarization structure covered earlier. Gives roughly a 20% improvement on complex reasoning, but tree construction cost and difficulty with dynamic updates are drawbacks.

### 4. RAG-Fusion — Multiple queries

Recall improves by roughly 40% and implementation is simple, but the number of searches increases, and the actual gain after reranking is only about 5-10%.

### 5. Long Context — Skipping RAG altogether

Instead of chunking and retrieving from a million tokens, everything is put directly into context. The architecture is simple and there are no retrieval errors, but cost scales with token count and the Lost in the Middle problem remains.

### 6. Agentic RAG — Autonomous strategy

The third generation described earlier. Flexible, auto-recovers from errors, and can use multiple tools, but it's slow, costly, and complex to implement.

### Selection guide and the 2025 optimum: Hybrid

```
Fixed, small knowledge base?  -> CAG
Relational reasoning core?    -> Graph RAG
Complex, varied questions?    -> Agentic RAG
Need a quick build?           -> Long Context / RAG-Fusion
Need best performance?        -> Combine them (Hybrid)
```

There is no silver bullet. The optimal 2025 strategy is a hybrid tailored to domain characteristics.

```
[1] Agentic Layer     — "Is retrieval needed? Which method?"
[2] Retrieval Layer   — Vector (semantic) + BM25 (keyword) + GraphRAG (relational)
[3] Integration Layer — Reciprocal Rank Fusion + Reranking
[4] Generation Layer  — CAG for fixed knowledge / Long Context for long documents / RAPTOR for complex reasoning
```

---

## 5. Practical Retrieval Design — Embeddings, Chunking, Hybrid Search

Beyond choosing a variant, running an actual pipeline requires getting three decisions right: embedding dimensionality, chunking, and hybrid search. As an example, this section uses a domain with deep semantic layering, such as standards documents (e.g. IEC 62443-4-2).

### Choosing embedding dimensionality

An embedding vector represents text meaning as coordinates in a high-dimensional space. The dimension count is "the capacity of the space available to store meaning." When dimensionality is too low, **Semantic Collision** occurs — the representation space runs out of room, so distinct meanings end up sharing the same dimensions. For example, the vectors for "malware prevention EDR 3.2" and "malware prevention HDR 3.2" can become too close, causing unrelated clauses to be retrieved together.

| Item | 1536 dimensions | 3072 dimensions |
|------|----------|----------|
| Suited for | general technical docs, manuals | standards, legal, regulatory documents |
| Cost/speed | efficient | 2x storage, 2x compute |
| Recommended strategy | initial baseline | switch after 1536 hits its limits |

The rule of thumb is "start with 1536, switch to 3072 if precision falls short." That said, 1536 combined with an advanced retrieval pipeline can approach 3072-level quality.

### Chunking strategy

The most dangerous mistake is **Semantic Fragmentation**. Splitting by raw character count can, for example, break a Korean compound word mid-character, causing the LLM to misread it as two unrelated words glued together.

```
Bad example (fixed-token splitting):
  Chunk 1: "...the security patch procedure is as follows. The first"
  Chunk 2: "step is to run the system update..."
  -> "The first" and "step is" get separated

Good example (sentence boundaries + overlap):
  Chunk 1: "...the procedure is as follows. The first step is..."
  Chunk 2: "The first step is... the second step is..."
  -> overlap preserves context
```

The recommendation is 2-5 sentences per chunk, with 20-30% overlap. For standards documents, chunking at the level of a clause's detailed sub-item (3-5 sentences) is most stable.

There's also a trade-off in top-k. Increasing k raises Recall@k but lowers Precision@k (more noise, higher cost); decreasing k risks missing the correct document (Cross-Encoder Reranking can't fix that). In practice the sweet spot is k = 5-10, with k = 7 for standards documents.

### Hybrid search: BM25 + Vector

BM25 and Vector have complementary weaknesses.

| Method | Strength | Weakness |
|------|------|------|
| **BM25** | exact token/code matching ("CR 3.2", "502") | doesn't match synonyms |
| **Vector** | semantic search ("malware" <-> "malicious code") | weak at precise code/number matching |

Vector alone tends to encode "502 / 500 / 504" as similar, or make "EDR 3.2" vs "HDR 3.2" too close. BM25 alone can't catch "malware prevention" vs "malicious code protection". So they're combined as `Hybrid = BM25 x alpha + Vector x (1-alpha)` (typically starting with alpha = 0.5).

The full pipeline looks like this.

```
1. Query normalization    — standardize terminology (e.g. spelling variants of "malware")
2. BM25 first-pass filter — narrow candidates by number/abbreviation/keyword
3. Vector top-k search    — semantic candidates (k = 7)
4. Metadata filtering     — filter by type/FR/topic metadata
5. Cross-Encoder ReRank   — fine-tune final ordering among candidates
6. Only the selected chunks are passed to the LLM as context
```

Cross-Encoder Reranking is the core of the two-stage retrieval. The first-stage Bi-Encoder is fast but less precise, so it pulls the top 20 candidates; the second-stage Cross-Encoder feeds the question and each document together for precise scoring and picks the top 5-7. Because the slow Cross-Encoder is only applied to 20 candidates, speed is preserved.

### Why Recall@k comes first

> "An LLM can state a fake answer when the correct document is missing, but noise can be cleaned up by the LLM."

This single sentence determines RAG design priorities. Recall@k (the probability the correct answer is included within top-k) comes first, and Precision@k (the proportion of top-k that's actually relevant) is secondary. If the correct document isn't retrieved, the LLM hallucinates without grounding — but noise can be filtered out by the LLM.

### Why Self-Healing is necessary

Agent pipelines have many steps. Even at a 95% success rate per step, with 20 steps the overall success rate drops to roughly 35%.

```
1 step:   95%
5 steps:  77%
10 steps: 60%
20 steps: 35%   <- a complex agent task
```

**Self-Healing** is a stability layer that absorbs local failures midstream instead of letting them cascade into a global failure. Network/API failures are handled with backoff retries, retrieval failures with Query Rewriting plus a different strategy, invalid parameters with error classification and correction, and logic errors with re-planning. If vector search fails, it falls back to BM25; if BM25 also fails, to direct keyword search; and at the global level, the Orchestrator detects the failure and switches to a "respond using general knowledge only, without retrieval" mode.

---

## 6. RAG vs Memory — External Knowledge vs Personal Experience

Finally, let's distinguish **Memory**, which is often confused with RAG. Memory is an Agent's ability to store and recall information.

```
RAG:    "search external documents"  (knowledge someone else created)
Memory: "store its own experience"   (knowledge the agent itself created)
```

### The 3 levels of agent memory

Memory maps onto the human memory system.

| Human | Agent | Description | Example implementation |
|------|-------|------|---------|
| Working memory | Short-term | the task at hand right now | context window / task tracking |
| Episodic memory | Mid-term (Episodic) | "it failed last time" | record of past experience |
| Semantic memory | Long-term (Semantic) | "commit messages should be in Korean" | learned rules |
| Procedural memory | — | "how to make a commit" | Skills |

Short-term memory via the context window is fastest but size-limited; mid-term persists across conversations and is referenced in later ones; long-term is permanent and applies to every conversation.

### The difference between RAG and Memory

| | Memory | RAG |
|--|--------|-----|
| What's stored | own experience | external documents |
| Volume | small (tens to hundreds) | large (tens of thousands to millions) |
| Created by | the Agent itself | a person/external source |
| Storage method | text files | vector embedding DB |
| Retrieval | direct read | similarity search |
| Analogy | a diary, a medical chart | a library, a textbook |

The doctor analogy makes this clear. RAG answers "what's the general treatment for this symptom?" using medical textbooks and paper databases; Memory recalls "this patient is allergic to penicillin" from this specific patient's chart. Both are information, but they differ in nature — you don't put a textbook into a medical chart, or vice versa.

The practical distinction is simple too: if it's useful to everyone and there's a lot of it, it's RAG (shared knowledge, vector search); if only you need to know it and it's just the essentials, it's Memory (personal experience, file read).

### The correct storage strategy for long-term memory

One caveat: dumping all past conversations into a vector DB causes data to explode, with rising duplication and noise dropping both Recall and Precision. The correct strategy is to **summarize** past conversations into semantic units first, then vectorize them. This raises semantic density, reduces duplication and noise, and improves retrieval quality, speed, and cost all at once.

---

## Summary

Starting from the simple premise "question -> retrieve -> generate," RAG branched into eight variants and six extensions as it overcame its seven limitations one by one. But the real-world conclusion isn't a single flashy technique.

- **Retrieval quality is the foundation of everything.** Prioritize Recall@k and prevent Missing Evidence.
- **There's no silver bullet.** A hybrid combining Graph RAG, RAPTOR, CAG, and Agentic RAG to fit the domain is the 2025 answer.
- **Don't mix RAG and Memory.** External knowledge (a textbook) and personal experience (a medical chart) need different storage and different strategies.
- **Long pipelines require Self-Healing.** At 20 steps, success rate drops to 35%. Without a layer that absorbs local failures, a complex agent won't hold together.

Going beyond RAG doesn't mean abandoning vector search. It means precisely diagnosing the nature of the problem and having the design sense to combine the right retrieval, abstraction, and memory strategies for it.

---

## References

- Original RAG paper: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (NeurIPS 2020, arXiv 2005.11401)
- REALM (PMLR 2020), Dense Passage Retrieval (EMNLP 2020)
- Anthropic — Contextual Retrieval
- Frameworks: LangChain, LlamaIndex, Unstructured
