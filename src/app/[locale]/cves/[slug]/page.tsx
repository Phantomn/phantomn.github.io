import type { Metadata } from "next";
import Link from "next/link";
import path from "path";
import fs from "fs";
import { ExternalLink } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicTranslator } from "@/components/dynamic-translator";
import { ProseImageLightbox } from "@/components/blog/prose-image-lightbox";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { ScrollToTop } from "@/components/blog/scroll-to-top";
import { routing, toBcp47 } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";
import {
  getAllSlugs,
  getContent,
  hasLocaleOverride,
} from "@/lib/content";
import {
  getCveBySlug,
  getCveSeverityLabel,
  type CveSeverity,
} from "@/data/cves";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs("cves");
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

const CONTENT_DIR = path.join(process.cwd(), "content");

async function importCve(locale: string, slug: string) {
  if (fs.existsSync(path.join(CONTENT_DIR, "ko", "cves", `${slug}.mdx`))) {
    return import(`@content/ko/cves/${slug}.mdx`);
  }
  return import(`@content/ko/cves/${slug}.md`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const mod = await importCve(locale, slug);
  const title = (mod.frontmatter?.title as string) ?? slug;
  const description = (mod.frontmatter?.summary as string) ?? undefined;
  return { title, description };
}

export default async function CvePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cves" });

  const mod = await importCve(locale, slug);
  const Content = mod.default;
  const fm = (mod.frontmatter ?? {}) as {
    title?: string;
    date?: string;
    summary?: string;
    severity?: string;
    status?: string;
    group?: string;
    externalLink?: string;
    tags?: string[];
  };

  const current =
    getContent(`ko/cves/${slug}.mdx`) ?? getContent(`ko/cves/${slug}.md`);
  const entry = getCveBySlug(slug);
  const hasOverride = hasLocaleOverride(locale, "cves", slug) !== null;
  const shouldTranslate = locale !== routing.defaultLocale && !hasOverride;

  const title = fm.title ?? entry?.title ?? slug.toUpperCase();
  const severity = (fm.severity ?? entry?.severity ?? "medium") as CveSeverity;
  const status = fm.status ?? entry?.status ?? "published";
  const group = fm.group ?? entry?.groupLabel ?? "";
  const summary = fm.summary ?? entry?.summary ?? "";
  const externalLink = fm.externalLink ?? entry?.href ?? "#";

  return (
    <>
      <ReadingProgress />

      <div className="mx-auto w-[90vw] max-w-[1200px] px-4 py-8">
        <Link
          href={`/${locale}/cves/`}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr; {t("backToCves")}
        </Link>

        <DynamicTranslator
          enabled={shouldTranslate}
          targetLocale={locale}
          contentKey={`cves/${slug}`}
        >
          <header className="mb-8 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">
                {getCveSeverityLabel(severity)}
              </Badge>
              <Badge variant="default" className="capitalize">
                {status === "pending" ? t("status.pending") : t("status.published")}
              </Badge>
              {group && <Badge variant="secondary">{group}</Badge>}
              {current?.meta.date && (
                <Badge variant="outline">
                  {formatDate(
                    current.meta.date,
                    { year: "numeric", month: "long", day: "numeric" },
                    toBcp47(locale),
                  )}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold font-heading leading-tight sm:text-4xl">
              {title}
            </h1>

            {summary && (
              <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                {summary}
              </p>
            )}
          </header>

          <div className="flex flex-col gap-8 lg:flex-row">
            <article className="w-full min-w-0 lg:w-[72%]">
              <ProseImageLightbox>
                <div
                  data-prose-content
                  className="prose prose-neutral max-w-none dark:prose-invert"
                >
                  <Content />
                </div>
              </ProseImageLightbox>
            </article>

            <aside className="w-full lg:w-[28%]">
              <div className="space-y-4 lg:sticky lg:top-20">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {t("facts")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.group")}</span>
                      <span className="text-right font-medium">{group || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.severity")}</span>
                      <span className="text-right font-medium capitalize">{getCveSeverityLabel(severity)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.status")}</span>
                      <span className="text-right font-medium capitalize">
                        {status === "pending" ? t("status.pending") : t("status.published")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.cve")}</span>
                      <span className="text-right font-medium">{slug.toUpperCase()}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {t("table.link")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {t("open")}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>

                {fm.tags && fm.tags.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">
                        Tags
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {fm.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </aside>
          </div>
        </DynamicTranslator>
      </div>

      <ScrollToTop />
    </>
  );
}
