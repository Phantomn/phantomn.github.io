import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getAllTaggedItems, buildTagIndex } from "@/lib/taxonomy";

const MIN_FREQUENCY = 3;

interface Props {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = { title: "Tags" };

export default async function TagsIndexPage({ params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tags" });

  const index = buildTagIndex(getAllTaggedItems(locale));
  const frequent = [...index.entries()]
    .filter(([, items]) => items.length >= MIN_FREQUENCY)
    .map(([tag, items]) => ({ tag, count: items.length }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-title font-bold font-heading">{t("indexHeading")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t("indexHint")}</p>
      <ul className="flex flex-wrap gap-2">
        {frequent.map(({ tag, count }) => (
          <li key={tag}>
            <Link
              href={`/${locale}/tags/${tag}/`}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
            >
              #{tag}
              <span className="text-xs text-muted-foreground">{count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
