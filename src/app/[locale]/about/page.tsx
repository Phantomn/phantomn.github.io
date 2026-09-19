import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Link2, Users, ShieldCheck } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { DynamicTranslator } from "@/components/dynamic-translator";
import { icons } from "@/lib/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CVE_COUNT, CVE_ONLY_COUNT, FVE_COUNT } from "@/data/cves";
import type {
  SkillCategory,
  AchievementItem,
  LanguageItem,
  ResumeLink,
} from "@/types/profile";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title") };
}

/* ────────────────────────────────────────────────────────────────── */
/*  Static profile data                                              */
/* ────────────────────────────────────────────────────────────────── */

const PROFILE = {
  name: "홍승표 (ph4nt0m)",
  headline:
    `Offensive Security Researcher | Web/App · OT/ICS · LLM Pentesting | CVE ${CVE_ONLY_COUNT} · FVE ${FVE_COUNT} | AI Security Automation`,
  location: "Seoul, South Korea",
  website: "mailto:newbiepwner@kakao.com",
  connections: String(CVE_COUNT),
  avatar: "/images/avatar.jpg",
  banner: "/images/banner.webp",
  currentCompany: {
    name: "CoreSecurity",
    logo: "/images/coresecurity.png",
  },
} as const;

const ABOUT_TEXT = `보안 리서처로 일하고 있습니다. 금융권 Web/App 모의해킹과 OT/ICS 점검을 거쳐, 지금은 LLM 추론 엔진(llama.cpp 등) 취약점 연구와 AI 기반 점검 자동화에 집중하고 있습니다. BoB 8기에서는 커널 퍼저를 직접 만들어 취약점을 찾았습니다. 지금까지 CVE ${CVE_ONLY_COUNT}건과 FVE ${FVE_COUNT}건을 발견해 등록했습니다. 전체 경력과 프로젝트는 포트폴리오에서 볼 수 있습니다.`;

const SKILLS: SkillCategory[] = [
  {
    title: "Offensive Security",
    items: [
      "Web/App Pentesting",
      "OT/ICS Pentesting",
      "Red Team",
      "Exploit Development",
      "Vulnerability Research",
      "Fuzzing",
      "Reverse Engineering",
      "Threat Modeling",
    ],
  },
  {
    title: "Standards & Compliance",
    items: ["IEC 62443-4-2", "FDA 510(k)", "Achilles Level 2", "ISO 27001", "ISMS"],
  },
  {
    title: "AI Security Automation",
    items: ["MCP + A2A", "n8n Orchestration", "RAG / pgvector", "LLM Integration"],
  },
  {
    title: "Tools",
    items: [
      "IDA Pro",
      "Burp Suite",
      "Frida",
      "CodeQL",
      "Ghidra",
      "Wireshark",
      "Kali Linux",
      "Docker",
      "Python",
      "C / C++",
    ],
  },
];

const ACHIEVEMENTS: AchievementItem[] = [
  {
    name: "NATO CCDCOE Locked Shields 2025 — DFIR CTF 1위",
    href: "https://ccdcoe.org/exercises/locked-shields/",
    badgeSrc: "/images/ccdcoe.png",
  },
  {
    name: "NATO CCDCOE Locked Shields 2026 — Special System 9위",
    href: "https://ccdcoe.org/exercises/locked-shields/",
    badgeSrc: "/images/ccdcoe.png",
  },
];

const LANGUAGES: LanguageItem[] = [
  { flag: "kr", name: "한국어", level: "Native" },
  { flag: "us", name: "English", level: "Conversational" },
];

const RESUME_LINKS: ResumeLink[] = [
  { label: "한국어 이력서", href: "/docs/resume-ko.pdf", flag: "kr" },
  { label: "English Resume", href: "/docs/resume-en.pdf", flag: "us" },
];

