import type { Metadata } from "next";
import Link from "next/link";
import path from "path";
import fs from "fs";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getAllSlugs,
  getContent,
  getRelatedPosts,
  hasLocaleOverride,
} from "@/lib/content";
import { routing, toBcp47 } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PostSidebar } from "@/components/blog/post-sidebar";
import { ProseImageLightbox } from "@/components/blog/prose-image-lightbox";
import { ReadingProgress } from "@/components/blog/reading-progress";
import { ScrollToTop } from "@/components/blog/scroll-to-top";
import { DynamicTranslator } from "@/components/dynamic-translator";
import type { SerializedPost } from "@/components/blog/types";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs("blog");
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}

const CONTENT_DIR = path.join(process.cwd(), "content");

async function importPost(locale: string, slug: string) {
  // Prefer locale-specific override; fall back to default locale source.
  const override = hasLocaleOverride(locale, "blog", slug);
  if (override) {
    if (override.endsWith(".mdx")) {
      if (locale === "pt-br") return import(`@content/pt-br/blog/${slug}.mdx`);
      if (locale === "es") return import(`@content/es/blog/${slug}.mdx`);
    }
    if (locale === "pt-br") return import(`@content/pt-br/blog/${slug}.md`);
    if (locale === "es") return import(`@content/es/blog/${slug}.md`);
  }
  if (fs.existsSync(path.join(CONTENT_DIR, "ko", "blog", `${slug}.mdx`))) {
    return import(`@content/ko/blog/${slug}.mdx`);
  }
  return import(`@content/ko/blog/${slug}.md`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const mod = await importPost(locale, slug);
  const title = (mod.frontmatter?.title as string) ?? slug;
  return { title };
}

function serialize(item: NonNullable<ReturnType<typeof getContent>>): SerializedPost {
  return {
    slug: item.slug,
    title: item.meta.title,
    description: item.meta.description,
    date: item.meta.date,
    tags: item.meta.tags,
    categories: item.meta.categories,
    image: item.meta.image,
    readingTime: item.readingTime,
    href: item.href,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });

  const mod = await importPost(locale, slug);
  const Content = mod.default;
  const fm = (mod.frontmatter ?? {}) as {
    title?: string;
    date?: string;
    tags?: string[];
    categories?: string[];
    image?: string;
    description?: string;
    authors?: Array<{ name: string; link?: string; image?: string }>;
    relatedTopics?: string[];
  };

  const currentPost =
    getContent(`ko/blog/${slug}.mdx`) ?? getContent(`ko/blog/${slug}.md`);
  const readingTime = currentPost?.readingTime ?? 1;

  const relatedItems = getRelatedPosts("blog", slug, fm.tags ?? [], 4, locale);
  const relatedPosts = relatedItems.map(serialize);

  const relatedTags =
    fm.relatedTopics && fm.relatedTopics.length > 0
      ? fm.relatedTopics
      : Array.from(
          new Set([
            ...(fm.tags ?? []),
            ...relatedItems.flatMap((p) => p.meta.tags ?? []),
          ])
        ).sort();

  const author = fm.authors?.[0];
  const hasOverride = hasLocaleOverride(locale, "blog", slug) !== null;
  const shouldTranslate = locale !== routing.defaultLocale && !hasOverride;

  return (
    <>
      <ReadingProgress />

      <div className="mx-auto w-[90vw] max-w-[1200px] px-4 py-8">
        <Link
          href={`/${locale}/blog/`}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr; {t("backToBlog")}
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
          contentKey={`blog/${slug}`}
        >
          <header className="mb-8">
            {fm.categories && fm.categories.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {fm.categories.map((cat) => (
                  <Badge key={cat} variant="default" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}

            <h1 className="mb-4 text-3xl font-bold font-heading leading-tight sm:text-4xl">
              {fm.title}
            </h1>

            {fm.description && (
              <p className="mb-4 text-lg text-muted-foreground leading-relaxed">
                {fm.description}
              </p>
            )}

            <div
              data-notranslate
              className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
            >
              {author && (
                <div className="flex items-center gap-2">
                  {author.image && (
                    <img
                      src={author.image}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  )}
                  {author.link ? (
                    <a
                      href={author.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {author.name}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{author.name}</span>
                  )}
                </div>
              )}
              {fm.date && (
                <>
                  <span>&middot;</span>
                  <time>
                    {formatDate(fm.date, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }, toBcp47(locale))}
                  </time>
                </>
              )}
              <span>&middot;</span>
              <span>{t("minRead", { minutes: readingTime })}</span>
            </div>

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
              <div className="lg:sticky lg:top-20">
                <PostSidebar
                  relatedPosts={relatedPosts}
                  relatedTags={relatedTags}
                />
              </div>
            </aside>
          </div>
        </DynamicTranslator>
      </div>

      <ScrollToTop />
    </>
  );
}
