/**
 * Single source of truth for site-wide identity constants.
 *
 * The production origin is hardcoded in exactly one place here. Everything that
 * needs an absolute URL (metadataBase, canonical, sitemap, robots, JSON-LD)
 * imports SITE_URL from this module — so a domain move is a one-line change,
 * not a grep-and-hope across four files.
 *
 * Must stay in sync with `public/CNAME` (the file GitHub Pages reads to bind the
 * custom domain). The two together define where the site lives.
 */
export const SITE_URL = "https://blog.ph4nt0m.xyz";
export const SITE_NAME = "Ph4nt0m";
