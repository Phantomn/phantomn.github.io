"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import US from "country-flag-icons/react/3x2/US";
import BR from "country-flag-icons/react/3x2/BR";
import ES from "country-flag-icons/react/3x2/ES";
import KR from "country-flag-icons/react/3x2/KR";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";

const FLAGS = {
  en: US,
  ko: KR,
  "pt-br": BR,
  es: ES,
} as const;

const LABELS = {
  en: "EN",
  ko: "KR",
  "pt-br": "BR",
  es: "ES",
} as const;

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("nav");

  const switchTo = (next: string) => {
    if (next === locale) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("preferred-locale", next);
    }
    const segments = pathname.split("/");
    if ((routing.locales as readonly string[]).includes(segments[1] ?? "")) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }
    router.push(segments.join("/") || `/${next}/`);
  };

  const Current = FLAGS[locale as keyof typeof FLAGS] ?? US;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("language")}
          className="gap-2 px-2"
        >
          <Current className="h-4 w-6 rounded-sm" />
          <span className="text-xs font-semibold">
            {LABELS[locale as keyof typeof LABELS] ?? locale.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {routing.locales.map((l) => {
          const Flag = FLAGS[l];
          return (
            <DropdownMenuItem
              key={l}
              onSelect={() => switchTo(l)}
              className="gap-2"
              data-active={l === locale}
            >
              <Flag className="h-4 w-6 rounded-sm" />
              <span className="text-sm">{LABELS[l]}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
