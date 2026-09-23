import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getContentList, getSectionIndex } from "@/lib/content";
import { routing } from "@/i18n/routing";
import { BlogSearchLayout } from "@/components/blog/blog-search-layout";
import { PageHeader } from "@/components/site/page-header";
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

  return (
    <div className="mx-auto w-[90vw] max-w-[900px] break-keep py-10">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={section?.meta.title ?? t("title")}
        lead={section?.meta.description}
      />

      <DynamicTranslator
        enabled={locale !== routing.defaultLocale}
        targetLocale={locale}
        contentKey="blog/index"
      >
        <div className="mt-10">
          <BlogSearchLayout featuredPost={featuredPost} posts={remainingPosts} />
        </div>
      </DynamicTranslator>
    </div>
  );
}
