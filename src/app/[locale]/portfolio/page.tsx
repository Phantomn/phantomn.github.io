import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Mail,
  ShieldCheck,
  Star,
  Target,
  Briefcase,
  FolderKanban,
  Bug,
  Award,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PortfolioProjects } from "@/components/portfolio/portfolio-projects";
import { PrintButton } from "@/components/portfolio/print-button";
import { PORTFOLIO_CATEGORY_KEYS, PORTFOLIO_PROJECT_COUNT, type PortfolioCategoryKey } from "@/data/portfolio";
import { getLocalizedProjects } from "@/data/portfolio-i18n";
import {
  CVE_BREAKDOWN,
  CVE_ITEMS,
  CVE_ONLY_COUNT,
  CVE_PENDING_COUNT,
  FVE_COUNT,
} from "@/data/cves";
import { formatResult, getCompetition } from "@/data/competitions";
import { SITE_AUTHOR } from "@/lib/profile";
import type { ExperienceItem } from "@/types/profile";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portfolio" });
  return { title: t("title") };
}

/* 이 페이지의 모든 문장은 messages(portfolio.*)와 src/data/portfolio-text/<locale>.json 에서 온다.
   데이터에 한국어 문장을 두고 런타임 기계 번역에 맡기지 않는다 - 고유명사와 숫자가 깨진다. */

/** 섹션 앵커 줄. id 는 각 Section 의 id 와 같아야 한다(tests/portfolio.spec.ts 가 대조). */
const SECTION_NAV = [
  { id: "competencies", labelKey: "sectionCompetencies" },
  { id: "featured", labelKey: "sectionFeatured" },
  { id: "experience", labelKey: "sectionExperience" },
  { id: "projects", labelKey: "sectionProjects" },
  { id: "cves", labelKey: "sectionCves" },
  { id: "credentials", labelKey: "sectionCredentials" },
] as const;

/*
 * 섹션 골격. 표본 97곳을 브라우저로 재보니 섹션을 전부 테두리 박스로 감싼 사이트는 8곳(8%)뿐이고,
 * 위계가 좋은 그룹(56곳)은 섹션 중 17% 만 박스였다. 카드는 내용이 병렬로 반복되는 곳(프로젝트·CVE)에만 쓰고,
 * 나머지는 제목과 여백으로 나눈다. hr 구분선은 위계가 나쁜 그룹의 신호(35% 대 7%)라 쓰지 않는다.
 */
function Section({
  id,
  icon: Icon,
  title,
  aside,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-20 scroll-mt-24 break-inside-avoid first:mt-0 print:mt-6">
      <h2 className="mb-6 flex items-center gap-2.5 text-balance text-heading font-semibold tracking-tight">
        <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        {title}
        {aside}
      </h2>
      {children}
    </section>
  );
}

const SKILL_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Offensive Security",
    items: [
      "Web/App Pentesting",
      "OT/ICS Pentesting",
      "Vulnerability Research",
      "Exploit Development",
      "Fuzzing",
      "Reverse Engineering",
      "Threat Modeling",
    ],
  },
  {
    title: "Standards & Compliance",
    items: ["IEC 62443-4-2", "Achilles Level 2", "FDA eSTAR", "ISO 27001", "ISMS"],
  },
  {
    title: "Tools & Languages",
    items: ["IDA Pro", "Ghidra", "Burp Suite", "Frida", "Wireshark", "Python", "C/C++"],
  },
];
const FEATURED_CVES = [...CVE_ITEMS]
  .sort((a, b) => b.year - a.year || a.id.localeCompare(b.id))
  .slice(0, 4);

