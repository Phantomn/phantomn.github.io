import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { routing, type Locale } from "@/i18n/routing";
import { getAllTaggedItems, normalizeTag, buildTagIndex } from "@/lib/taxonomy";

interface Props {
  params: Promise<{ locale: string; tag: string }>;
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => {
    const index = buildTagIndex(getAllTaggedItems(locale));
    return [...index.keys()].map((tag) => ({ locale, tag }));
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${normalizeTag(tag)}` };
}

const TYPE_LABEL: Record<string, string> = {
  blog: "Research",
  cve: "CVE",
  writeup: "Writeup",
};

export default async function TagPage({ params }: Props) {
  const { locale, tag } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tags" });

  const normalized = normalizeTag(tag);
  const index = buildTagIndex(getAllTaggedItems(locale));
  const items = index.get(normalized);
  if (!items || items.length === 0) notFound();

  const sorted = [...items].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted-foreground">{t("heading")}</p>
      <h1 className="mb-8 text-title font-bold font-heading">#{normalized}</h1>
      <ul className="flex flex-col gap-4">
        {sorted.map((item) => (
          <li key={`${item.type}-${item.slug}`} className="border-b border-border pb-4">
            <Link href={item.href} className="group flex items-center gap-3">
              <Badge variant="outline" className="shrink-0 text-xs">
                {TYPE_LABEL[item.type]}
              </Badge>
              <span className="font-medium group-hover:text-primary">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
