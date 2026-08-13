import type { MetadataRoute } from "next";
import { routing, toBcp47 } from "@/i18n/routing";
import { getAllSlugs } from "@/lib/content";

// Required for `output: export` — emit sitemap.xml as a static file at build.
export const dynamic = "force-static";

const BASE = "https://phantomn.github.io";

const STATIC_PAGES = ["", "about", "portfolio", "toolbox", "blog", "writeups", "cves"];
const CONTENT_SECTIONS = ["blog", "writeups", "cves"];

/** Full URL for a locale + path, trailing slash (site uses trailingSlash: true). */
function url(locale: string, subpath: string): string {
  const suffix = subpath ? `${subpath}/` : "";
  return `${BASE}/${locale}/${suffix}`;
}

/** hreflang alternates: same set of locales for every entry + x-default. */
function languagesFor(subpath: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[toBcp47(loc)] = url(loc, subpath);
  }
  languages["x-default"] = url(routing.defaultLocale, subpath);
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Static + list pages, one canonical entry per path (default locale).
  for (const page of STATIC_PAGES) {
    entries.push({
      url: url(routing.defaultLocale, page),
      alternates: { languages: languagesFor(page) },
    });
  }

  // Content detail pages.
  for (const section of CONTENT_SECTIONS) {
    for (const slug of getAllSlugs(section)) {
      const subpath = `${section}/${slug}`;
      entries.push({
        url: url(routing.defaultLocale, subpath),
        alternates: { languages: languagesFor(subpath) },
      });
    }
  }

  return entries;
}
