import type { Metadata } from "next";
import { routing, toBcp47 } from "@/i18n/routing";
import { SITE_URL, SITE_NAME } from "@/lib/site";

/**
 * Single source of truth for per-content-page metadata (SEO + AEO).
 *
 * Every content detail page (blog / writeups / cves) builds its `<head>` from
 * this one function instead of hand-rolling a `{ title }` object each. That
 * keeps canonical URLs, hreflang alternates, Open Graph, and Twitter cards
 * consistent — and means a new content type gets full metadata for free.
 *
 * Domain resolution relies on `metadataBase` (set once in the root layout), so
 * the relative paths returned here are expanded to absolute URLs by Next.js.
 */

/** Frontmatter fields this builder reads. All optional except title. */
export interface SeoFrontmatter {
  title?: string;
  /** Long-form posts use `description`; CVEs use `summary`. */
  description?: string;
  summary?: string;
  date?: string;
  modified?: string;
  tags?: string[];
  authors?: Array<{ name: string; link?: string; image?: string }>;
  image?: string;
}

export interface BuildMetaInput {
  /** URL section segment, e.g. "blog" | "writeups" | "cves". */
  section: string;
  slug: string;
  locale: string;
  fm: SeoFrontmatter;
}

/** Path for a given locale, with trailing slash (site uses trailingSlash: true). */
function pagePath(locale: string, section: string, slug: string): string {
  return `/${locale}/${section}/${slug}/`;
}

/**
 * Build hreflang alternates: every locale lists the same full set + x-default.
 * Google requires each localized page to reference all its siblings.
 */
function buildLanguages(
  section: string,
  slug: string,
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[toBcp47(loc)] = pagePath(loc, section, slug);
  }
  languages["x-default"] = pagePath(routing.defaultLocale, section, slug);
  return languages;
}

export function buildContentMetadata({
  section,
  slug,
  locale,
  fm,
}: BuildMetaInput): Metadata {
  const title = fm.title ?? slug;
  const description = fm.description ?? fm.summary ?? undefined;
  const canonical = pagePath(locale, section, slug);
  const authorNames = (fm.authors ?? []).map((a) => a.name);
  const images = fm.image ? [{ url: fm.image, alt: title }] : undefined;

  return {
    title,
    description,
    authors: (fm.authors ?? []).map((a) => ({ name: a.name, url: a.link })),
    keywords: fm.tags,
    alternates: {
      canonical,
      languages: buildLanguages(section, slug),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "article",
      locale: toBcp47(locale).replace("-", "_"),
      publishedTime: fm.date,
      modifiedTime: fm.modified ?? fm.date,
      authors: authorNames.length ? authorNames : undefined,
      tags: fm.tags,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: fm.image ? [fm.image] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

/**
 * JSON-LD structured data (AEO). Rendered by the page as a <script> element —
 * the Next.js metadata API only emits <meta>/<link>, never <script>, so schema
 * cannot live in generateMetadata. Returns Article + BreadcrumbList graph.
 */
export function buildContentJsonLd({
  section,
  slug,
  locale,
  fm,
}: BuildMetaInput): string {
  const base = SITE_URL;
  const url = base + pagePath(locale, section, slug);
  const title = fm.title ?? slug;
  const description = fm.description ?? fm.summary ?? undefined;

  const article: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    inLanguage: toBcp47(locale),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: fm.date,
    dateModified: fm.modified ?? fm.date,
    keywords: (fm.tags ?? []).join(", ") || undefined,
    image: fm.image ? base + fm.image : undefined,
    author: (fm.authors ?? []).map((a) => ({
      "@type": "Person",
      name: a.name,
      url: a.link,
    })),
    publisher: { "@type": "Organization", name: SITE_NAME, url: base },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: section,
        item: `${base}/${locale}/${section}/`,
      },
      { "@type": "ListItem", position: 2, name: title, item: url },
    ],
  };

  // Strip undefined so the emitted JSON stays clean.
  return JSON.stringify([article, breadcrumb], (_k, v) =>
    v === undefined ? undefined : v,
  );
}
