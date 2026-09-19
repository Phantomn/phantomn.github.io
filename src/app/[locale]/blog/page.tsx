import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getContentList, getSectionIndex } from "@/lib/content";
import { routing } from "@/i18n/routing";
import { BlogPageLayout } from "@/components/blog/blog-page-layout";
import { DynamicTranslator } from "@/components/dynamic-translator";
import type { SerializedPost } from "@/components/blog/types";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return { title: t("title") };
}

function serialize(item: ReturnType<typeof getContentList>[number]): SerializedPost {
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
    locked: item.meta.locked,
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });

  const section = getSectionIndex("blog");
  const posts = getContentList("blog", locale, true);

  const featuredPost = posts.length > 0 ? serialize(posts[0]) : null;
  const remainingPosts = posts.slice(1).map(serialize);

  const recentPosts = posts.slice(0, 5).map((p) => ({
    title: p.meta.title,
    date: p.meta.date,
    href: p.href,
    locked: p.meta.locked,
  }));

  const allTags = Array.from(
    new Set(posts.flatMap((p) => p.meta.tags ?? []))
  ).sort();

  return (
    <div className="mx-auto w-[90vw] max-w-[1200px] px-4 py-8">
      <div className="mb-8 border-l-4 border-primary pl-4">
        <h1 className="text-3xl font-bold font-heading">
          {section?.meta.title ?? t("title")}
        </h1>
      </div>

      <DynamicTranslator
        enabled={locale !== routing.defaultLocale}
        targetLocale={locale}
        contentKey="blog/index"
      >
        <BlogPageLayout
          featuredPost={featuredPost}
          posts={remainingPosts}
          recentPosts={recentPosts}
          allTags={allTags}
        />
      </DynamicTranslator>
    </div>
  );
}
