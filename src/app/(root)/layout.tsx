import { GoogleAnalytics } from "@next/third-parties/google";
import { AppHeadLinks } from "@/components/app-head-links";
import { RootProviders } from "@/components/root-providers";
import type { Metadata } from "next";
import { siteMetadata } from "@/lib/site-metadata";
import { routing } from "@/i18n/routing";
import "@/styles/globals.css";

export const metadata: Metadata = siteMetadata;

/**
 * Root layout for the bare "/" route only (client-side locale-detect
 * redirect in ./page.tsx). This route sits outside app/[locale], so it has
 * no locale param to render <html lang> with — routing.defaultLocale is the
 * only defensible static value here. See app/[locale]/layout.tsx for the
 * locale-aware root layout that every real page renders under (Next.js
 * "multiple root layouts" via route groups: one layout.js per top-level
 * group, each with its own <html>/<body>).
 */
export default function RootRedirectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={routing.defaultLocale} suppressHydrationWarning className="scroll-smooth">
      <head>
        <AppHeadLinks />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <RootProviders>{children}</RootProviders>
      </body>
      <GoogleAnalytics gaId="G-KV41V41G5J" />
    </html>
  );
}
