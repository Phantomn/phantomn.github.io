import type { Metadata } from "next";
import Link from "next/link";
import path from "path";
import fs from "fs";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllSlugs, hasLocaleOverride } from "@/lib/content";
import { routing, toBcp47 } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { ProseImageLightbox } from "@/components/blog/prose-image-lightbox";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { ScrollToTop } from "@/components/blog/scroll-to-top";
import { DynamicTranslator } from "@/components/dynamic-translator";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs("writeups");
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

const CONTENT_DIR = path.join(process.cwd(), "content");

async function importWriteup(locale: string, slug: string) {
  const override = hasLocaleOverride(locale, "writeups", slug);
  if (override) {
    if (override.endsWith(".mdx")) {
      if (locale === "pt-br") return import(`@content/pt-br/writeups/${slug}.mdx`);
      if (locale === "es") return import(`@content/es/writeups/${slug}.mdx`);
    }
    if (locale === "pt-br") return import(`@content/pt-br/writeups/${slug}.md`);
    if (locale === "es") return import(`@content/es/writeups/${slug}.md`);
  }
  if (fs.existsSync(path.join(CONTENT_DIR, "ko", "writeups", `${slug}.mdx`))) {
    return import(`@content/ko/writeups/${slug}.mdx`);
  }
  return import(`@content/ko/writeups/${slug}.md`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const mod = await importWriteup(locale, slug);
  const title = (mod.frontmatter?.title as string) ?? slug;
  return { title };
}

export default async function WriteupPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "writeups" });

  const mod = await importWriteup(locale, slug);
  const Content = mod.default;
  const fm = (mod.frontmatter ?? {}) as {
    title?: string;
    date?: string;
    tags?: string[];
    platform?: string;
    category?: string;
    difficulty?: string;
    image?: string;
    description?: string;
  };

  const hasOverride = hasLocaleOverride(locale, "writeups", slug) !== null;
  const shouldTranslate = locale !== routing.defaultLocale && !hasOverride;

  return (
    <>
      <ReadingProgress />

      <div className="mx-auto w-[90vw] max-w-[1200px] px-4 py-8">
        <Link
          href={`/${locale}/writeups/`}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr; {t("backToWriteups")}
        </Link>

        {fm.image && (
          <div className="mb-6 overflow-hidden rounded-xl">
            <img
              src={fm.image}
              alt=""
              className="h-64 w-full object-cover sm:h-80 lg:h-96"
            />
          </div>
        )}

        <DynamicTranslator
          enabled={shouldTranslate}
          targetLocale={locale}
          contentKey={`writeups/${slug}`}
        >
          <header className="mb-8">
            <div className="mb-3 flex flex-wrap gap-2">
              {fm.platform && (
                <Badge variant="default" className="text-xs uppercase">
                  {fm.platform}
                </Badge>
              )}
              {fm.category && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {fm.category}
                </Badge>
              )}
              {fm.difficulty && (
                <Badge variant="outline" className="text-xs">
                  {fm.difficulty}
                </Badge>
              )}
            </div>

            <h1 className="mb-4 text-3xl font-bold font-heading leading-tight sm:text-4xl">
              {fm.title}
            </h1>

            {fm.description && (
              <p className="mb-4 text-lg text-muted-foreground leading-relaxed">
                {fm.description}
              </p>
            )}

            {fm.date && (
              <div
                data-notranslate
                className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
              >
                <time>
                  {formatDate(fm.date, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }, toBcp47(locale))}
                </time>
              </div>
            )}

            {fm.tags && fm.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {fm.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </header>

          <div className="flex flex-col gap-8 lg:flex-row">
            <article className="w-full min-w-0 lg:w-[70%]">
              <ProseImageLightbox>
                <div
                  data-prose-content
                  className="prose prose-neutral max-w-none dark:prose-invert"
                >
                  <Content />
                </div>
              </ProseImageLightbox>
            </article>

            <aside data-notranslate className="w-full lg:w-[30%]">
              <div className="space-y-4 lg:sticky lg:top-20">
                <TableOfContents />

                {fm.tags && fm.tags.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">
                        {t("tags")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {fm.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[11px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
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
