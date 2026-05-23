"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { icons } from "@/lib/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const NAV_KEYS = ["home", "about", "blog", "writeups", "toolbox"] as const;
type NavKey = (typeof NAV_KEYS)[number];

const NAV_PATHS: Record<NavKey, string> = {
  home: "",
  about: "about/",
  blog: "blog/",
  writeups: "writeups/",
  toolbox: "toolbox/",
};

function NavLink({
  href,
  label,
  isActive,
  onClick,
  className,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "font-medium",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      asChild
      onClick={onClick}
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV_KEYS.map((key) => ({
    key,
    href: `/${locale}/${NAV_PATHS[key]}`,
    label: t(key),
  }));

  const isActive = (href: string) => {
    const home = `/${locale}/`;
    if (href === home) return pathname === home || pathname === `/${locale}`;
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-[90vw] max-w-none items-center justify-between px-4">
        <Button variant="ghost" size="sm" className="font-heading text-lg font-bold tracking-tight text-primary px-2 gap-2" asChild>
          <Link href={`/${locale}/`} className="flex items-center gap-2">
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border-[3px] border-muted-foreground bg-muted dark:border-primary">
              <Image
                src="https://res.cloudinary.com/a88188f90768a608fc75048188ef19e7/image/upload/q_auto/f_auto/v1776380690/Website/Logos/logo_bzdu8d.svg"
                alt=""
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </span>
            <span>phantomn</span>
          </Link>
        </Button>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map(({ key, label, href }) => (
            <NavLink
              key={key}
              href={href}
              label={label}
              isActive={isActive(href)}
            />
          ))}
          <Separator orientation="vertical" className="h-5 mx-1" />
          <LanguageSwitcher />
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("toggleMenu")}
              >
                <FontAwesomeIcon icon={icons.bars} className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="font-heading">{t("menu")}</SheetTitle>
              </SheetHeader>
              <Separator />
              <nav className="flex flex-col gap-1 pt-4">
                {items.map(({ key, label, href }) => (
                  <NavLink
                    key={key}
                    href={href}
                    label={label}
                    isActive={isActive(href)}
                    onClick={() => setMobileOpen(false)}
                    className="justify-start w-full"
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
