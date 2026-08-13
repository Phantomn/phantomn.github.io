import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import "@/styles/globals.css";

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600&family=Signika:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-KV41V41G5J" />
    </html>
  );
}
