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

function parseCweList(cwe?: string) {
  const parts = (cwe ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== "CWE-unknown");

  const [primary, ...additional] = parts;
  return { primary, additional };
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
    kind?: string;
    visibility?: string;
    severity?: string;
    status?: string;
    group?: string;
    externalLink?: string;
    nvdLink?: string;
    sourceLinks?: {
      upstream?: string;
      nvd?: string;
      report?: string;
    };
    score?: number;
    cvssBaseScore?: number;
    vector?: string;
    cvssVector?: string;
    cwePrimary?: string;
    cweAdditional?: string[];
    cwe?: string;
    evaluation?: {
      label?: string;
      vector?: string;
      notes?: string;
    };
    redaction?: Record<string, boolean>;
    submittedAt?: string;
    issuedAt?: string;
    nvdStatus?: string;
    lastModified?: string;
    tags?: string[];
  };

  const current =
    getContent(`ko/cves/${slug}.mdx`) ?? getContent(`ko/cves/${slug}.md`);
  const entry = getCveBySlug(slug);
  const hasOverride = hasLocaleOverride(locale, "cves", slug) !== null;
  const shouldTranslate = locale !== routing.defaultLocale && !hasOverride;

  const title = fm.title ?? entry?.title ?? slug.toUpperCase();
  const kind = fm.kind ?? entry?.kind ?? "cve";
  const severity = (fm.severity ?? entry?.severity ?? "medium") as CveSeverity;
  const status = fm.status ?? entry?.status ?? "published";
  const group = fm.group ?? entry?.groupLabel ?? "";
  const summary = fm.summary ?? entry?.summary ?? "";
  const sourceLinks = {
    upstream: fm.sourceLinks?.upstream ?? fm.externalLink ?? entry?.sourceLinks.upstream ?? "#",
    nvd: fm.sourceLinks?.nvd ?? fm.nvdLink ?? entry?.sourceLinks.nvd ?? "#",
    report: fm.sourceLinks?.report ?? entry?.sourceLinks.report ?? "#",
  };
  const score = fm.score ?? fm.cvssBaseScore ?? entry?.score ?? 0;
  const vector = fm.vector ?? fm.cvssVector ?? entry?.vector ?? "";
  const cweFromFrontmatter = parseCweList(fm.cwe);
  const cwePrimary = fm.cwePrimary ?? entry?.cwePrimary ?? cweFromFrontmatter.primary ?? "";
  const cweAdditional =
    fm.cweAdditional ??
    entry?.cweAdditional ??
    cweFromFrontmatter.additional;
  const visibility = fm.visibility ?? entry?.visibility ?? (sourceLinks.upstream === "#" ? "redacted" : "public");
  const evaluation = fm.evaluation ?? entry?.evaluation ?? undefined;
  const submittedAt = fm.submittedAt ?? entry?.submittedAt ?? "";
  const issuedAt = fm.issuedAt ?? entry?.issuedAt ?? "";
  const published = fm.date ?? entry?.published ?? current?.meta.date ?? "";
  const lastModified = fm.lastModified ?? entry?.lastModified ?? "";

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
          <header
            className="mb-8 rounded-[var(--cve-radius)] border border-[var(--cve-border)] bg-[var(--cve-surface-strong)] p-6"
            style={{ boxShadow: "var(--cve-shadow)" }}
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="uppercase">
                {kind}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {getCveSeverityLabel(severity)}
              </Badge>
              <Badge variant="default" className="capitalize">
                {status === "pending" ? t("status.pending") : t("status.published")}
              </Badge>
              {group && <Badge variant="secondary">{group}</Badge>}
              <Badge variant="outline" className="capitalize">
                {visibility}
              </Badge>
              {published && (
                <Badge variant="outline">
                  {formatDate(
                    published,
                    { year: "numeric", month: "long", day: "numeric" },
                    toBcp47(locale),
                  )}
                </Badge>
              )}
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-bold font-heading leading-tight sm:text-4xl">
                {title}
              </h1>

              {summary && (
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {summary}
                </p>
              )}
            </div>
          </header>

          <div className="flex flex-col gap-8 lg:flex-row">
            <article
              className="w-full min-w-0 rounded-[var(--cve-radius)] border border-[var(--cve-border)] bg-[var(--cve-surface-strong)] p-5 lg:w-[72%]"
              style={{ boxShadow: "var(--cve-shadow)" }}
            >
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
                <Card
                  className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                  style={{ boxShadow: "var(--cve-shadow)" }}
                >
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
                      <span className="text-muted-foreground">{t("table.kind")}</span>
                      <span className="text-right font-medium uppercase">{kind}</span>
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
                      <span className="text-muted-foreground">{t("table.visibility")}</span>
                      <span className="text-right font-medium capitalize">
                        {visibility === "redacted" ? t("redacted") : visibility}
                      </span>
                    </div>
                    {score > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{t("table.score")}</span>
                        <span className="text-right font-medium">
                          {score.toFixed(1)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.primaryCwe")}</span>
                      <span className="text-right font-medium">{cwePrimary || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.published")}</span>
                      <span className="text-right font-medium">
                        {published
                          ? formatDate(published, { year: "numeric", month: "long", day: "numeric" }, toBcp47(locale))
                          : "-"}
                      </span>
                    </div>
                    {(submittedAt || issuedAt) && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{t("table.submittedAt")}</span>
                          <span className="text-right font-medium">
                            {submittedAt
                              ? formatDate(submittedAt, { year: "numeric", month: "long", day: "numeric" }, toBcp47(locale))
                              : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{t("table.issuedAt")}</span>
                          <span className="text-right font-medium">
                            {issuedAt
                              ? formatDate(issuedAt, { year: "numeric", month: "long", day: "numeric" }, toBcp47(locale))
                              : "-"}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.modified")}</span>
                      <span className="text-right font-medium">
                        {lastModified
                          ? formatDate(lastModified, { year: "numeric", month: "long", day: "numeric" }, toBcp47(locale))
                          : "-"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                  style={{ boxShadow: "var(--cve-shadow)" }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {t("table.cvss")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("table.score")}</span>
                      <span className="font-medium">{score > 0 ? score.toFixed(1) : "-"}</span>
                    </div>
                    <div className="break-all text-muted-foreground">{vector || "-"}</div>
                  </CardContent>
                </Card>

                <Card
                  className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                  style={{ boxShadow: "var(--cve-shadow)" }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {t("table.evaluation")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {evaluation ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{t("table.evaluation")}</span>
                          <span className="font-medium">{evaluation.label}</span>
                        </div>
                        <div className="break-all text-muted-foreground">{evaluation.vector}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("redacted")}</span>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                  style={{ boxShadow: "var(--cve-shadow)" }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      NVD
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sourceLinks.nvd && sourceLinks.nvd !== "#" ? (
                      <a
                        href={sourceLinks.nvd}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        {t("openNvd")}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("redacted")}
                      </span>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                  style={{ boxShadow: "var(--cve-shadow)" }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Disclosure
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sourceLinks.upstream && sourceLinks.upstream !== "#" ? (
                      <a
                        href={sourceLinks.upstream}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        {t("openDisclosure")}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("redacted")}
                      </span>
                    )}
                  </CardContent>
                </Card>

                {visibility === "redacted" && (
                  <Card
                    className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                    style={{ boxShadow: "var(--cve-shadow)" }}
                  >
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      {t("redactedDetails")}
                    </CardContent>
                  </Card>
                )}

                {fm.tags && fm.tags.length > 0 && (
                  <Card
                    className="border-[color:var(--cve-border)] bg-[var(--cve-surface-strong)]"
                    style={{ boxShadow: "var(--cve-shadow)" }}
                  >
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
