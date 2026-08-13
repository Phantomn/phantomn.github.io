import { getContentList } from "@/lib/content";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { routing } from "@/i18n/routing";

// Required for `output: export` — emit feed.xml as a static file at build.
export const dynamic = "force-static";

const SECTIONS = ["blog", "writeups", "cves"];
const LOCALE = routing.defaultLocale;

/** XML-escape the five predefined entities so titles/descriptions stay valid. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  // All sections merged, newest first — getContentList already sorts by date
  // with a stable slug tie-break.
  const items = SECTIONS.flatMap((section) =>
    getContentList(section, LOCALE).map((item) => ({ section, item })),
  )
    .filter(({ item }) => item.meta.date)
    .sort(
      (a, b) =>
        new Date(b.item.meta.date!).getTime() -
        new Date(a.item.meta.date!).getTime(),
    )
    .slice(0, 50); // ponytail: cap at 50 recent; full archive is the sitemap's job

  const entries = items
    .map(({ item }) => {
      const url = `${SITE_URL}${item.href}`;
      const desc = item.meta.description ?? "";
      return `    <item>
      <title>${esc(item.meta.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(item.meta.date!).toUTCString()}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
    })
    .join("\n");

  const lastBuild = items.length
    ? new Date(items[0].item.meta.date!).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>Hacking and general cybersecurity.</description>
    <language>${LOCALE}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${entries}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
