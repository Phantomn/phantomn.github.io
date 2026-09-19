export type ExperienceItem = {
  role: string;
  company: string;
  logo: string | null;
  location: string;
  dates: string;
  bullets: string[];
};

export type SkillCategory = {
  title: string;
  items: string[];
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
