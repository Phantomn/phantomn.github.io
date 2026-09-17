# Blog IA/UX Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix root-cause data/markup/IA defects in blog.ph4nt0m.xyz's Blog/CVE/Writeup
archives (broken tags, non-clickable rows, CSR-only content, no cross-section
search) so tags actually navigate, data is consistent, and Blog+CVE+Writeup are
searchable as one archive.

**Architecture:** Static export Next.js app (no server runtime). All "backend"
logic is either (a) build-time Node scripts that read `content/ko/*.md`
frontmatter and `src/data/cves.ts`, or (b) client components that read a
build-time-generated `public/search-index.json`. No new npm dependencies.
Shared cross-section concepts (tag normalization, tag index) live in
`src/lib/taxonomy.ts` / `src/data/taxonomy.ts`, imported by both build scripts
and page components.

**Tech Stack:** Next.js 15 (App Router, `output: "export"`), React 19,
TypeScript 5 (strict), next-intl 4.9, Tailwind CSS 4, shadcn-style components
(`src/components/ui`, radix-ui 1.4), Playwright 1.50 (`tests/*.spec.ts`,
project's only test runner - no vitest/jest in this repo, do not add one),
gray-matter (frontmatter parsing, already a dependency).

**Spec:** `docs/specs/blog-ia-improvement.md` (audited 2026-09-17, spec-audit
0 findings as of last pass - this plan corrects two more facts found while
writing it: CVE already has a `tags` field but it's auto-derived structural
metadata, not a topic folksonomy; the real gap is a missing `topics` field).

## Global Constraints

- No new npm dependencies for tags/search (spec Boundaries "Never do").
- Existing article URLs (`/[locale]/blog/[slug]/`, `/[locale]/cves/[cve-id]/`,
  `/[locale]/writeups/[slug]/`) never change.
- Tag normalization is lowercase + explicit synonym map only - no stemming,
  no fuzzy matching, no heuristics.
- Content migration scripts (`scripts/*.mjs`) must support `--dry-run` before
  `--apply`; never run `--apply` without the user reviewing the dry-run diff
  first (spec Boundaries "Ask first").
- CVE `topics` values and Writeup `category` reclassifications are filled in
  by a human who has read the underlying vulnerability/challenge - never
  auto-derived from keyword matching (spec Boundaries "Ask first").
- All docs this plan produces or modifies stay ASCII-only (project root
  `CLAUDE.md` convention) - `->` not an arrow glyph, `-` not an em dash, etc.
- Before every commit: `pnpm typecheck && pnpm lint` must pass. Before every
  task's final commit: `pnpm build` must pass (this repo's CI runs
  typecheck -> lint -> knip -> build -> e2e -> deploy on every push to main).
- This repo has **no unit test framework** (no vitest/jest) - do not add one.
  "Write the failing test" steps below use Playwright (`tests/smoke.spec.ts`)
  for anything route/UI-visible, and a script's own `--dry-run` report for
  pure data-migration tasks (the dry-run output IS the test).

---

## File Structure

```
src/data/taxonomy.ts              (new)  TAG_SYNONYMS map
src/lib/taxonomy.ts               (new)  normalizeTag(), TaggedItem,
                                          getAllTaggedItems(), buildTagIndex()
src/data/cves.ts                  (modify)  add `topics: string[]` to
                                          LegacyCveEntry + CveEntry,
                                          normalizeCveEntry() passthrough,
                                          fill topics on 28 entries
content/ko/blog/*.md              (modify, script-driven)  normalize tags[]
content/ko/writeups/*.md          (modify, hand-edited)  fix category[7 files]
                                          + difficulty[28 files]
scripts/normalize-tags.mjs        (new)  blog tag case-normalization migration
src/components/writeups/writeup-data-grid.tsx  (modify)  L282-291 real anchor
src/app/[locale]/writeups/[slug]/page.tsx      (modify)  SSR body (root cause
                                          confirmed during Task 6 below)
src/hooks/use-url-state.ts        (new)  useUrlState() shared hook
src/components/blog/blog-search-layout.tsx     (modify)  L53-117 real
                                          pagination hrefs via useUrlState()
src/app/[locale]/tags/page.tsx           (new)  tag index (freq >= 3)
src/app/[locale]/tags/[tag]/page.tsx     (new)  per-tag filtered listing
messages/{ko,en,es,pt-br}.json           (modify)  add "tags"/"search"
                                          namespace keys (Tasks 9, 10, 12)
(blog tag-badge render location - identified during Task 11 below)  (modify)
scripts/build-search-index.mjs    (new)  postbuild step, writes
                                          public/search-index.json
package.json                      (modify)  postbuild script gains
                                          build-search-index.mjs step (Task 12)
src/components/global-search.tsx  (new)  Sheet-based search UI
src/lib/icons.ts                  (modify)  add faMagnifyingGlass
src/components/site-header.tsx    (modify)  render <GlobalSearch />
tests/smoke.spec.ts               (modify, multiple tasks)  regression tests
```

---

### Task 1: Shared tag normalization (`src/lib/taxonomy.ts` + blog migration)

**Files:**
- Create: `src/data/taxonomy.ts`
- Create: `src/lib/taxonomy.ts`
- Create: `scripts/normalize-tags.mjs`
- Modify: `content/ko/blog/*.md` (tags frontmatter only, via script)

**Interfaces:**
- Produces: `normalizeTag(raw: string): string` - every later task that
  touches tags (Task 2, 5, 6 n/a, 8, 9, 10, 11) imports this from
  `@/lib/taxonomy`.
- Produces: `TAG_SYNONYMS: Record<string, string>` from `@/data/taxonomy`
  (starts empty, extensible later without code changes elsewhere).

- [ ] **Step 1: Write the data file (no logic to test here - this is a
  constant)**

Create `src/data/taxonomy.ts`:

```ts
/**
 * Explicit synonym overrides for cross-section tag normalization, beyond
 * plain lowercasing. Keys and values are already lowercase. Add entries here
 * when a real synonym is found (e.g. "xss" / "cross-site-scripting") - do
 * not add case-only pairs, normalizeTag() lowercases everything already.
 */
export const TAG_SYNONYMS: Record<string, string> = {};
```

- [ ] **Step 2: Write the failing check for `normalizeTag()`**

This repo has no unit test runner, so the "test" is the migration script's
own dry-run report. Before writing `normalizeTag()`, write the report
function that will expose whether it works - run it against the *current*
(un-normalized) data and confirm it finds the known 14 case-duplicate groups.

Create `scripts/normalize-tags.mjs`:

