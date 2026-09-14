#!/usr/bin/env node
// Password-gates content pages marked `locked: true` in frontmatter.
// Runs after `next build` (output: "export"): finds every already-built
// out/{locale}/{section}/{slug}/index.html for locked posts and replaces it
// in place with a staticrypt-encrypted version. No-op if nothing is locked.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "out");
const LOCALES = ["en", "ko", "pt-br", "es"];
const SECTIONS = ["blog", "writeups", "cves"];
const CONTENT_EXT_RE = /\.(md|mdx)$/;
// Must match routing.defaultLocale in src/i18n/routing.ts — that's where
// canonical frontmatter (including `locked`) lives.
const DEFAULT_LOCALE = "ko";

function findLockedSlugs() {
  const found = [];
  for (const section of SECTIONS) {
    const dir = path.join(CONTENT_DIR, DEFAULT_LOCALE, section);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!CONTENT_EXT_RE.test(file) || file.startsWith("_index.")) continue;
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data } = matter(raw);
      if (data.locked) found.push({ section, slug: file.replace(CONTENT_EXT_RE, "") });
    }
  }
  return found;
}

const STATICRYPT_BIN = path.join(ROOT, "node_modules", ".bin", "staticrypt");

function encryptInPlace(filePath, password) {
  const tmpDir = fs.mkdtempSync(path.join(ROOT, ".lock-posts-tmp-"));
  try {
    execFileSync(
      STATICRYPT_BIN,
      [filePath, "-d", tmpDir, "-p", password, "--short", "-c", "false"],
      { stdio: "inherit" },
    );
    fs.copyFileSync(path.join(tmpDir, "index.html"), filePath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main() {
  const locked = findLockedSlugs();
  if (locked.length === 0) {
    console.log("[lock-posts] no locked posts, skipping");
    return;
  }

  const password = process.env.LOCK_PASSWORD;
  if (!password) {
    console.error("[lock-posts] LOCK_PASSWORD env var is required to encrypt locked posts");
    process.exit(1);
  }

  for (const { section, slug } of locked) {
    for (const locale of LOCALES) {
      const pageDir = path.join(OUT_DIR, locale, section, slug);
      const htmlPath = path.join(pageDir, "index.html");
      if (fs.existsSync(htmlPath)) {
        encryptInPlace(htmlPath, password);
        console.log(`[lock-posts] encrypted ${path.relative(ROOT, htmlPath)}`);
      }

      // Next.js also emits index.txt — the RSC Flight payload used for
      // client-side <Link> navigation. It contains the full plaintext page
      // and staticrypt never touches it, so a soft navigation (clicking a
      // link instead of a full page load) would bypass the password gate
      // entirely. Delete it: the router falls back to a hard navigation,
      // which correctly hits the encrypted index.html.
      const txtPath = path.join(pageDir, "index.txt");
      if (fs.existsSync(txtPath)) {
        fs.rmSync(txtPath);
        console.log(`[lock-posts] removed ${path.relative(ROOT, txtPath)}`);
      }
    }
  }
}

main();
