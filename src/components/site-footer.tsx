"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { icons } from "@/lib/icons";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * Social links shown in the footer.
 * @property icon - Font Awesome icon definition (from @/lib/icons).
 * @property href  - External URL (opens in new tab).
 * @property label - Accessible name and tooltip text.
 */
const SOCIAL: Array<{
  icon: IconDefinition;
  href: string;
  label: string;
}> = [
  { icon: icons.github, href: "https://github.com/phantomn", label: "GitHub" },
  {
    icon: icons.linkedin,
    href: "https://www.linkedin.com/in/ph4nt0m/",
    label: "LinkedIn",
  },
  { icon: icons.xTwitter, href: "https://x.com/ph4nt0m", label: "X" },
];

/**
 * Site footer with copyright and social links.
 * Uses Font Awesome (brands) for icons, shadcn Button and Tooltip.
 * Social links open in a new tab with `rel="noopener noreferrer"`.
 * Depends on TooltipProvider in the root layout.
 */
export function SiteFooter() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("footer");
  const isHome =
    pathname === `/${locale}` ||
    pathname === `/${locale}/` ||
    pathname === "/" ||
    (routing.locales as readonly string[]).some((l) => pathname === `/${l}/`);

  return (
    <footer className="border-t border-border bg-background">
      <div
        className={`mx-auto flex flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between ${
          isHome ? "max-w-6xl" : "w-[90vw] max-w-none"
        }`}
      >
        <p className="text-sm text-muted-foreground">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
        <nav
          className="flex items-center gap-1"
          aria-label="Social links"
        >
          {SOCIAL.map(({ icon, href, label }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                  >
                    <FontAwesomeIcon icon={icon} className="h-5 w-5" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </div>
    </footer>
  );
}