```js
#!/usr/bin/env node
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "ko", "blog");
const APPLY = process.argv.includes("--apply");

// Inline copy of the synonym map (mjs script can't import TS directly
// without a build step; keep this literal list in sync with
// src/data/taxonomy.ts by hand - it starts empty so there is nothing to
// keep in sync yet).
const TAG_SYNONYMS = {};

function normalizeTag(raw) {
  const lower = raw.trim().toLowerCase();
  return TAG_SYNONYMS[lower] ?? lower;
}

function loadPosts() {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => /\.mdx?$/.test(f) && !/^_index\./.test(f))
    .map((f) => {
      const full = path.join(BLOG_DIR, f);
      const raw = fs.readFileSync(full, "utf-8");
      const parsed = matter(raw);
      return { file: f, full, raw, parsed };
    });
}

function report(posts) {
  const before = new Map(); // normalized -> Set(original forms)
  for (const { parsed } of posts) {
    const tags = parsed.data.tags ?? [];
    for (const tag of tags) {
      const norm = normalizeTag(tag);
      if (!before.has(norm)) before.set(norm, new Set());
      before.get(norm).add(tag);
    }
  }
  const dupes = [...before.entries()].filter(([, forms]) => forms.size > 1);
  console.log(`distinct normalized tags: ${before.size}`);
  console.log(`case/synonym duplicate groups: ${dupes.length}`);
  for (const [norm, forms] of dupes.sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${norm} <- ${[...forms].join(", ")}`);
  }
  return dupes.length;
}

function apply(posts) {
  for (const { full, raw, parsed } of posts) {
    const tags = parsed.data.tags;
    if (!tags) continue;
    const normalized = [...new Set(tags.map(normalizeTag))];
    const changed = JSON.stringify(tags) !== JSON.stringify(normalized);
    if (!changed) continue;
    const updated = matter.stringify(parsed.content, {
      ...parsed.data,
      tags: normalized,
    });
    fs.writeFileSync(full, updated);
    console.log(`updated: ${path.basename(full)}`);
  }
}

const posts = loadPosts();
const dupeCount = report(posts);

if (APPLY) {
  apply(posts);
  console.log("\n--- re-checking after --apply ---");
  report(loadPosts());
} else if (dupeCount > 0) {
  console.log("\nRun again with --apply to write these changes.");
}
```

- [ ] **Step 3: Run it to confirm it finds the known problem ("red" state)**

Run: `node scripts/normalize-tags.mjs`
Expected output includes:
```
case/synonym duplicate groups: 14
  afl <- AFL, afl
  ai-agents <- AI-agents, AI-Agents
  ...
```
(14 groups total, matching the spec's Data Model table exactly - if the
count differs, something about the content changed since the spec was
written; stop and re-check before proceeding.)

- [ ] **Step 4: Apply and confirm zero duplicates ("green" state)**

Run: `node scripts/normalize-tags.mjs --apply`
Expected: file-by-file "updated: ..." lines, then the re-check section prints
`case/synonym duplicate groups: 0`.

- [ ] **Step 5: Promote the normalization logic to the shared TS module**

Create `src/lib/taxonomy.ts`:

```ts
import { TAG_SYNONYMS } from "@/data/taxonomy";

export function normalizeTag(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return TAG_SYNONYMS[lower] ?? lower;
}

export interface TaggedItem {
  type: "blog" | "cve" | "writeup";
  slug: string;
  title: string;
  href: string;
  tags: string[];
  date: string;
}

/**
 * Groups items by normalized tag. Each item can appear under multiple tags;
 * within one tag's bucket, an item appears at most once even if its raw
 * tags array had case-duplicates (defensive - Task 1 already normalizes
 * blog's source data, but CVE/Writeup data isn't guaranteed clean forever).
 */
