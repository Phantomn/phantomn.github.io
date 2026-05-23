/**
 * Listing & discovery only. Reads content/{locale}/*.md frontmatter for indexes
 * and section meta. MDX body is rendered via dynamic import (@next/mdx), not
 * from here.
 *
 * Canonical content lives under `content/en/` (default locale). Other locales
 * may provide per-post overrides under `content/pt-br/` / `content/es/`. When
 * no override exists, listings still surface the English post — detail pages
 * translate dynamically via the Lingva-backed client translator.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { routing } from "@/i18n/routing";

const CONTENT_DIR = path.join(process.cwd(), "content");
const DEFAULT_LOCALE = routing.defaultLocale;

/**
 * Frontmatter metadata parsed from a content `.md` file.
 */
export interface ContentMeta {
  title: string;
  date?: string;
  description?: string;
  tags?: string[];
  categories?: string[];
  weight?: number;
  authors?: Array<{ name: string; link?: string; image?: string }>;
  image?: string;
  difficulty?: string;
  draft?: boolean;
  [key: string]: unknown;
}

/**
 * Listing entry for a content file: slug, frontmatter meta, and URL path.
 */
export interface ContentItem {
  slug: string;
  meta: ContentMeta;
  href: string;
  readingTime: number;
}

const CONTENT_EXT_RE = /\.(md|mdx)$/;
const INDEX_RE = /^_index\.(md|mdx)$/;

/**
 * Reads a single content file and returns its frontmatter and listing data (no body).
 *
 * @param relativePath - Path relative to `content/` (e.g. `en/blog/my-post.md`).
 */
export function getContent(relativePath: string): ContentItem | null {
  const fullPath = path.join(CONTENT_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, "utf-8");
  const { data, content: body } = matter(raw);
  const ext = path.extname(relativePath);
  const slug = path.basename(relativePath, ext).replace(/^_index$/, "");
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const dir = path.dirname(relativePath).replace(/\\/g, "/");
  return {
    slug,
    meta: data as ContentMeta,
    href: "/" + dir + (slug ? `/${slug}/` : "/"),
    readingTime,
  };
}

/**
 * Returns the section index entry for a given section (its `_index.md`) from
 * the default locale folder.
 */
export function getSectionIndex(section: string): ContentItem | null {
  for (const ext of ["md", "mdx"]) {
    const rel = `${DEFAULT_LOCALE}/${section}/_index.${ext}`;
    if (fs.existsSync(path.join(CONTENT_DIR, rel))) return getContent(rel);
  }
  return null;
}

/**
 * Lists all content files in a section from the default-locale folder, with
 * hrefs rewritten to include `/{hrefLocale}/` so links stay within the
 * visitor's current language. Sorted by weight, then date, then title.
 */
export function getContentList(section: string, hrefLocale: string = DEFAULT_LOCALE): ContentItem[] {
  const sourceRel = `${DEFAULT_LOCALE}/${section}`;
  const dirPath = path.join(CONTENT_DIR, sourceRel);
  if (!fs.existsSync(dirPath)) return [];

  return fs
    .readdirSync(dirPath)
    .filter((f) => CONTENT_EXT_RE.test(f) && !INDEX_RE.test(f))
    .map((f) => {
      const item = getContent(path.join(sourceRel, f));
      if (item) item.href = `/${hrefLocale}/${section}/${item.slug}/`;
      return item;
    })
    .filter((item): item is ContentItem => item !== null && !item.meta.draft)
    .sort((a, b) => {
      if (a.meta.weight !== undefined && b.meta.weight !== undefined)
        return a.meta.weight - b.meta.weight;
      if (a.meta.date && b.meta.date)
        return new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime();
      return a.meta.title.localeCompare(b.meta.title);
    });
}

/**
 * Returns related posts from the same section, ranked by shared tag count.
 */
