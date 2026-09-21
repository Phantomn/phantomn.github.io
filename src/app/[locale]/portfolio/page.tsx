import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Mail,
  ShieldCheck,
  Star,
  FileText,
  Target,
  Briefcase,
  FolderKanban,
  Wrench,
  Bug,
  Award,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PortfolioProjects } from "@/components/portfolio/portfolio-projects";
import { PrintButton } from "@/components/portfolio/print-button";
import { PORTFOLIO_CATEGORY_COUNTS, PORTFOLIO_CATEGORY_KEYS, PORTFOLIO_PROJECT_COUNT } from "@/data/portfolio";
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
  const categories = PORTFOLIO_CATEGORY_KEYS.map((key) => ({
    key,
    label: t(`categories.${key}`),
    count: PORTFOLIO_CATEGORY_COUNTS[key],
  }));

  const profile = {
    name: tAbout("name"),
    headline: t("headline"),
    summary: t("summary", {
      projects: PORTFOLIO_PROJECT_COUNT,
      ls2025: ls2025Text,
      cve: CVE_ONLY_COUNT,
      breakdown: CVE_BREAKDOWN,
      fve: FVE_COUNT,
    }),
    location: "Seoul, South Korea",
    email: SITE_AUTHOR.email,
    avatar: "/images/avatar.jpg",
  };
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
      <div className="mx-auto w-[90vw] max-w-[900px] py-6 print:w-full print:max-w-none print:py-0">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
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
                <h1 className="font-heading text-2xl font-bold" data-notranslate>
                  {profile.name}
                </h1>
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
          </CardContent>
        </Card>

        {/* ── Summary ───────────────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <FileText className="h-5 w-5 text-primary" />
              {t("sectionSummary")}
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground">
              {profile.summary}
            </p>
          </CardContent>
        </Card>

        {/* ── Core Competencies ─────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <Target className="h-5 w-5 text-primary" />
              {t("sectionCompetencies")}
            </h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {competencies.map((c, i) => (
                <li key={i} className="flex gap-2 text-base leading-relaxed text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-muted-foreground" data-notranslate>
                    ▹
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Featured Projects ─────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <Star className="h-5 w-5 text-primary" />
              {t("sectionFeatured")}
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {featured.map((p, idx) => (
                <div key={p.title} className="break-inside-avoid">
                  {idx > 0 && <Separator className="mb-6" />}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    {p.contribution > 0 && (
                      <Badge variant="outline" className="shrink-0 tabular-nums" data-notranslate>
                        {p.contributionLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70" data-notranslate>
                      {p.client}
                    </span>
                    <span className="tabular-nums" data-notranslate>
                      {p.period}
                    </span>
                    <span>{p.role}</span>
                  </div>
                  {p.background && (
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                      {p.background}
                    </p>
                  )}
                  {p.actions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-foreground/80">
                        {t("labelActions")}
                      </div>
                      <ul className="mt-1 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-muted-foreground">
                        {p.actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.results.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-foreground/80">
                        {t("labelResults")}
                      </div>
                      <ul className="mt-1 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-muted-foreground">
                        {p.results.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.stack && p.stack.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5" data-notranslate>
                      {p.stack.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[11px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Experience ────────────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <Briefcase className="h-5 w-5 text-primary" />
              {t("sectionExperience")}
            </h2>
          </CardHeader>
          <CardContent>
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
                      <h3 className="text-base font-semibold">{exp.role}</h3>
                      <div className="text-sm text-foreground/80" data-notranslate>
                        {exp.company}
                      </div>
                      <div className="text-sm text-muted-foreground" data-notranslate>
                        {exp.dates} · {exp.location}
                      </div>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-muted-foreground">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── All Projects (filterable) ─────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <FolderKanban className="h-5 w-5 text-primary" />
              {t("sectionProjects")}{" "}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                ({PORTFOLIO_PROJECT_COUNT})
              </span>
            </h2>
          </CardHeader>
          <CardContent>
            <PortfolioProjects
              projects={projects}
              categories={categories}
              allLabel={t("filterAll")}
              actionsLabel={t("labelActions")}
              resultsLabel={t("labelResults")}
            />
          </CardContent>
        </Card>

        {/* ── Skills ────────────────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <Wrench className="h-5 w-5 text-primary" />
              {t("sectionSkills")}
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {SKILL_GROUPS.map((g, idx) => (
                <div key={g.title}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <h3 className="mb-2 text-sm font-semibold" data-notranslate>
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
          </CardContent>
        </Card>

        {/* ── CVE / Vulnerability Research ──────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <Bug className="h-5 w-5 text-primary" />
              {t("sectionCves")}{" "}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                (CVE {CVE_ONLY_COUNT} · FVE {FVE_COUNT}
                {CVE_PENDING_COUNT > 0 ? ` · ${tAbout("pendingLabel")} ${CVE_PENDING_COUNT}` : ""})
              </span>
            </h2>
          </CardHeader>
          <CardContent>
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
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {item.year}
                      </span>
                    </div>
                    <div className="mt-2 text-base leading-relaxed text-muted-foreground">
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
          </CardContent>
        </Card>

        {/* ── Certifications & Education ────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-xl leading-none font-semibold">
              <Award className="h-5 w-5 text-primary" />
              {t("sectionCredentials")}
            </h2>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("labelCertifications")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {certifications.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("labelEducation")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {education.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