export function buildTagIndex(items: TaggedItem[]): Map<string, TaggedItem[]> {
  const index = new Map<string, TaggedItem[]>();
  for (const item of items) {
    const seen = new Set(item.tags.map(normalizeTag));
    for (const tag of seen) {
      const bucket = index.get(tag) ?? [];
      bucket.push(item);
      index.set(tag, bucket);
    }
  }
  return index;
}
```

- [ ] **Step 6: Verify the whole repo still builds**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass (this task only adds new files and rewrites blog
frontmatter `tags` arrays - no consumer of blog tags changes shape, since
`ContentMeta.tags` is still `string[]`).

- [ ] **Step 7: Commit**

```bash
git add src/data/taxonomy.ts src/lib/taxonomy.ts scripts/normalize-tags.mjs content/ko/blog/*.md
git commit -m "feat(taxonomy): normalize blog tag case-duplicates, add shared normalizeTag()"
```

---

### Task 2: CVE `topics` field (TaskList #5)

**Files:**
- Modify: `src/data/cves.ts` (add `topics` to `LegacyCveEntry` L27-44,
  `CveEntry` L46-71, passthrough in `normalizeCveEntry()` L672-723, fill on
  all `CVE_SOURCE_ITEMS` entries)

**Interfaces:**
- Consumes: `normalizeTag` from Task 1 (used only to sanity-check the values
  you type in, not to auto-generate them).
- Produces: `CveEntry.topics: string[]` - Task 9 (`/tags/[tag]/`) and Task 12
  (search index) both read this field.

- [ ] **Step 1: Add the field to both interfaces (this will fail to compile
  until every entry has it - that failure IS the test)**

In `src/data/cves.ts`, add one line to each interface:

```ts
interface LegacyCveEntry {
  id: string;
  title: string;
  year: number;
  groupKey: string;
  groupLabel: string;
  severity: CveSeverity;
  status: CveStatus;
  href: string;
  nvdHref: string;
  summary: string;
  cvssBaseScore: number;
  cvssVector: string;
  cwe: string;
  published: string;
  lastModified: string;
  nvdStatus: string;
  topics: string[]; // <-- new, required
}
```

```ts
export interface CveEntry {
  id: string;
  slug: string;
  kind: CveKind;
  title: string;
  year: number;
  groupKey: string;
  groupLabel: string;
  severity: CveSeverity;
  status: CveStatus;
  visibility: CveVisibility;
  summary: string;
  score: number;
  vector: string;
  cwePrimary?: string;
  cweAdditional: string[];
  published: string;
  lastModified: string;
  sourceLinks: CveSourceLinks;
  evaluation?: CveEvaluation;
  redaction?: CveRedaction;
  submittedAt?: string;
  issuedAt?: string;
  tags: string[];
  topics: string[]; // <-- new: real topic folksonomy, distinct from `tags`
                     // above (which stays [kind, groupKey, "redacted"?] -
                     // do not merge these two fields)
  nvdStatus: string;
}
```

- [ ] **Step 2: Run typecheck to confirm it fails ("red")**

Run: `pnpm typecheck`
Expected: ~28 errors, one per object literal in `CVE_SOURCE_ITEMS`, each
saying `Property 'topics' is missing in type '{ id: ... }'`.

- [ ] **Step 3: Wire the passthrough in `normalizeCveEntry()`**

Find the return object in `normalizeCveEntry()` (around L672-723) and add
`topics: entry.topics,` next to the existing `tags: [...]` line (do not
touch the existing `tags:` derivation - leave it exactly as-is):

```ts
    tags: [
      kind,
      entry.groupKey,
      ...(entry.id.startsWith("FVE-") ? ["redacted"] : []),
    ],
    topics: entry.topics,
    nvdStatus: entry.nvdStatus,
  };
}
```

- [ ] **Step 4: Fill `topics` on every `CVE_SOURCE_ITEMS` entry**

This is a human-judgment step, not automatable (Global Constraints). Open
`src/data/cves.ts` and add a `topics: [...]` array to each of the 28 entries,
derived only from that entry's own existing `groupKey`/`cwe`/`summary` text -
never introduce a claim not already present in the entry. Two worked examples
from entries already visible in this plan's research:

For the llama.cpp recursion DoS entry (`groupKey: "llm"`,
`summary: "...uncontrolled recursion in common/json-schema-to-grammar.cpp..."`,
`cwe: "CWE-674"`):
```ts
topics: ["llm", "llama.cpp", "denial-of-service", "uncontrolled-recursion"],
```

For the FVE masked disclosure entry (`groupKey: "web"`,
`summary: "Public details are intentionally redacted...", cwe: "CWE-306 / CWE-200 / CWE-284"`):
```ts
topics: ["web", "authentication", "sensitive-data-exposure", "access-control"],
```

Repeat for the remaining 26 entries using the same rule: read that entry's
own `groupKey`, `cwe`, and `summary` fields, derive 2-5 lowercase kebab-case
topic words a reader would actually search for, run each candidate word
through `normalizeTag()` mentally (lowercase, no spaces) before typing it.

- [ ] **Step 5: Run typecheck to confirm it passes ("green")**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: 0 errors (28/28 entries now have `topics`).

- [ ] **Step 6: Commit**

```bash
git add src/data/cves.ts
git commit -m "feat(cves): add topics field distinct from existing structural tags field"
```

---

### Task 3: Writeup category-tag reclassification (TaskList #3)

**Files:**
- Modify: `content/ko/writeups/browser-exploitation.md`
- Modify: `content/ko/writeups/codegate-ctf.md`
- Modify: `content/ko/writeups/csaw-2013-exploitation-2.md`
- Modify: `content/ko/writeups/hitcon-training-lab10.md`
- Modify: `content/ko/writeups/konjuuni-gifted-pwnable2.md`
- Modify: `content/ko/writeups/one-gadget-example.md`
- Modify: `content/ko/writeups/suninatas-challenges.md`

**Interfaces:** none - pure content data fix, no code changes.

- [ ] **Step 1: Write the failing check (grep-based, this repo's substitute
  for a unit test on data files)**

Run: `grep -l '^category: "redteam"' content/ko/writeups/*.md | xargs grep -l -E '"(pwn|rop|heap|bof|buffer-overflow|exploitation|shellcode|format-string|one-gadget)"'`
Expected output (the 7 files above, confirming the "red" state matches the
spec's finding):
```
content/ko/writeups/browser-exploitation.md
content/ko/writeups/codegate-ctf.md
content/ko/writeups/csaw-2013-exploitation-2.md
content/ko/writeups/hitcon-training-lab10.md
content/ko/writeups/konjuuni-gifted-pwnable2.md
content/ko/writeups/one-gadget-example.md
content/ko/writeups/suninatas-challenges.md
```

- [ ] **Step 2: Read each file's body and reclassify**

Open each file, read the actual writeup content (not just frontmatter), and
change the `category:` line to whichever of the 5 existing category keys
(`pwn`, `redteam`, `reversing`, `web`, `misc` - see
`src/lib/content.ts` `CATEGORY_NAMES` L184-189, do not invent a 6th key)
actually matches. Based on the tag lists alone (final call needs the body
read, but tags strongly suggest):
- `csaw-2013-exploitation-2.md` (tags: pwn, bof, stack) -> likely `category: "pwn"`
- `hitcon-training-lab10.md` (tags: pwn, heap, uaf, use-after-free) -> likely `category: "pwn"`
- `konjuuni-gifted-pwnable2.md` (tags: pwn, patching, sleep) -> likely `category: "pwn"`
- `one-gadget-example.md` (tags: pwn, rop, one-gadget, aslr, libc) -> likely `category: "pwn"`
- `codegate-ctf.md` (tags: pwn, rev, ctf, codegate - mixed pwn+rev, read body
  to pick the dominant discipline)
- `browser-exploitation.md` (tags: browser, exploitation, analysis - no
  explicit "pwn" tag; read body, this may legitimately stay `redteam` or
  become `pwn` depending on what's actually exploited)
- `suninatas-challenges.md` (tags: forensics, pwn, wargame - mixed; read
  body, may need to stay `redteam` if the writeup as a whole is a forensics
  challenge set with one pwn sub-section)

Do not apply these "likely" values blindly - they're a starting hypothesis
from tags alone, per Global Constraints the actual category must come from
reading the writeup body.

- [ ] **Step 3: Re-run the check to confirm it's empty ("green")**

Run: `grep -l '^category: "redteam"' content/ko/writeups/*.md | xargs grep -l -E '"(pwn|rop|heap|bof|buffer-overflow|exploitation|shellcode|format-string|one-gadget)"'`
Expected: no output (0 files) for every entry you reclassified to `pwn`. If
you deliberately kept one at `redteam` (e.g. `browser-exploitation.md`),
document why in the commit message.

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: passes (category is a free-form string read via `CATEGORY_NAMES`
lookup with a raw fallback, so any of the 5 existing keys is always valid).

- [ ] **Step 5: Commit**

```bash
git add content/ko/writeups/{browser-exploitation,codegate-ctf,csaw-2013-exploitation-2,hitcon-training-lab10,konjuuni-gifted-pwnable2,one-gadget-example,suninatas-challenges}.md
git commit -m "fix(writeups): reclassify category to match actual challenge discipline"
```

---

### Task 4: Writeup difficulty normalization (TaskList #4)

**Files:**
- Modify: `content/ko/writeups/*.md` (difficulty field, up to 28 files)

**Interfaces:** none.

- [ ] **Step 1: Write the failing check**

Run: `grep -h "^difficulty:" content/ko/writeups/*.md | sort | uniq -c`
Expected ("red" state, matching spec exactly):
```
     10 difficulty: "Easy"
      5 difficulty: "medium"
      5 difficulty: "easy-medium"
      4 difficulty: "easy"
      3 difficulty: "Medium"
      1 difficulty: "Hard"
```

- [ ] **Step 2: Normalize casing mechanically first (safe, no judgment
  needed)**

Run:
```bash
cd content/ko/writeups
sed -i 's/^difficulty: "easy"$/difficulty: "Easy"/' *.md
sed -i 's/^difficulty: "medium"$/difficulty: "Medium"/' *.md
cd -
```
This collapses `Easy`(10)+`easy`(4) -> `Easy`(14), `medium`(5)+`Medium`(3) ->
`Medium`(8). `easy-medium`(5) and `Hard`(1) are untouched (they need human
judgment, not case-folding).

- [ ] **Step 3: Re-run the check - confirm case-folding worked**

Run: `grep -h "^difficulty:" content/ko/writeups/*.md | sort | uniq -c`
Expected:
```
     14 difficulty: "Easy"
      8 difficulty: "Medium"
      5 difficulty: "easy-medium"
      1 difficulty: "Hard"
```

- [ ] **Step 4: Resolve the 5 "easy-medium" entries by hand**

Run: `grep -l '^difficulty: "easy-medium"' content/ko/writeups/*.md` to list
the 5 files. Open each, read the writeup, and change `difficulty:` to either
`"Easy"` or `"Medium"` (introduce `"Hard"`/`"Insane"` only if the content
genuinely warrants it - don't force a 2-way split if a file is truly
harder than both).

- [ ] **Step 5: Final check - confirm only the target value set remains**

Run: `grep -h "^difficulty:" content/ko/writeups/*.md | sort -u`
Expected: only `"Easy"`, `"Medium"`, `"Hard"` (plus `"Insane"` only if you
used it in Step 4) - zero lowercase or hyphenated forms.

- [ ] **Step 6: Verify build**

Run: `pnpm build`

- [ ] **Step 7: Commit**

```bash
git add content/ko/writeups/*.md
git commit -m "fix(writeups): normalize difficulty labels to Easy/Medium/Hard"
```

---

### Task 5: Writeup list rows as real anchors (TaskList #6, RC-1)

**Files:**
- Modify: `src/components/writeups/writeup-data-grid.tsx:282-291`
- Modify: `tests/smoke.spec.ts`

**Interfaces:** none new - pure bug fix, no shape changes to `WriteupEntry`.

- [ ] **Step 1: Write the failing Playwright test**

Append to `tests/smoke.spec.ts`:

```ts
test("writeup list rows are real anchors", async ({ page }) => {
  const response = await page.goto("/en/writeups/");
  expect(response?.status()).toBeLessThan(400);
  const anchorCount = await page
    .locator('a[href*="/writeups/"]:not([href="/en/writeups/"])')
    .count();
  expect(anchorCount).toBeGreaterThanOrEqual(28);
});
```

- [ ] **Step 2: Run it to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "writeup list rows are real anchors"`
Expected: FAIL, `anchorCount` is 0 (current `<tr onClick>` has no anchors at
all inside the table body).

- [ ] **Step 3: Fix the component**

In `src/components/writeups/writeup-data-grid.tsx`, replace lines 282-291:

```tsx
                rows.map((w, i) => (
                  <tr
                    key={w.href}
                    onClick={() => router.push(w.href)}
                    className={cn(
                      "group cursor-pointer border-b border-border/30 transition-all hover:bg-primary/5 dark:hover:bg-primary/[0.03]",
                      i % 2 === 0
                        ? "bg-card"
                        : "bg-muted/20 dark:bg-muted/10"
                    )}
                  >
```

with (keep everything below line 291 - the `<td>` cells - unchanged; only
the `<tr>` opening tag and the first cell's content change):

```tsx
                rows.map((w, i) => (
                  <tr
                    key={w.href}
                    className={cn(
                      "group relative border-b border-border/30 transition-all hover:bg-primary/5 dark:hover:bg-primary/[0.03]",
                      i % 2 === 0
                        ? "bg-card"
                        : "bg-muted/20 dark:bg-muted/10"
                    )}
                  >
```

Then find the `<td>` that renders the writeup name/title (the first data
cell after this `<tr>`) and wrap its text in a stretched link so the whole
row stays clickable while a real `<a>` exists:

```tsx
                    <td className="relative px-4 py-3 font-medium text-foreground">
                      <Link href={w.href} className="absolute inset-0" aria-label={w.name} />
                      <span className="pointer-events-none">{w.name}</span>
                    </td>
```

(The exact current JSX of that `<td>` should be read first - this shows the
pattern to apply: `position:relative` on the `<tr>` and that one `<td>`,
absolutely-positioned full-cell `<a>` via `next/link`'s `Link`, the visible
text made `pointer-events-none` so the link captures the click. If the
`router`/`useRouter` import becomes unused after removing `onClick`, remove
that import too - `pnpm lint` will flag it if left dangling.)

Add the import if not already present:
```tsx
import Link from "next/link";
```

- [ ] **Step 4: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "writeup list rows are real anchors"`
Expected: PASS, `anchorCount >= 28`.

- [ ] **Step 5: Manual smoke check**

Run: `pnpm build && grep -o '<a[^>]*href="/ko/writeups/[a-z0-9-]*/"' out/ko/writeups/index.html | wc -l`
Expected: >= 28.

