import type { Metadata } from "next";
import Image from "next/image";
import { MapPin, Link2, Users, ShieldCheck } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { icons } from "@/lib/icons";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CertificationsSection } from "@/components/skills/certifications-section";
import type {
  CertCompanyGroup,
  ExperienceItem,
  SkillCategory,
  EducationRow,
  ProjectItem,
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
    "Offensive Security Researcher | Web/App · OT/ICS Pentesting | CVE 21 | AI Security Automation",
  location: "Seoul, South Korea",
  website: "mailto:newbiepwner@kakao.com",
  connections: "21",
  avatar: "/images/avatar.jpg",
  banner: "/images/banner.webp",
  currentCompany: {
    name: "CoreSecurity",
    logo: "/images/coresecurity.png",
  },
} as const;

const ABOUT_TEXT = "NATO CCDCOE Locked Shields 2025 DFIR CTF 1위 · CVE 21건 보유. 금융권 Web/App 모의해킹과 약 5년간의 OT/ICS 보안 경험을 바탕으로, 공격자의 시각으로 시스템의 근본 취약점을 찾고 공인된 성과로 입증해온 Offensive Security Researcher입니다. Best of the Best 8기 과정에서 File System Fuzzer를 직접 설계·구현해 OS Kernel CVE 16건(0-day 포함)을 도출하고 CodeBlue·Hack In The Box에서 발표했습니다. 최근에는 IDA·Burp Suite·Frida·CodeQL을 MCP+A2A 기반으로 연결한 AI Orchestration Framework를 구현해 실제 점검 대상에 적용하며 Low~Medium 취약점을 자동 식별하는 결과를 얻었습니다.";

const EXPERIENCE: ExperienceItem[] = [
  {
    role: "ICS Security Researcher (주임 연구원)",
    company: "코어시큐리티 (CoreSecurity)",
    logo: "/images/coresecurity.png",
    location: "Seoul, South Korea",
    dates: "2021.06 — Present",
    bullets: [
      "IEC 62443-4-2 기반 Threat Modeling 및 모의해킹 — LS ELECTRIC 자동화기기 Achilles Level 2 인증 취득 기여",
      "FDA eSTAR 보안 컨설팅 및 의료기기 모의해킹 수행",
      "스마트빌딩 IoT 취약점 탐지 기술 개발 및 실증, IoT/CCTV 침해사고 조사 도구 개발",
      "한국전력 실전형 사이버 공방 훈련(ELECCON) 2021~2024 운영 및 문제 개발",
      "NATO CCDCOE Locked Shields 2025 한국-캐나다 연합 DFIR 블루팀 참가 — 훈련 종합 6위, DFIR CTF 1위",
      "APEX CTF 2025 DFIR 문제 개발 참여 (2025.05 ~ 2025.09)",
      "NATO CCDCOE Locked Shields 2026 한국-헝가리 연합 Special System 블루팀 — 훈련 종합 9위",
    ],
  },
  {
    role: "Web/App Pentester (사원)",
    company: "A3 Security",
    logo: "/images/a3security.png",
    location: "Seoul, South Korea",
    dates: "2020.06 — 2021.06",
    bullets: [
      "금융권 및 공공기관 전자금융기반시설 모의해킹 12개 사이트 수행 — 고위험 취약점 평균 1~2건/사이트 식별",
      "KT 기가지니 AI 스피커, 농협중앙회 RPA, IoT 열감지 장비 등 비정형 시스템 보안성 검토",
      "ISMS/ISO27001 인증 취득 지원 컨설팅 참여 (코웨이)",
      "참저축은행, 애큐온캐피탈, SBI저축은행, 현대자동차 HKMC 등 금융·제조 Web/App 모의해킹",
    ],
  },
];