/* ────────────────────────────────────────────────────────────────── */
/*  Page component                                                   */
/* ────────────────────────────────────────────────────────────────── */

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const shouldTranslate = locale !== routing.defaultLocale;
  return (
    <DynamicTranslator enabled={shouldTranslate} targetLocale={locale} contentKey="about">
    <div className="mx-auto w-[90vw] max-w-[900px] py-6">
      {/* ── Profile Header ──────────────────────────────────────── */}
      <Card className="relative overflow-hidden p-0">
        <div className="relative h-48 w-full sm:h-56">
          <Image
            src={PROFILE.banner}
            alt="Profile banner"
            fill
            priority
            className="object-cover object-top"
          />
        </div>

        <div className="relative px-6 pb-6 pt-0">
          <div className="absolute -top-16 left-6">
            <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-background shadow-lg">
              <Image
                src={PROFILE.avatar}
                alt={PROFILE.name}
                width={128}
                height={128}
                priority
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="h-20" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-heading">
                  {PROFILE.name}
                </h1>
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {PROFILE.headline}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {PROFILE.location}
                </span>
                <a
                  href={PROFILE.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {t("contactInfo")}
                </a>
              </div>

              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t("connections", { count: PROFILE.connections })}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
              <img
                src={PROFILE.currentCompany.logo}
                alt={PROFILE.currentCompany.name}
                className="h-8 w-8 object-contain"
              />
              <span className="text-sm font-medium">
                {PROFILE.currentCompany.name}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── About ───────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionAbout")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-relaxed text-muted-foreground">
            {ABOUT_TEXT}
          </p>
        </CardContent>
      </Card>

      {/* ── Portfolio CTA (경력/프로젝트/자격증/CVE 전체는 포트폴리오가 전담) ── */}
      <Card className="mt-4 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">{t("portfolioCta.heading")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("portfolioCta.body")}
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`/${locale}/portfolio/`}>{t("portfolioCta.cta")}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* ── Skills ──────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionSkills")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {SKILLS.map((cat, catIdx) => (
              <div key={cat.title}>
                {catIdx > 0 && <Separator className="mb-6" />}
                <h3 className="mb-3 text-sm font-semibold">{cat.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map((item) => (
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

      {/* ── Achievements ──────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionAchievements")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ACHIEVEMENTS.map((a) => (
              <a
                key={a.name}
                href={a.name.startsWith("CVE ") ? `/${locale}/cves/` : a.href}
                target={a.name.startsWith("CVE ") ? undefined : "_blank"}
                rel={a.name.startsWith("CVE ") ? undefined : "noopener noreferrer"}
                className="flex items-center justify-center overflow-hidden rounded-lg border bg-card p-2 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                {a.badgeSrc ? (
                  <img
                    src={a.badgeSrc}
                    alt={`${a.name} badge`}
                    className="w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/40 text-lg font-bold text-muted-foreground">
                    🏆 {a.name}
                  </div>
                )}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Languages ───────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionLanguages")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {LANGUAGES.map((l, idx) => (
              <div key={l.name}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://flagcdn.com/24x18/${l.flag}.png`}
                      srcSet={`https://flagcdn.com/48x36/${l.flag}.png 2x`}
                      width="24"
                      height="18"
                      alt={`${l.name} flag`}
                      className="rounded-sm"
                    />
                    <span className="text-sm font-semibold">{l.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {l.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Resume ──────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionResume")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {RESUME_LINKS.map((r) => (
              <a
                key={r.href}
                href={r.href}
                download
                className="group flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10"
              >
                <img
                  src={`https://flagcdn.com/48x36/${r.flag}.png`}
                  srcSet={`https://flagcdn.com/96x72/${r.flag}.png 2x`}
                  width="48"
                  height="36"
                  alt={`${r.label} flag`}
                  className="rounded-sm"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("downloadPdf")}
                  </div>
                </div>
                <FontAwesomeIcon
                  icon={icons.download}
                  className="h-4 w-4 text-primary opacity-60 transition-opacity group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </DynamicTranslator>
  );
}