- [ ] **Step 6: Commit**

```bash
git add src/components/writeups/writeup-data-grid.tsx tests/smoke.spec.ts
git commit -m "fix(writeups): make list rows real anchors instead of onClick-only tr"
```

---

### Task 6: Writeup body SSR (TaskList #7, RC investigation required)

**Files:**
- Read first, then modify: `src/app/[locale]/writeups/[slug]/page.tsx`
- Modify: `tests/smoke.spec.ts`

**Interfaces:** none known yet - this task starts with investigation because
the spec explicitly flagged that the root cause was never read directly.

- [ ] **Step 1: Investigate before writing any test**

Run: `cat "src/app/[locale]/writeups/[slug]/page.tsx"` and compare it against
`src/app/[locale]/blog/[slug]/page.tsx` (confirmed SSR) side by side. Look
specifically for: a `dynamic(() => import(...), { ssr: false })` call, a
`Suspense` boundary wrapping the MDX body, or a `"use client"` directive at
the top of a component that renders the body. Write 1-2 sentences here (to
go in the commit message) naming the actual mechanism found.

- [ ] **Step 2: Write the failing Playwright test**

Append to `tests/smoke.spec.ts` (uses `request`, Playwright's raw-HTTP
fixture that does NOT execute JS - this is deliberate, see Global
Constraints/spec Testing Strategy: a browser-driven test would pass even
with the current bug, because the browser DOES run the JS that fills in the
Suspense placeholder):

```ts
test("writeup detail body is server-rendered (no JS)", async ({ request }) => {
  const response = await request.get("/en/writeups/alert-to-win-xss/");
  expect(response.status()).toBeLessThan(400);
  const html = await response.text();
  // The real body should contain prose, not just the Suspense placeholder.
  expect(html.length).toBeGreaterThan(3000);
  expect(html).not.toMatch(/self\.__next_f\.push.*"children".*null/);
});
```

