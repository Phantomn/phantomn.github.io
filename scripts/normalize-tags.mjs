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
