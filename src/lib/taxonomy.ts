import { TAG_SYNONYMS } from "@/data/taxonomy";
import { getContentList, getAllWriteups } from "@/lib/content";
import { CVE_ITEMS } from "@/data/cves";
import { routing } from "@/i18n/routing";

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

export function getAllTaggedItems(locale: string = routing.defaultLocale): TaggedItem[] {
  const blogItems: TaggedItem[] = getContentList("blog", locale).map((item) => ({
    type: "blog",
    slug: item.slug,
    title: item.meta.title,
    href: item.href,
    tags: item.meta.tags ?? [],
    date: (() => {
      const rawDate = item.meta.date as unknown;
      if (!rawDate) return "";
      return rawDate instanceof Date ? rawDate.toISOString().split("T")[0] : String(rawDate);
    })(),
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