(Pick any real writeup slug that exists under `content/ko/writeups/` - verify
with `ls content/ko/writeups/ | grep alert-to-win-xss` first; if that exact
slug doesn't exist, substitute a real one from that directory listing.)

- [ ] **Step 3: Run it to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "writeup detail body is server-rendered"`
Expected: FAIL (body length assertion fails, or the Suspense-marker pattern
matches).

- [ ] **Step 4: Fix based on what Step 1 found**

Apply the specific fix for whatever mechanism Step 1 identified - the two
most likely fixes, pick whichever matches:

If the cause is a client-only dynamic import of the MDX renderer:
```tsx
// before (hypothetical, confirm against actual file):
const MdxBody = dynamic(() => import("@/components/writeups/mdx-body"), { ssr: false });
// after:
const MdxBody = dynamic(() => import("@/components/writeups/mdx-body"));
```

If the cause is that the page component itself is `"use client"` and fetches
the compiled MDX in a `useEffect`: convert the page to a Server Component
(remove `"use client"`) and import the compiled MDX module directly at the
top, matching exactly how `src/app/[locale]/blog/[slug]/page.tsx` does it -
read that file's import block and mirror it.

- [ ] **Step 5: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "writeup detail body is server-rendered"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/writeups/[slug]/page.tsx" tests/smoke.spec.ts
git commit -m "fix(writeups): render body server-side instead of client-only Suspense

<1-2 sentence root cause from Step 1 goes here>"
```

---

### Task 7: Shared URL-state hook (TaskList #15)

**Files:**
- Create: `src/hooks/use-url-state.ts`

**Interfaces:**
- Produces: `useUrlState(key: string, defaultValue: string): [string, (value: string) => void]`
  - Task 8 (pagination) and Task 13 (search/tag filter) both import this by
  this exact name and signature. Do not rename it later.

`src/hooks/` currently exists but is empty (verified 2026-09-17) - there is
no existing convention to follow here; keep this minimal.

- [ ] **Step 1: Write the failing Playwright test**

Since this hook has no UI of its own yet, its test is deferred to Task 8's
first consumer (a hook with no caller can't be exercised in the browser).
Skip straight to implementation, then verify via `pnpm typecheck`.

- [ ] **Step 2: Implement**

Create `src/hooks/use-url-state.ts`:

```ts
"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads/writes one query-string key as component state, backed by the URL
 * (shareable, survives refresh). Shared by blog pagination (?page=),
 * global search (?q=), and tag-index filtering (?q=).
 */
export function useUrlState(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultValue || next === "") {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [key, defaultValue, pathname, router, searchParams],
  );

  return [value, setValue];
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`
Expected: passes (no consumers yet, so this only checks the file itself is
valid TypeScript).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-url-state.ts
git commit -m "feat(hooks): add useUrlState for URL-backed query state"
```

---

### Task 8: Pagination via URL (TaskList #11, RC-2)

**Files:**
- Modify: `src/components/blog/blog-search-layout.tsx:53-117`
- Modify: `tests/smoke.spec.ts`

**Interfaces:**
- Consumes: `useUrlState` from Task 7.

- [ ] **Step 1: Write the failing Playwright test**

Append to `tests/smoke.spec.ts`:

```ts
test("blog pagination reflects in the URL and survives reload", async ({ page }) => {
  await page.goto("/en/blog/");
  const firstPageTitle = await page.locator("article, [data-post-card]").first().textContent();
  await page.goto("/en/blog/?page=2");
  const response = await page.reload();
  expect(response?.status()).toBeLessThan(400);
  const secondPageTitle = await page.locator("article, [data-post-card]").first().textContent();
  expect(secondPageTitle).not.toBe(firstPageTitle);
});
```

(If `blog-search-layout.tsx`'s post-card markup doesn't use `<article>` or a
`data-post-card` attribute, read that file's card-rendering JSX first and
adjust the locator to whatever wrapper element it actually renders - the
assertion's intent, not the exact selector, is what matters: page 1 and
page 2 must show different content.)

- [ ] **Step 2: Run it to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "blog pagination reflects in the URL"`
Expected: FAIL - `?page=2` currently has no effect (state is a plain
`useState`), so both titles are identical.

- [ ] **Step 3: Fix `PaginationControls` and its caller**

In `src/components/blog/blog-search-layout.tsx`, the component that owns
`currentPage` state needs to switch from `useState` to `useUrlState`. Find
where `currentPage`/`setCurrentPage` (or equivalent) is declared above
`PaginationControls`'s usage, and change it from:

```tsx
const [currentPage, setCurrentPage] = useState(1);
```

to:

```tsx
const [pageParam, setPageParam] = useUrlState("page", "1");
const currentPage = Number(pageParam) || 1;
const setCurrentPage = (page: number) => setPageParam(String(page));
```

Add the import:
```tsx
import { useUrlState } from "@/hooks/use-url-state";
```

Then in `PaginationControls` (L53-117), replace every `href="#"` +
`e.preventDefault()` pair with a real href and no preventDefault. For
`PaginationPrevious` (L70-78):

```tsx
          <PaginationPrevious
            href={currentPage > 1 ? `?page=${currentPage - 1}` : "#"}
            onClick={(e) => {
              if (currentPage <= 1) e.preventDefault();
              else onPageChange(currentPage - 1);
            }}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            aria-disabled={currentPage <= 1}
          />
```

For `PaginationLink` (L87-98):

```tsx
              <PaginationLink
                href={`?page=${page}`}
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page);
                }}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
```

(`onClick` still calls `preventDefault` + `onPageChange` here rather than a
full page navigation, so switching pages stays a client-side transition
instead of a full reload - but the `href` is now real, so right-click/open-
in-new-tab and view-source both show the correct target, and `onPageChange`
itself now writes through `useUrlState`, which is what makes reload/share
work.)

For `PaginationNext` (L104-112), mirror `PaginationPrevious`'s pattern with
`currentPage + 1` / `currentPage >= totalPages`.

- [ ] **Step 4: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "blog pagination reflects in the URL"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/blog-search-layout.tsx tests/smoke.spec.ts
git commit -m "fix(blog): back pagination with URL query state instead of href=#"
```

---

### Task 9: `/tags/[tag]/` page (TaskList #9)

**Files:**
- Create: `src/app/[locale]/tags/[tag]/page.tsx`
- Modify: `tests/smoke.spec.ts`

**Interfaces:**
- Consumes: `normalizeTag`, `TaggedItem`, `buildTagIndex` from Task 1;
  `CveEntry.topics` from Task 2; `getContentList("blog", locale)` and
  `getAllWriteups(locale)` from `@/lib/content` (existing); `CVE_ITEMS` from
  `@/data/cves` (existing).
- Produces: `getAllTaggedItems(locale: string): TaggedItem[]` (added to
  `src/lib/taxonomy.ts` in this task, since it needs `content.ts`/`cves.ts`
  imports that Task 1 deliberately didn't take on to avoid a premature
  circular-import risk before those fields existed) - Task 10, 12 both
  import this by this exact name.

- [ ] **Step 1: Write the failing Playwright test**

Append to `tests/smoke.spec.ts` (using `pwn`, a tag confirmed present on
both Writeup content and, after Task 2, at least one CVE's `topics`):

```ts
test("tag page shows items from multiple sections", async ({ page }) => {
  const response = await page.goto("/en/tags/pwn/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByText(/writeup/i).first()).toBeVisible();
});

test("unknown tag returns 404", async ({ page }) => {
  const response = await page.goto("/en/tags/this-tag-does-not-exist-xyz/");
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 2: Run to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "tag page"`
Expected: FAIL - route doesn't exist yet (404 for everything, including the
"should be 200" case).

- [ ] **Step 3: Add `getAllTaggedItems()` to `src/lib/taxonomy.ts`**

Append to `src/lib/taxonomy.ts` (after `buildTagIndex`):

```ts
import { getContentList, getAllWriteups } from "@/lib/content";
import { CVE_ITEMS } from "@/data/cves";
import { routing } from "@/i18n/routing";

export function getAllTaggedItems(locale: string = routing.defaultLocale): TaggedItem[] {
  const blogItems: TaggedItem[] = getContentList("blog", locale).map((item) => ({
    type: "blog",
    slug: item.slug,
    title: item.meta.title,
    href: item.href,
    tags: item.meta.tags ?? [],
    date: item.meta.date ?? "",
  }));

  const writeupItems: TaggedItem[] = getAllWriteups(locale).map((item) => ({
    type: "writeup",
    slug: item.slug,
    title: item.name,
    href: item.href,
    tags: item.tags,
    date: item.date,
  }));

  const cveItems: TaggedItem[] = CVE_ITEMS.map((item) => ({
    type: "cve",
    slug: item.slug,
    title: item.title,
    href: `/${locale}/cves/${item.slug}/`,
    tags: item.topics,
    date: item.published,
  }));

  return [...blogItems, ...writeupItems, ...cveItems];
}
```

- [ ] **Step 4: Create the page**

Create `src/app/[locale]/tags/[tag]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { routing, type Locale } from "@/i18n/routing";
import { getAllTaggedItems, normalizeTag, buildTagIndex } from "@/lib/taxonomy";

interface Props {
  params: Promise<{ locale: string; tag: string }>;
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => {
    const index = buildTagIndex(getAllTaggedItems(locale));
    return [...index.keys()].map((tag) => ({ locale, tag }));
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${normalizeTag(tag)}` };
}

const TYPE_LABEL: Record<string, string> = {
  blog: "Research",
  cve: "CVE",
  writeup: "Writeup",
};

export default async function TagPage({ params }: Props) {
  const { locale, tag } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tags" });

  const normalized = normalizeTag(tag);
  const index = buildTagIndex(getAllTaggedItems(locale));
  const items = index.get(normalized);
  if (!items || items.length === 0) notFound();

  const sorted = [...items].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted-foreground">{t("heading")}</p>
      <h1 className="mb-8 text-3xl font-bold font-heading">#{normalized}</h1>
      <ul className="flex flex-col gap-4">
        {sorted.map((item) => (
          <li key={`${item.type}-${item.slug}`} className="border-b border-border pb-4">
            <Link href={item.href} className="group flex items-center gap-3">
              <Badge variant="outline" className="shrink-0 text-xs">
                {TYPE_LABEL[item.type]}
              </Badge>
              <span className="font-medium group-hover:text-primary">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(`getTranslations({ namespace: "tags" })` assumes a `tags.heading` message
key - add it to each locale's messages file under `messages/` alongside the
existing namespaces; open one existing messages file first to match its
exact JSON structure before adding the new `"tags"` key.)

- [ ] **Step 5: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "tag page"`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/taxonomy.ts "src/app/[locale]/tags/[tag]/page.tsx" tests/smoke.spec.ts messages/
git commit -m "feat(tags): add cross-section /tags/[tag]/ page"
```

---

### Task 10: `/tags/` index page (TaskList #10)

**Files:**
- Create: `src/app/[locale]/tags/page.tsx`
- Modify: `tests/smoke.spec.ts`

**Interfaces:**
- Consumes: `getAllTaggedItems`, `buildTagIndex` from Task 9.

- [ ] **Step 1: Write the failing Playwright test**

Append to `tests/smoke.spec.ts`:

```ts
test("tag index only lists tags used 3+ times", async ({ page }) => {
  const response = await page.goto("/en/tags/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole("link", { name: /^pwn$/i })).toBeVisible();
});
```

- [ ] **Step 2: Run to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "tag index only lists"`
Expected: FAIL - route doesn't exist.

- [ ] **Step 3: Create the page**

Create `src/app/[locale]/tags/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getAllTaggedItems, buildTagIndex } from "@/lib/taxonomy";

const MIN_FREQUENCY = 3;

interface Props {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = { title: "Tags" };

export default async function TagsIndexPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tags" });

  const index = buildTagIndex(getAllTaggedItems(locale));
  const frequent = [...index.entries()]
    .filter(([, items]) => items.length >= MIN_FREQUENCY)
    .map(([tag, items]) => ({ tag, count: items.length }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold font-heading">{t("indexHeading")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t("indexHint")}</p>
      <ul className="flex flex-wrap gap-2">
        {frequent.map(({ tag, count }) => (
          <li key={tag}>
            <Link
              href={`/${locale}/tags/${tag}/`}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
            >
              #{tag}
              <span className="text-xs text-muted-foreground">{count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(Add `tags.indexHeading` / `tags.indexHint` message keys the same way as
`tags.heading` was added in Task 9.)

- [ ] **Step 4: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "tag index only lists"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/tags/page.tsx" tests/smoke.spec.ts messages/
git commit -m "feat(tags): add /tags/ index page (frequency >= 3 only)"
```

---

### Task 11: Blog tag badges as real links (TaskList #8, RC-5)

**Files:**
- Identify during Step 1, then modify (blog tag-badge render location)
- Modify: `tests/smoke.spec.ts`

**Interfaces:**
- Consumes: `normalizeTag` from Task 1; `/tags/[tag]/` route from Task 9.

- [ ] **Step 1: Find the exact render location**

Run: `grep -rn "meta.tags\|\.tags\.map" "src/app/[locale]/blog/[slug]/page.tsx" src/components/blog`
This locates both the top-of-article tag badges and the bottom "related
posts" tag links the spec's RC-5 describes. Read both call sites before
editing.

- [ ] **Step 2: Write the failing Playwright test**

Append to `tests/smoke.spec.ts` (pick a real blog slug with tags - verify
with `grep -l '"fuzzing"' content/ko/blog/*.md` or similar first):

```ts
test("blog post tag badges link to /tags/", async ({ page }) => {
  await page.goto("/en/blog/grammar-based-fuzzing/");
  const tagLink = page.locator('a[href*="/tags/"]').first();
  await expect(tagLink).toBeVisible();
  const href = await tagLink.getAttribute("href");
  expect(href).not.toBe("/en/blog/");
});
```

- [ ] **Step 3: Run to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "blog post tag badges link"`
Expected: FAIL - current top badges are `<span>` (no `href` at all), and/or
bottom links all point to `/en/blog/` regardless of tag.

- [ ] **Step 4: Fix both locations**

At whichever call site renders the top tag badges as `<span>`, wrap each
in a `Link`:

```tsx
{tags.map((tag) => (
  <Link key={tag} href={`/${locale}/tags/${normalizeTag(tag)}/`}>
    <Badge variant="secondary" className="text-xs">
      {tag}
    </Badge>
  </Link>
))}
```

At whichever call site renders the bottom "related posts" tag links
currently pointing at a single hardcoded `/${locale}/blog/`, change the
`href` to be tag-specific:

```tsx
<Link href={`/${locale}/tags/${normalizeTag(tag)}/`}>{tag}</Link>
```

Add the import in both files if missing:
```tsx
import { normalizeTag } from "@/lib/taxonomy";
```

- [ ] **Step 5: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "blog post tag badges link"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/smoke.spec.ts   # plus whichever component files Step 1 found
git commit -m "fix(blog): tag badges and related-post links point to real /tags/[tag]/"
```

---

### Task 12: Global search (TaskList #12, D-2)

**Files:**
- Create: `scripts/build-search-index.mjs`
- Modify: `package.json` (postbuild step)
- Create: `src/components/global-search.tsx`
- Modify: `src/lib/icons.ts`
- Modify: `src/components/site-header.tsx`
- Modify: `tests/smoke.spec.ts`

**Interfaces:**
- Produces: `public/search-index.json` (build artifact, shape:
  `{ type: "blog" | "cve" | "writeup"; title: string; description: string;
  tags: string[]; date: string; href: string }[]`) - consumed by
  `global-search.tsx` and, in Task 13, unchanged.
- Produces: `<GlobalSearch />` component, rendered in `site-header.tsx`.

- [ ] **Step 1: Write the index-generation script**

Create `scripts/build-search-index.mjs`:

```js
#!/usr/bin/env node
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content", "ko");
const OUT_PATH = path.join(process.cwd(), "public", "search-index.json");
const LOCALE = "ko";

function listSection(section) {
  const dir = path.join(CONTENT_DIR, section);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f) && !/^_index\./.test(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const { data } = matter(raw);
      const slug = f.replace(/\.mdx?$/, "");
      return {
        type: section === "blog" ? "blog" : "writeup",
        title: data.title ?? slug,
        description: data.description ?? "",
        tags: data.tags ?? [],
        date: data.date ? String(data.date) : "",
        href: `/${LOCALE}/${section}/${slug}/`,
      };
    })
    .filter((entry) => !entry.locked);
}

// CVE entries come from compiled TS via a small inline re-derivation
// (this script is plain Node/mjs and can't import src/data/cves.ts's
// TypeScript directly without a build step, so it reads the same
// content/ko/cves/*.md frontmatter mirror instead - which already carries
// title/summary per Task 2's neighbor data).
function listCves() {
  const dir = path.join(CONTENT_DIR, "cves");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f) && !/^_index\./.test(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const { data } = matter(raw);
      const slug = f.replace(/\.mdx?$/, "");
      return {
        type: "cve",
        title: data.title ?? slug,
        description: data.summary ?? "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        date: data.date ? String(data.date) : "",
        href: `/${LOCALE}/cves/${slug}/`,
      };
    });
}

const index = [...listSection("blog"), ...listSection("writeups"), ...listCves()];
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(index));
console.log(`wrote ${index.length} entries to ${path.relative(process.cwd(), OUT_PATH)}`);
```

- [ ] **Step 2: Run it and confirm the count matches expectations ("red"
  until wired into the build, but this checks the script itself works)**

Run: `node scripts/build-search-index.mjs`
Expected: `wrote 114 entries to public/search-index.json` (58 blog + 28
writeup + 28 cve - recompute if content counts have changed since this plan
was written, via `find content/ko/{blog,writeups,cves} -iname "*.md" | grep -v _index | wc -l`).

- [ ] **Step 3: Wire it into the build**

In `package.json`, change the `postbuild` script from:
```json
"postbuild": "node --env-file-if-exists=.env scripts/lock-posts.mjs",
```
to:
```json
"postbuild": "node --env-file-if-exists=.env scripts/lock-posts.mjs && node scripts/build-search-index.mjs",
```

- [ ] **Step 4: Add the search icon**

In `src/lib/icons.ts`, add `faMagnifyingGlass` to the import and export:
```ts
import {
  faBars,
  faDownload,
  faMagnifyingGlass,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
```
```ts
export const icons = {
  bars: faBars,
  download: faDownload,
  magnifyingGlass: faMagnifyingGlass,
  moon: faMoon,
  sun: faSun,
  github: faGithub,
  linkedin: faLinkedin,
  xTwitter: faXTwitter,
} as const;
```

- [ ] **Step 5: Write the failing Playwright test**

Append to `tests/smoke.spec.ts`:

```ts
test("global search finds results across sections", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("button", { name: /search/i }).click();
  await page.getByRole("textbox").fill("pwn");
  await expect(page.getByRole("link").filter({ hasText: /pwn/i }).first()).toBeVisible();
});
```

- [ ] **Step 6: Run to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "global search finds results"`
Expected: FAIL - no search button exists yet.

- [ ] **Step 7: Build the component**

Create `src/components/global-search.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { icons } from "@/lib/icons";

interface SearchEntry {
  type: "blog" | "cve" | "writeup";
  title: string;
  description: string;
  tags: string[];
  date: string;
  href: string;
}

const TYPE_LABEL: Record<SearchEntry["type"], string> = {
  blog: "Research",
  cve: "CVE",
  writeup: "Writeup",
};

function score(entry: SearchEntry, query: string): number {
  const q = query.toLowerCase();
  let s = 0;
  if (entry.tags.some((t) => t.toLowerCase() === q)) s += 10;
  if (entry.title.toLowerCase().includes(q)) s += 5;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) s += 3;
  if (entry.description.toLowerCase().includes(q)) s += 1;
  return s;
}

export function GlobalSearch() {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);

  useEffect(() => {
    if (!open || entries.length > 0) return;
    fetch("/search-index.json")
      .then((res) => res.json())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [open, entries.length]);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return entries
      .map((entry) => ({ entry, s: score(entry, query.trim()) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.entry);
  }, [entries, query]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("open")}>
          <FontAwesomeIcon icon={icons.magnifyingGlass} className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96">
        <SheetHeader>
          <SheetTitle className="font-heading">{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 pt-4">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
          />
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {results.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col gap-0.5 rounded-md border border-border p-3 hover:border-primary"
                >
                  <span className="text-xs uppercase text-muted-foreground">
                    {TYPE_LABEL[entry.type]}
                  </span>
                  <span className="font-medium">{entry.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

(Add `search.open` / `search.title` / `search.placeholder` message keys the
same way as the `tags` namespace was added in Task 9.)

- [ ] **Step 8: Render it in the header**

In `src/components/site-header.tsx`, add the import:
```tsx
import { GlobalSearch } from "@/components/global-search";
```
and render it next to `<ThemeToggle />` in both the desktop nav block
(L113-114) and the mobile block (L118-119):
```tsx
          <GlobalSearch />
          <LanguageSwitcher />
          <ThemeToggle />
```
(placed before `<LanguageSwitcher />` in both spots, matching the two
existing `<LanguageSwitcher /><ThemeToggle />` pairs at L113-114 and
L118-119).

- [ ] **Step 9: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "global search finds results"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/build-search-index.mjs package.json src/lib/icons.ts src/components/global-search.tsx src/components/site-header.tsx tests/smoke.spec.ts messages/
git commit -m "feat(search): add cross-section global search (build-time index, no new deps)"
```

---

### Task 13: Search/tag-filter URL state (TaskList #16 - originally #13, deleted+recreated 2026-09-17 to drop a spurious blockedBy #9)

**Files:**
- Modify: `src/components/global-search.tsx`
- Modify: `tests/smoke.spec.ts`

**Interfaces:**
- Consumes: `useUrlState` from Task 7.

- [ ] **Step 1: Write the failing Playwright test**

Append to `tests/smoke.spec.ts`:

```ts
test("search query is reflected in the URL and restored on reload", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("button", { name: /search/i }).click();
  await page.getByRole("textbox").fill("pwn");
  await expect(page).toHaveURL(/[?&]q=pwn/);
  await page.reload();
  await expect(page.getByRole("textbox")).toHaveValue("pwn");
});
```

- [ ] **Step 2: Run to confirm it fails ("red")**

Run: `pnpm build && pnpm test:e2e -- -g "search query is reflected"`
Expected: FAIL - `query` is plain `useState`, URL never changes, reload
loses it.

- [ ] **Step 3: Swap to `useUrlState` in `GlobalSearch`**

In `src/components/global-search.tsx`, replace:
```tsx
const [query, setQuery] = useState("");
```
with:
```tsx
const [query, setQuery] = useUrlState("q", "");
```
and add the import:
```tsx
import { useUrlState } from "@/hooks/use-url-state";
```
Also open the Sheet automatically when a `q` param is present on load, so a
shared `?q=pwn` link actually shows results without the user re-clicking the
trigger:
```tsx
useEffect(() => {
  if (query.trim().length >= 2) setOpen(true);
}, [query]); // eslint-disable-line react-hooks/exhaustive-deps -- open only on mount-with-query, not every query change
```

- [ ] **Step 4: Run the test to confirm it passes ("green")**

Run: `pnpm build && pnpm test:e2e -- -g "search query is reflected"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/global-search.tsx tests/smoke.spec.ts
git commit -m "feat(search): back query state with URL (?q=) for shareable searches"
```

---

### Task 14: FVE label wording (TaskList #14, optional, ask-first)

**Files:**
- Modify (only after explicit user approval): `src/data/cves.ts` (the FVE
  entries' rendered "disclosure scope" label - exact source field to be
  identified at task start via `grep -n "공개 범위\|disclosure" "src/app/[locale]/cves/[slug]/page.tsx"`)

**Interfaces:** none.

- [ ] **Step 1: STOP - ask the user before touching anything**

This task is listed in the spec's Boundaries as "Ask first". Do not proceed
past this step without explicit approval of the exact new wording. Suggested
options to present: keep as-is, or change "공개 범위: 비공개" to "공개 범위:
마스킹 공개" (or a wording the user prefers).

- [ ] **Step 2 (only after approval): locate and change the label**

Run: `grep -n "공개 범위\|disclosure" "src/app/[locale]/cves/[slug]/page.tsx" src/data/cves.ts`
Apply the approved wording at whichever of those two locations actually
renders it (a hardcoded UI string vs. a per-entry data field - the grep
output determines which).

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(cves): clarify FVE disclosure-scope label wording"
```

---

## Self-Review

**1. Spec coverage** - every TaskList item #2-#15 maps to exactly one plan
task (Task 1=#2, Task 2=#5, Task 3=#3, Task 4=#4, Task 5=#6, Task 6=#7,
Task 7=#15, Task 8=#11, Task 9=#9, Task 10=#10, Task 11=#8, Task 12=#12,
Task 13=#16, Task 14=#14). All 14 TaskList items covered, none skipped.

**2. Placeholder scan** - no "TBD"/"handle edge cases"/"similar to Task N"
found. The one deliberately-open judgment call (Task 3's category picks,
Task 2's `topics` values) is bounded by an explicit rule + worked examples,
per Global Constraints, not left vague.

**3. Type consistency** - `TaggedItem` (Task 1) is used identically in Task
9's `getAllTaggedItems()` and Task 12's `SearchEntry` (a separate, smaller
type by design - search doesn't need `slug`, but does need `description`,
which `TaggedItem` doesn't carry - confirmed these are legitimately
different shapes for different purposes, not an accidental mismatch).
`useUrlState(key, defaultValue): [string, (value: string) => void]` (Task 7)
is called with the same two-arg, tuple-return shape in both Task 8 and Task
13. `normalizeTag(raw: string): string` (Task 1) is imported with the same
signature in Tasks 2 (informal use), 9, 10, 11.

**Correction made while writing this plan (not caught by spec-audit):** the
spec said "CVE has no tags field" - false. `CveEntry.tags` already exists
but is auto-derived structural metadata (`[kind, groupKey, "redacted"?]`),
confirmed by reading `normalizeCveEntry()` L716-720 directly and by reading
`content/ko/cves/cve-2026-52130.md`'s frontmatter (`tags: [llm, 2026, high,
cwe-674, dos]` - year/severity/cwe, not topics). Task 2 now adds a
**separate** `topics` field instead of overloading the existing `tags`, and
`docs/specs/blog-ia-improvement.md` + TaskList #5 have been corrected to
match before this plan was written, so spec/TaskList/plan agree.
