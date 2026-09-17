"use client";

import { useEffect } from "react";
import { routing } from "@/i18n/routing";

export default function RootRedirect() {
  useEffect(() => {
    const { locales, defaultLocale } = routing;
    const stored = typeof window !== "undefined" ? localStorage.getItem("preferred-locale") : null;
    const candidate =
      stored && (locales as readonly string[]).includes(stored)
        ? stored
        : (() => {
            const nav = (navigator.language || "").toLowerCase();
            const exact = (locales as readonly string[]).find((l) => nav === l);
            if (exact) return exact;
            const byPrefix = (locales as readonly string[]).find(
              (l) => nav.startsWith(l) || nav.startsWith(l.split("-")[0]),
            );
            return byPrefix ?? defaultLocale;
          })();
    window.location.replace(`/${candidate}/`);
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
