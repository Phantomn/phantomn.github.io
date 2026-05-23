export type CertItem = {
  title: string;
  src: string;
  href?: string;
};

export type CertCompanyGroup = {
  company: string;
  logo?: string;
  certs: CertItem[];
};

export type ExperienceItem = {
  role: string;
  company: string;
  logo: string | null;
  location: string;
  dates: string;
  bullets: string[];
};

export type SkillBadge = {
  label: string;
  src: string;
};

export type SkillCategory = {
  title: string;
  badges: SkillBadge[];
};

export type EducationRow = {
  degree: string;
  institution: string;
  location: string;
  logo: string | null;
  period: string;
};

export type ProjectItem = {
  title: string;
  meta: string;
  bullets: string[];
};

export type AchievementItem = {
  name: string;
  href: string;
  badgeSrc?: string;
};

export type LanguageItem = {
  flag: string;
  name: string;
  level: string;
};

export type ResumeLink = {
  label: string;
  href: string;
  flag: string;
};
