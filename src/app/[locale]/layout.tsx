import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";
import { routing, type Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AppHeadLinks } from "@/components/app-head-links";
import { RootProviders } from "@/components/root-providers";
import type { Metadata } from "next";
import { siteMetadata } from "@/lib/site-metadata";
import "@/styles/globals.css";

export const metadata: Metadata = siteMetadata;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Root layout for every /[locale]/* route (Next.js "multiple root layouts"
 * via route groups — see app/(root)/layout.tsx for the sibling root layout
 * that covers the bare "/" redirect). Rendering <html lang={locale}> here,
 * at build time via generateStaticParams, means each locale's static export
 * page ships with the correct lang attribute from the server — no
 * client-side patch needed.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className="scroll-smooth">
      <head>
        <AppHeadLinks />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <RootProviders>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <div className="print:hidden">
              <SiteHeader />
            </div>
            <main className="flex-1">{children}</main>
            <div className="print:hidden">
              <SiteFooter />
            </div>
          </NextIntlClientProvider>
        </RootProviders>
      </body>
      <GoogleAnalytics gaId="G-KV41V41G5J" />
    </html>
  );
}
