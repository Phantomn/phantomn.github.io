import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/site";

/**
 * Shared across both root layouts (app/(root)/layout.tsx and
 * app/[locale]/layout.tsx) — Next.js's multiple-root-layouts convention
 * requires each root layout file to declare its own `metadata` export, so
 * this constant is the single source both import instead of drifting apart.
 */
export const siteMetadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: "Hacking and general cybersecurity.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", images: ["/og-default.png"] },
  verification: {
    google: "gVTemYAsJEhb36XfmaxV2RgOBXyj4vqQ8dTfzSdmYko",
    other: { "msvalidate.01": "E505121A3A724E9FA08F34071E4F8D0C" },
  },
};
