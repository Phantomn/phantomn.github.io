import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Mail, ShieldCheck, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { DynamicTranslator } from "@/components/dynamic-translator";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PortfolioProjects } from "@/components/portfolio/portfolio-projects";
import { PrintButton } from "@/components/portfolio/print-button";
import {
  FEATURED_PROJECTS,
  PORTFOLIO_PROJECT_COUNT,
} from "@/data/portfolio";
import { CVE_COUNT, CVE_ITEMS } from "@/data/cves";
import type { ExperienceItem } from "@/types/profile";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "portfolio" });
  return { title: t("title") };
}

/* ────────────────────────────────────────────────────────────────── */
/*  Static profile data                                              */
/* ────────────────────────────────────────────────────────────────── */

const PROFILE = {
  name: "홍승표 (ph4nt0m)",
  headline:
    "Offensive Security Researcher · Web/App · OT/ICS Pentesting · 보안 컨설팅",
  summary: `금융권 Web/App 모의해킹부터 OT/ICS(IEC 62443)·IoT·의료기기(FDA) 보안, 사이버 공방 훈련 개발까지 ${PORTFOLIO_PROJECT_COUNT}건 이상의 프로젝트를 수행했습니다. LS ELECTRIC 자동화기기 Achilles Communication Certificate Level 2 인증 취득, NATO CCDCOE Locked Shields 2025 DFIR CTF 1위, Linux Kernel CVE ${CVE_COUNT}건 보유.`,
  location: "Seoul, South Korea",
  email: "newbiepwner@kakao.com",
  avatar: "/images/avatar.jpg",
} as const;

const CORE_COMPETENCIES: string[] = [
  "금융·공공 전자금융기반시설 Web/App 모의해킹 — 저축은행·캐피탈·증권·보험·제조 등 12개 사이트 수행 (A3 Security)",
  "OT/ICS 보안 — IEC 62443-4-2 기반 Threat Modeling·모의해킹, LS ELECTRIC 자동화기기 Achilles Communication Certificate Level 2 인증 취득",
  "IoT 취약점 분석·보안 도구 개발 — 스마트빌딩 IoT 탐지 기술, IoT/CCTV 침해사고 조사 도구, Linux Kernel File System Fuzzer로 CVE 16건 도출",
  "의료기기 보안 — FDA eSTAR 컨설팅 및 Web/App·의료기기 모의해킹, 보안인증 취득 지원",
  "사이버 공방 훈련 개발·운영 — 한국전력 ELECCON, NATO CCDCOE Locked Shields 2025 DFIR CTF 1위, APEX CTF 2025 문제 개발",
];

const EXPERIENCE: ExperienceItem[] = [
  {
    role: "ICS Security Researcher (주임 연구원)",
    company: "코어시큐리티 (CoreSecurity)",
    logo: "/images/coresecurity.png",
    location: "Seoul, South Korea",
    dates: "2021.06 — Present",
    bullets: [
      "OT/ICS 보안 — IEC 62443-4-2 Threat Modeling·모의해킹, LS ELECTRIC Achilles Level 2 인증 취득, 자동화 점검 도구 개발",
      "IoT 보안 — 스마트빌딩 IoT 취약점 탐지 기술 개발·실증, IoT/CCTV 침해사고 조사 도구 개발",
      "의료기기 보안 — FDA eSTAR 컨설팅 및 Web/App·의료기기 모의해킹",
      "사이버 공방 훈련 — 한국전력 ELECCON 운영·문제 개발, Locked Shields 2025 DFIR CTF 1위, APEX CTF 2025 문제 개발",
    ],
  },
  {
    role: "Web/App Pentester (사원)",
    company: "A3 Security",
    logo: "/images/a3security.png",
    location: "Seoul, South Korea",
    dates: "2020.06 — 2021.06",
    bullets: [
      "금융권·공공기관 전자금융기반시설 모의해킹 — 참저축은행, 애큐온캐피탈, 금융투자협회, SBI저축은행, 현대자동차 HKMC, 농협중앙회 RPA 등",
      "비정형 시스템 보안성 검토 — KT 기가지니 AI 스피커, IoT 열감지 장비, DB손해보험 클레임콜",
      "ISMS/ISO27001 인증 취득 지원 컨설팅 (코웨이)",
    ],
  },
];

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

const CERTIFICATIONS = [
  "리눅스 마스터 2급 (KAIT, 2021.07)",
  "네트워크 관리사 2급 (KAIT, 2024.07)",
];

const EDUCATION = [
  "공주대학교 컴퓨터공학부 (2012.02 — 2020.02)",
  "천안상업고등학교 정보처리과 (2009.03 — 2012.02)",
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
  const shouldTranslate = locale !== routing.defaultLocale;

  return (
    <DynamicTranslator
      enabled={shouldTranslate}
      targetLocale={locale}
      contentKey="portfolio"
    >
      <div className="mx-auto w-[90vw] max-w-[900px] py-6 print:w-full print:max-w-none print:py-0">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background shadow">
              <Image
                src={PROFILE.avatar}
                alt={PROFILE.name}
                width={96}
                height={96}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold" data-notranslate>
                  {PROFILE.name}
                </h1>
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{PROFILE.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1" data-notranslate>
                  <MapPin className="h-3.5 w-3.5" />
                  {PROFILE.location}
                </span>
                <a
                  href={`mailto:${PROFILE.email}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  data-notranslate
                >
                  <Mail className="h-3.5 w-3.5" />
                  {PROFILE.email}
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
            <CardTitle className="text-xl">{t("sectionSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {PROFILE.summary}
            </p>
          </CardContent>
        </Card>

        {/* ── Core Competencies ─────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-xl">{t("sectionCompetencies")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {CORE_COMPETENCIES.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-primary" data-notranslate>
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
            <CardTitle className="flex items-center gap-2 text-xl">
              <Star className="h-5 w-5 text-primary" />
              {t("sectionFeatured")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {FEATURED_PROJECTS.map((p, idx) => (
                <div key={p.title} className="break-inside-avoid">
                  {idx > 0 && <Separator className="mb-6" />}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    {p.contribution > 0 && (
                      <Badge variant="outline" className="shrink-0 tabular-nums" data-notranslate>
                        기여도 {p.contribution}%
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
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {p.background}
                    </p>
                  )}
                  {p.actions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-foreground/80">
                        {t("labelActions")}
                      </div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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
            <CardTitle className="text-xl">{t("sectionExperience")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {EXPERIENCE.map((exp, idx) => (
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
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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
            <CardTitle className="text-xl">
              {t("sectionProjects")}{" "}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                ({PORTFOLIO_PROJECT_COUNT})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioProjects />
          </CardContent>
        </Card>

        {/* ── Skills ────────────────────────────────────────────── */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-xl">{t("sectionSkills")}</CardTitle>
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
            <CardTitle className="text-xl">
              {t("sectionCves")}{" "}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                ({CVE_COUNT})
              </span>
            </CardTitle>
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
                    <div className="mt-2 text-sm text-muted-foreground">
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
            <CardTitle className="text-xl">{t("sectionCredentials")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("labelCertifications")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {CERTIFICATIONS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("labelEducation")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {EDUCATION.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DynamicTranslator>
  );
}
