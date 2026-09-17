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
        locked: Boolean(data.locked),
        type: section === "blog" ? "blog" : "writeup",
        title: data.title ?? slug,
        description: data.description ?? "",
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        date: data.date ? String(data.date) : "",
        href: `/${LOCALE}/${section}/${slug}/`,
      };
    })
    .filter((entry) => !entry.locked)
    .map(({ locked, ...entry }) => entry);
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
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        date: data.date ? String(data.date) : "",
        href: `/${LOCALE}/cves/${slug}/`,
      };
    });
}

const index = [...listSection("blog"), ...listSection("writeups"), ...listCves()];
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(index));
console.log(`wrote ${index.length} entries to ${path.relative(process.cwd(), OUT_PATH)}`);
