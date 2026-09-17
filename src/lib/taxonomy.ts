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