/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                             */
/* ────────────────────────────────────────────────────────────────── */

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "portfolio" });
  const tr = await getTranslations({ locale, namespace: "records" });
  const tAbout = await getTranslations({ locale, namespace: "about" });

  const ls2025 = getCompetition("ls2025");
  const ls2025Text = `${ls2025.name} ${ls2025.year} ${formatResult(ls2025, tr)}`;
  const projects = getLocalizedProjects(locale, tr).map((p) => ({
    ...p,
    contributionLabel: p.contribution > 0 ? t("contribution", { value: p.contribution }) : "",
  }));
  const featured = projects.filter((p) => p.featured);
  // 대표 프로젝트는 위 "주요 프로젝트" 에서 이미 상세히 보여 준다. 아래 목록에 또 넣으면 같은 프로젝트가 화면과 인쇄물에 두 번 나온다.
  const others = projects.filter((p) => !p.featured);
  const categoryLabel = Object.fromEntries(
    PORTFOLIO_CATEGORY_KEYS.map((key) => [key, t(`categories.${key}`)]),
  ) as Record<PortfolioCategoryKey, string>;
  const categories = PORTFOLIO_CATEGORY_KEYS.map((key) => ({
    key,
    label: t(`categories.${key}`),
    count: others.filter((p) => p.category === key).length,
  })).filter((c) => c.count > 0);

  const profile = {
    name: tAbout("name"),
    headline: t("headline"),
    // 순위·건수는 위 숫자 줄이 보여 준다. 문장에서 되풀이하지 않는다.
    summary: t("summary", { projects: PORTFOLIO_PROJECT_COUNT }),
    location: "Seoul, South Korea",
    email: SITE_AUTHOR.email,
    avatar: "/images/avatar.jpg",
  };
  /* 히어로의 숫자 줄. 값은 모두 단일 원본(portfolio.ts, cves.ts, competitions.json)에서 온다 - 여기서 숫자를 적지 않는다. */
  const ls2025Track = ls2025.tracks?.[0];
  const stats = [
    { label: t("stats.projects"), value: String(PORTFOLIO_PROJECT_COUNT) },
    { label: t("stats.cves"), value: String(CVE_ONLY_COUNT) },
    { label: t("stats.fves"), value: String(FVE_COUNT) },
    ...(ls2025Track
      ? [
          {
            label: `${ls2025.name} ${ls2025.year} ${ls2025Track.name}`,
            value: tr("rankValue", { rank: ls2025Track.rank }),
          },
        ]
      : []),
  ];
  const competencies = ["fintech", "ot", "iot", "llm", "medical", "cyberRange"].map((k) =>
    t(`competencies.${k}`, { ls2025: ls2025Text }),
  );
  const experience: ExperienceItem[] = [
    {
      role: t("experience.coresec.role"),
      company: t("experience.coresec.company"),
      logo: "/images/coresecurity.png",
      location: "Seoul, South Korea",
      dates: `2021.06 — ${t("present")}`,
      bullets: ["ot", "achilles", "iot", "medical", "eleccon", "lockedShields"].map((k) =>
        t(`experience.coresec.bullets.${k}`, { ls2025: ls2025Text }),
      ),
    },
    {
      role: t("experience.a3.role"),
      company: "A3 Security",
      logo: "/images/a3security.png",
      location: "Seoul, South Korea",
      dates: "2020.06 — 2021.06",
      bullets: ["financial", "review", "isms"].map((k) => t(`experience.a3.bullets.${k}`)),
    },
  ];
  const certifications = ["linux", "network"].map((k) => t(`certifications.${k}`));
  const education = ["kongju", "cheonan"].map((k) => t(`education.${k}`));

  return (
    <>
      <div className="mx-auto w-[90vw] max-w-[900px] break-keep py-6 print:w-full print:max-w-none print:py-0">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <header className="border-b pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background shadow">
              <Image
                src={profile.avatar}
                alt={profile.name}
                width={96}
                height={96}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-title font-bold" data-notranslate>
                  {profile.name}
                </h1>
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">{profile.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1" data-notranslate>
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location}
                </span>
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  data-notranslate
                >
                  <Mail className="h-3.5 w-3.5" />
                  {profile.email}
                </a>
              </div>
            </div>
            <div className="shrink-0">
              <PrintButton label={t("downloadPdf")} />
            </div>
          </div>

          <p className="mt-6 max-w-[var(--measure)] text-body text-muted-foreground">{profile.summary}</p>

          {/* 성과를 숫자로 먼저 보여 준다. 조사 표본에서 성과를 숫자 배지로 내세우는 곳이 21%(별도 표본에서는 20곳 중 6곳)였고,
              우리는 이 숫자들이 요약 문장 안에 묶여 있어 훑어서 읽히지 않았다. 값은 모두 단일 원본에서 온다. */}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-0.5">
                <dt className="text-meta text-muted-foreground">{s.label}</dt>
                <dd className="font-heading text-heading font-bold tabular-nums" data-notranslate>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* 섹션 앵커. 11화면짜리 페이지에 이동 장치가 없었다. 표본 97곳 중 35%(위계 좋은 그룹 39%)가 페이지 내 앵커를 둔다.
              고정 사이드바는 위계가 나쁜 그룹의 신호(25% 대 11%)라 쓰지 않는다. */}
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-meta print:hidden" aria-label={t("sectionsNav")}>
            {SECTION_NAV.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {t(sec.labelKey)}
              </a>
            ))}
          </nav>
        </header>

        {/* ── Summary ───────────────────────────────────────────── */}
        {/* ── Core Competencies ─────────────────────────────────── */}
        <Section id="competencies" icon={Target} title={t("sectionCompetencies")}>
            <ul className="max-w-[var(--measure)] space-y-2.5">
              {competencies.map((c, i) => (
                <li key={i} className="flex gap-2 text-body text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-muted-foreground" data-notranslate>
                    ▹
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>

            {/* 기술 스택. 역량 서술과 같은 주제라 별도 섹션에서 합쳤다(표본 섹션 수 중앙값 3, 사분위 [2,6]). */}
            <div className="mt-6 space-y-4">
              {SKILL_GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="mb-2 text-subheading font-semibold" data-notranslate>
                    {g.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5" data-notranslate>
                    {g.items.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        </Section>

        {/* ── Featured Projects ─────────────────────────────────── */}
        {/*
          대표 프로젝트는 배경/수행/성과를 위에서 아래로 쌓아서 한 건에 400px 넘게 들어갔고,
          이 섹션 하나가 페이지 글자의 38%였다. 셋을 나란히 3열로 놓으면 높이가 줄고 서로 대조된다.
          분야 라벨(eyebrow)은 이 프로젝트가 어느 영역인지 알려 주는 정보라 제목 위에 둔다.
        */}
        <Section id="featured" icon={Star} title={t("sectionFeatured")}>
            <div className="space-y-4">
              {featured.map((p) => (
                <article
                  key={p.id}
                  className="relative break-inside-avoid overflow-hidden rounded-xl border bg-card/40 p-5 sm:p-6"
                >
                  <span aria-hidden className="absolute inset-y-6 left-0 w-px bg-primary" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="eyebrow text-primary">{categoryLabel[p.category]}</div>
                      <h3 className="mt-1.5 text-balance text-subheading font-semibold">{p.title}</h3>
                    </div>
                    {p.contribution > 0 && (
                      <Badge variant="outline" className="shrink-0 tabular-nums" data-notranslate>
                        {p.contributionLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-muted-foreground">
                    <span className="font-medium text-foreground/70" data-notranslate>
                      {p.client}
                    </span>
                    <span className="tabular-nums" data-notranslate>
                      {p.period}
                    </span>
                    <span>{p.role}</span>
                  </div>

                  {/*
                    배경/수행/성과를 3열로 놓아 봤더니 한 열이 246px 이 되어 한글이 한 줄에 16자만 들어갔고(영문은 44자)
                    줄바꿈이 늘어 오히려 높이가 커졌다. 라벨만 왼쪽 열로 빼면 본문 폭 약 600px(한 줄 40자 안팎)을 유지하면서
                    라벨이 한 줄에서 세로로 정렬돼 훑어볼 수 있다.
                  */}
                  <dl className="mt-5 space-y-4 border-t pt-5">
                    {p.background && (
                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[6rem_1fr]">
                        <dt className="eyebrow sm:pt-1">{t("labelBackground")}</dt>
                        <dd className="text-body-sm text-muted-foreground">{p.background}</dd>
                      </div>
                    )}
                    {p.actions.length > 0 && (
                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[6rem_1fr]">
                        <dt className="eyebrow sm:pt-1">{t("labelActions")}</dt>
                        <dd>
                          <ul className="list-disc space-y-1.5 pl-4 text-body-sm text-muted-foreground">
                            {p.actions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {p.results.length > 0 && (
                      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[6rem_1fr]">
                        <dt className="eyebrow sm:pt-1">{t("labelResults")}</dt>
                        <dd>
                          <ul className="list-disc space-y-1.5 pl-4 text-body-sm text-muted-foreground">
                            {p.results.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>

                  {p.stack && p.stack.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5 border-t pt-4" data-notranslate>
                      {p.stack.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-label text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
        </Section>

        {/* ── Experience ────────────────────────────────────────── */}
        <Section id="experience" icon={Briefcase} title={t("sectionExperience")}>
            <div className="space-y-6">
              {experience.map((exp, idx) => (
                <div key={`${exp.role}-${idx}`} className="break-inside-avoid">
                  {idx > 0 && <Separator className="mb-6" />}
                  <div className="flex gap-4">
                    <div className="shrink-0 pt-0.5">
                      {exp.logo ? (
                        <img
                          src={exp.logo}
                          alt=""
                          className="h-12 w-12 rounded-md border bg-background object-contain p-1"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-subheading font-semibold">{exp.role}</h3>
                      <div className="text-body-sm text-foreground/80" data-notranslate>
                        {exp.company}
                      </div>
                      <div className="text-meta text-muted-foreground" data-notranslate>
                        {exp.dates} · {exp.location}
                      </div>
                      <ul className="mt-3 max-w-[var(--measure)] list-disc space-y-1.5 pl-5 text-body text-muted-foreground">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </Section>

        {/* ── All Projects (filterable) ─────────────────────────── */}
        <Section
          id="projects"
          icon={FolderKanban}
          title={t("sectionProjects")}
          aside={
            <span className="text-body-sm font-normal text-muted-foreground tabular-nums">
              ({others.length})
            </span>
          }
        >
            <PortfolioProjects
              projects={others}
              categories={categories}
              allLabel={t("filterAll")}
              actionsLabel={t("labelActions")}
              resultsLabel={t("labelResults")}
            />
        </Section>

        {/* ── Skills ────────────────────────────────────────────── */}

        {/* ── CVE / Vulnerability Research ──────────────────────── */}
        <Section
          id="cves"
          icon={Bug}
          title={t("sectionCves")}
          aside={
            <span className="text-body-sm font-normal text-muted-foreground tabular-nums">
              (CVE {CVE_ONLY_COUNT}({CVE_BREAKDOWN}) · FVE {FVE_COUNT}
              {CVE_PENDING_COUNT > 0 ? ` · ${tAbout("pendingLabel")} ${CVE_PENDING_COUNT}` : ""})
            </span>
          }
        >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FEATURED_CVES.map((item) => (
                  <a
                    key={item.id}
                    href={`/${locale}/cves/${item.slug}/`}
                    className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold" data-notranslate>
                        {item.id}
                      </span>
                      <span className="text-meta text-muted-foreground tabular-nums">
                        {item.year}
                      </span>
                    </div>
                    <div className="mt-2 text-body text-muted-foreground">
                      {item.summary}
                    </div>
                  </a>
                ))}
              </div>
              <div className="flex justify-end print:hidden">
                <Button asChild variant="outline">
                  <Link href={`/${locale}/cves/`}>{t("openRegistry")}</Link>
                </Button>
              </div>
            </div>
        </Section>

        {/* ── Certifications & Education ────────────────────────── */}
        <Section id="credentials" icon={Award} title={t("sectionCredentials")}>
            <div>
              <h3 className="mb-2 text-subheading font-semibold">{t("labelCertifications")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-body-sm text-muted-foreground">
                {certifications.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-subheading font-semibold">{t("labelEducation")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-body-sm text-muted-foreground">
                {education.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
        </Section>
      </div>
    </>
  );
}