const SKILLS: SkillCategory[] = [
  {
    title: "Offensive Security",
    badges: [
      { label: "Web/App Pentesting", src: "https://img.shields.io/badge/-Web%2FApp%20Pentesting-7f1d1d?logo=owasp&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "OT/ICS Pentesting", src: "https://img.shields.io/badge/-OT%2FICS%20Pentesting-991b1b?logo=siemens&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Red Team", src: "https://img.shields.io/badge/-Red%20Team-b91c1c?logo=hackthebox&logoColor=9FEF00&style=for-the-badge&labelColor=1f2937" },
      { label: "Exploit Development", src: "https://img.shields.io/badge/-Exploit%20Dev-7f1d1d?logo=gnubash&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Vulnerability Research", src: "https://img.shields.io/badge/-Vuln%20Research-c2410c?logo=bugcrowd&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Fuzzing", src: "https://img.shields.io/badge/-Fuzzing-9a3412?logo=gnubash&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Reverse Engineering", src: "https://img.shields.io/badge/-Reverse%20Engineering-4c1d95?logo=intel&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Threat Modeling", src: "https://img.shields.io/badge/-Threat%20Modeling-d97706?logo=securityscorecard&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
    ],
  },
  {
    title: "Standards & Compliance",
    badges: [
      { label: "IEC 62443-4-2", src: "https://img.shields.io/badge/-IEC%2062443--4--2-0f766e?logo=iec&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "FDA 510(k)", src: "https://img.shields.io/badge/-FDA%20510(k)-0369a1?logo=fda&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Achilles Level 2", src: "https://img.shields.io/badge/-Achilles%20Level%202-155e75?logo=shield&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "ISO 27001", src: "https://img.shields.io/badge/-ISO%2027001-047857?logo=keybase&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "ISMS", src: "https://img.shields.io/badge/-ISMS-166534?logo=shield&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
    ],
  },
  {
    title: "AI Security Automation",
    badges: [
      { label: "MCP + A2A", src: "https://img.shields.io/badge/-MCP%20%2B%20A2A-5b21b6?logo=anthropic&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "n8n Orchestration", src: "https://img.shields.io/badge/-n8n%20Orchestration-b45309?logo=n8n&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "RAG / pgvector", src: "https://img.shields.io/badge/-RAG%20%2F%20pgvector-1e40af?logo=postgresql&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "LLM Integration", src: "https://img.shields.io/badge/-LLM%20Integration-7b2d8e?logo=openai&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
    ],
  },
  {
    title: "Tools",
    badges: [
      { label: "IDA Pro", src: "https://img.shields.io/badge/-IDA%20Pro-1c1917?logo=intel&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Burp Suite", src: "https://img.shields.io/badge/-Burp%20Suite-c2410c?logo=burpsuite&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Frida", src: "https://img.shields.io/badge/-Frida-14532d?logo=gnubash&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "CodeQL", src: "https://img.shields.io/badge/-CodeQL-0c4a6e?logo=github&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Ghidra", src: "https://img.shields.io/badge/-Ghidra-0e7490?logo=nsa&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Wireshark", src: "https://img.shields.io/badge/-Wireshark-1e40af?logo=wireshark&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Kali Linux", src: "https://img.shields.io/badge/-Kali%20Linux-557c3b?logo=kalilinux&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Docker", src: "https://img.shields.io/badge/-Docker-0284c7?logo=docker&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "Python", src: "https://img.shields.io/badge/-Python-1e3a5f?logo=python&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
      { label: "C / C++", src: "https://img.shields.io/badge/-C%20%2F%20C%2B%2B-0c4a6e?logo=c&logoColor=ffffff&style=for-the-badge&labelColor=1f2937" },
    ],
  },
];

const CERTIFICATIONS: CertCompanyGroup[] = [
  {
    company: "Best of the Best (BoB) 8기 — OS Kernel CVE 16건",
    logo: "/images/bob.png",
    certs: [
      { title: "CVE-2019-18885", src: "https://img.shields.io/badge/CVE--2019--18885-CVSS%205.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-18885" },
      { title: "CVE-2019-19036", src: "https://img.shields.io/badge/CVE--2019--19036-CVSS%205.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19036" },
      { title: "CVE-2019-19037", src: "https://img.shields.io/badge/CVE--2019--19037-CVSS%205.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19037" },
      { title: "CVE-2019-19039", src: "https://img.shields.io/badge/CVE--2019--19039-CVSS%205.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19039" },
      { title: "CVE-2019-19318", src: "https://img.shields.io/badge/CVE--2019--19318-CVSS%204.4%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19318" },
      { title: "CVE-2019-19319", src: "https://img.shields.io/badge/CVE--2019--19319-CVSS%206.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19319" },
      { title: "CVE-2019-19377", src: "https://img.shields.io/badge/CVE--2019--19377-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19377" },
      { title: "CVE-2019-19378", src: "https://img.shields.io/badge/CVE--2019--19378-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19378" },
      { title: "CVE-2019-19447", src: "https://img.shields.io/badge/CVE--2019--19447-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19447" },
      { title: "CVE-2019-19448", src: "https://img.shields.io/badge/CVE--2019--19448-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19448" },
      { title: "CVE-2019-19449", src: "https://img.shields.io/badge/CVE--2019--19449-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19449" },
      { title: "CVE-2019-19813", src: "https://img.shields.io/badge/CVE--2019--19813-CVSS%205.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19813" },
      { title: "CVE-2019-19814", src: "https://img.shields.io/badge/CVE--2019--19814-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19814" },
      { title: "CVE-2019-19815", src: "https://img.shields.io/badge/CVE--2019--19815-CVSS%205.5%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19815" },
      { title: "CVE-2019-19816", src: "https://img.shields.io/badge/CVE--2019--19816-CVSS%207.8%20HIGH-red?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19816" },
      { title: "CVE-2019-19927", src: "https://img.shields.io/badge/CVE--2019--19927-CVSS%206.0%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19927" },
    ],
  },
  {
    company: "한국정보통신자격협회 (KAIT)",
    logo: "",
    certs: [
      { title: "리눅스 마스터 2급", src: "" },
      { title: "네트워크 관리사 2급", src: "" },
    ],
  },
  {
    company: "개인 취약점 연구 — IoT CVE 5건",
    logo: "/images/cve.svg",
    certs: [
      { title: "CVE-2024-33788", src: "https://img.shields.io/badge/CVE--2024--33788-CVSS%208.0%20HIGH-red?style=for-the-badge", href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33788" },
      { title: "CVE-2024-33789", src: "https://img.shields.io/badge/CVE--2024--33789-CVE%20Pending-lightgrey?style=for-the-badge", href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33789" },
      { title: "CVE-2024-33791", src: "https://img.shields.io/badge/CVE--2024--33791-CVSS%204.6%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33791" },
      { title: "CVE-2024-33792", src: "https://img.shields.io/badge/CVE--2024--33792-CVSS%209.8%20CRITICAL-critical?style=for-the-badge", href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33792" },
      { title: "CVE-2024-33793", src: "https://img.shields.io/badge/CVE--2024--33793-CVSS%205.3%20MEDIUM-orange?style=for-the-badge", href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33793" },
    ],
  },
];

const EDUCATION: EducationRow[] = [
  {
    degree: "컴퓨터공학부 (Computer Science)",
    institution: "공주대학교 (Kongju National University)",
    location: "Chungnam, South Korea",
    logo: "/images/kongju.png",
    period: "2012.02 — 2020.02",
  },
  {
    degree: "정보처리과 (Information Processing)",
    institution: "천안상업고등학교",
    location: "Chungnam, South Korea",
    logo: "",
    period: "2009.03 — 2012.02",
  },
];

const PROJECTS: ProjectItem[] = [
  {
    title: "AI Orchestration Framework for Security",
    meta: "개인 연구 (2024 — Present)",
    bullets: [
      "IDA Pro·Burp Suite·Frida·CodeQL을 MCP+A2A 프로토콜로 연결한 AI 기반 보안 점검 자동화 프레임워크 설계·구현",
      "LLM이 도구 체인을 오케스트레이션해 Low~Medium 취약점 자동 식별 — 실 점검 대상 적용 검증",
      "n8n·pgvector·RAG 파이프라인으로 과거 취약점 패턴 학습 및 신규 점검에 재활용",
    ],
  },
  {
    title: "ELECCON (한국전력 사이버 공방 훈련)",
    meta: "운영 및 문제 개발 (2021 — 2024)",
    bullets: [
      "한국전력공사 주관 실전형 OT/ICS 사이버 공방 훈련 4년 연속 운영",
      "SCADA·PLC 환경 기반 공격 시나리오 설계, 방어팀 평가 지표 수립",
    ],
  },
  {
    title: "APEX CTF 2025 — DFIR 문제 개발",
    meta: "문제 출제 (2025.05 — 2025.09)",
    bullets: [
      "국내 CTF 대회 APEX CTF 2025 DFIR 카테고리 문제 개발 참여",
      "실제 침해사고 기반 포렌식 시나리오 설계 및 검증",
    ],
  },
  {
    title: "File System Fuzzer (BoB 8기 프로젝트)",
    meta: "구현 (2019)",
    bullets: [
      "커스텀 File System Fuzzer 설계·구현 → Linux Kernel OS CVE 16건 도출",
      "CodeBlue 2019 (Tokyo) · Hack In The Box 2019 (Amsterdam) 발표",
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
  {
    name: "CVE 21건 (OS Kernel 16 + IoT 5)",
    href: "https://www.cve.org/",
    badgeSrc: "https://img.shields.io/badge/CVE_21%EA%B1%B4-OS_Kernel_16_%2B_IoT_5-red?style=for-the-badge&logo=linux&logoColor=white",
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
  return (
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
                <ShieldCheck className="h-5 w-5 text-primary" />
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

              <div className="mt-1 flex items-center gap-1 text-sm text-primary">
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
          <p className="text-sm leading-relaxed text-muted-foreground">
            {ABOUT_TEXT}
          </p>
        </CardContent>
      </Card>

      {/* ── Experience ──────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionExperience")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {EXPERIENCE.map((exp, idx) => (
              <div key={`${exp.role}-${idx}`}>
                {idx > 0 && <Separator className="mb-6" />}
                <div className="flex gap-4">
                  <div className="shrink-0 pt-0.5">
                    {exp.logo ? (
                      <img
                        src={exp.logo}
                        alt=""
                        className="h-12 w-12 rounded-md border bg-background object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-lg font-bold text-muted-foreground">
                        {exp.company.trim().slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold">{exp.role}</h3>
                    <div className="text-sm text-foreground/80">
                      {exp.company}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {exp.dates}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {exp.location}
                    </div>
                    {exp.bullets.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Education ───────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionEducation")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EDUCATION.map((row) => (
              <div key={row.degree} className="flex gap-3 rounded-lg border bg-card p-4">
                <div className="shrink-0 pt-0.5">
                  {row.logo ? (
                    <img
                      src={row.logo}
                      alt=""
                      className="h-12 w-12 rounded-md border bg-background object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-lg font-bold text-muted-foreground">
                      🎓
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{row.degree}</div>
                  <div className="text-xs text-foreground/80">{row.institution}</div>
                  <div className="text-xs text-muted-foreground">{row.period}</div>
                  {row.location && (
                    <div className="text-xs text-muted-foreground">{row.location}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Licenses & Certifications ───────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionCertifications")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CertificationsSection groups={CERTIFICATIONS} />
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
                <div className="flex flex-wrap gap-2">
                  {cat.badges.map((b) => (
                    <div
                      key={b.src}
                      className="rounded-full border bg-muted/20 px-3 py-1.5"
                      title={b.label}
                    >
                      <img
                        src={b.src}
                        alt={b.label}
                        className="h-6 object-contain"
                        loading="lazy"
                      />
                    </div>
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
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
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

      {/* ── Projects ────────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">{t("sectionProjects")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {PROJECTS.map((p, idx) => (
              <div key={p.title}>
                {idx > 0 && <Separator className="mb-6" />}
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-muted text-lg font-bold text-muted-foreground">
                    📦
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold">{p.title}</div>
                    {p.meta && (
                      <div className="text-sm text-muted-foreground">
                        {p.meta}
                      </div>
                    )}
                    {p.bullets.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {p.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
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
  );
}
