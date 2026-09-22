import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader, StatRow } from "@/components/site/page-header";
import { getContentList } from "@/lib/content";
import { formatDate } from "@/lib/utils";
import { PORTFOLIO_PROJECT_COUNT } from "@/data/portfolio";
import { CVE_ITEMS, CVE_ONLY_COUNT, FVE_COUNT, isAssignedCve } from "@/data/cves";
import { formatResult, getCompetition } from "@/data/competitions";
import { toBcp47 } from "@/i18n/routing";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("title"), description: t("description") };
}

const COMPANY = "CoreSecurity";
const RECENT_POSTS = 5;
const RECENT_CVES = 4;

/*
 * 홈. 이전에는 전체 화면 히어로(외부 Cloudinary 영상 + 큰 아바타)와 네비게이션 카드 3개뿐이어서
 * 첫 화면에 보이는 글자가 153자였고 작업물이 하나도 보이지 않았다(표본 97곳 중 46%는 첫 화면에 작업물을 보여 준다).
 * 이제 이름·역할·소개 문장·숫자·최근 기록을 차례로 보여 준다. 숫자와 목록은 모두 단일 원본에서 온다.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const tAbout = await getTranslations({ locale, namespace: "about" });
  const tPortfolio = await getTranslations({ locale, namespace: "portfolio" });
  const tr = await getTranslations({ locale, namespace: "records" });

  const ls2025 = getCompetition("ls2025");
  const track = ls2025.tracks?.[0];
  const stats = [
    { label: tPortfolio("stats.projects"), value: String(PORTFOLIO_PROJECT_COUNT) },
    { label: tPortfolio("stats.cves"), value: String(CVE_ONLY_COUNT) },
    { label: tPortfolio("stats.fves"), value: String(FVE_COUNT) },
    ...(track
      ? [{ label: `${ls2025.name} ${ls2025.year} ${track.name}`, value: tr("rankValue", { rank: track.rank }) }]
      : []),
  ];

  const posts = getContentList("blog", locale).slice(0, RECENT_POSTS);
  const cves = CVE_ITEMS.filter(isAssignedCve)
    .slice()
    .sort((a, b) => b.year - a.year || b.id.localeCompare(a.id))
    .slice(0, RECENT_CVES);

  return (
    <div className="mx-auto w-[90vw] max-w-[900px] break-keep py-10">
      <PageHeader
        eyebrow={`${t("description")} · ${COMPANY}`}
        title={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Image
              src="/images/avatar-glitch.gif"
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-full border-2 border-primary/60 bg-black object-contain"
            />
            <span data-notranslate>{tAbout("name")}</span>
          </span>
        }
        lead={tAbout("intro")}
      >
        <StatRow items={stats} />
        <p className="mt-6 max-w-[var(--measure)] text-body-sm text-muted-foreground" data-notranslate>
          {ls2025.name} {ls2025.year} — {formatResult(ls2025, tr)}
        </p>
      </PageHeader>

      <section id="recent-posts" className="mt-16 scroll-mt-24">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-heading font-semibold tracking-tight">{t("recentPosts")}</h2>
          <Link
            href={`/${locale}/blog/`}
            className="eyebrow inline-flex items-center gap-1 hover:text-primary"
          >
            {t("viewAll")}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        <ul className="divide-y border-y">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={p.href} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="eyebrow shrink-0 tabular-nums sm:w-24" data-notranslate>
                  {p.meta.date
                    ? formatDate(
                        p.meta.date,
                        { year: "numeric", month: "short", day: "numeric" },
                        toBcp47(locale),
                      )
                    : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-subheading font-semibold group-hover:text-primary">
                    {p.meta.title}
                  </span>
                  {p.meta.description && (
                    <span className="mt-1 block text-body-sm text-muted-foreground">
                      {p.meta.description}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="recent-cves" className="mt-16 scroll-mt-24">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-heading font-semibold tracking-tight">{t("recentCves")}</h2>
          <Link
            href={`/${locale}/cves/`}
            className="eyebrow inline-flex items-center gap-1 hover:text-primary"
          >
            {t("viewAll")}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        <ul className="divide-y border-y">
          {cves.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${locale}/cves/${c.slug}/`}
                className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="eyebrow shrink-0 sm:w-44" data-notranslate>
                  {c.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-subheading font-semibold group-hover:text-primary">
                    {c.title}
                  </span>
                  <span className="mt-1 block text-meta text-muted-foreground">
                    {c.groupLabel} · CVSS {c.score.toFixed(1)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