export function getRelatedPosts(
  section: string,
  currentSlug: string,
  tags: string[],
  limit = 4,
  hrefLocale: string = DEFAULT_LOCALE,
): ContentItem[] {
  const all = getContentList(section, hrefLocale).filter((p) => p.slug !== currentSlug);
  if (tags.length === 0) return all.slice(0, limit);

  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  return all
    .map((p) => ({
      item: p,
      score: (p.meta.tags ?? []).filter((t) => tagSet.has(t.toLowerCase())).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.item);
}

/* ── Writeup helpers ────────────────────────────────────────────── */

export interface WriteupItem {
  slug: string;
  name: string;
  source: string;
  sourceKey: string;
  category: string;
  categoryKey: string;
  difficulty: string;
  tags: string[];
  date: string;
  href: string;
}

const SOURCE_NAMES: Record<string, string> = {
  htb: "HackTheBox",
  thm: "TryHackMe",
  vulnhub: "VulnHub",
  cyberdefenders: "CyberDefenders",
  letsdefend: "LetsDefend",
  portswigger: "PortSwigger",
};

const CATEGORY_NAMES: Record<string, string> = {
  blueteam: "Blue Team",
  redteam: "Red Team",
  web: "Web Security",
};

/**
 * Reads all writeups from the default-locale folder and returns hrefs
 * prefixed with the requested locale.
 */
export function getAllWriteups(hrefLocale: string = DEFAULT_LOCALE): WriteupItem[] {
  const writeupsDir = path.join(CONTENT_DIR, DEFAULT_LOCALE, "writeups");
  if (!fs.existsSync(writeupsDir)) return [];

  const files = fs
    .readdirSync(writeupsDir)
    .filter((f) => CONTENT_EXT_RE.test(f) && !INDEX_RE.test(f));

  const items: WriteupItem[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(writeupsDir, file), "utf-8");
    const { data } = matter(raw);
    const meta = data as ContentMeta;
    const slug = file.replace(CONTENT_EXT_RE, "");

    const platformKey = (meta.platform as string) ?? "";
    const categoryKey = (meta.category as string) ?? "";

    let dateStr = "";
    const rawDate = meta.date;
    if (rawDate) {
      const d = rawDate as unknown;
      dateStr = d instanceof Date ? d.toISOString().split("T")[0] : String(rawDate);
    }

    return {
      slug,
      name: meta.title ?? slug,
      source: SOURCE_NAMES[platformKey] ?? platformKey,
      sourceKey: platformKey,
      category: CATEGORY_NAMES[categoryKey] ?? categoryKey,
      categoryKey,
      difficulty: meta.difficulty ?? "Unknown",
      tags: meta.tags ?? [],
      date: dateStr,
      href: `/${hrefLocale}/writeups/${slug}/`,
    };
  });

  return items.sort((a, b) => {
    if (a.date && b.date)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    return a.name.localeCompare(b.name);
  });
}

/**
 * Returns the list of content slugs in a section from the default-locale
 * folder. Used by `generateStaticParams` for [slug] routes — the same set of
 * slugs is generated under every locale, with per-locale override or dynamic
 * translation at render time.
 */
export function getAllSlugs(section: string): string[] {
  const dirPath = path.join(CONTENT_DIR, DEFAULT_LOCALE, section);
  if (!fs.existsSync(dirPath)) return [];

  return fs
    .readdirSync(dirPath)
    .filter((f) => CONTENT_EXT_RE.test(f) && !INDEX_RE.test(f))
    .filter((f) => {
      const item = getContent(path.join(DEFAULT_LOCALE, section, f));
      return item !== null && !item.meta.draft;
    })
    .map((f) => f.replace(CONTENT_EXT_RE, ""));
}

/**
 * Checks whether a locale has its own override copy of a given post.
 * Returns the relative path (e.g. `pt-br/blog/post.mdx`) or null if no
 * override exists — caller should fall back to the default-locale source.
 */
export function hasLocaleOverride(
  locale: string,
  section: string,
  slug: string,
): string | null {
  if (locale === DEFAULT_LOCALE) return null;
  for (const ext of ["mdx", "md"]) {
    const rel = `${locale}/${section}/${slug}.${ext}`;
    if (fs.existsSync(path.join(CONTENT_DIR, rel))) return rel;
  }
  return null;
}
