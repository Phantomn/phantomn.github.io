"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { icons } from "@/lib/icons";

interface SearchEntry {
  type: "blog" | "cve" | "writeup";
  title: string;
  description: string;
  tags: string[];
  date: string;
  href: string;
}

const TYPE_LABEL: Record<SearchEntry["type"], string> = {
  blog: "Research",
  cve: "CVE",
  writeup: "Writeup",
};

function score(entry: SearchEntry, query: string): number {
  const q = query.toLowerCase();
  let s = 0;
  if (entry.tags.some((t) => t.toLowerCase() === q)) s += 10;
  if (entry.title.toLowerCase().includes(q)) s += 5;
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) s += 3;
  if (entry.description.toLowerCase().includes(q)) s += 1;
  return s;
}

export function GlobalSearch() {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[]>([]);

  useEffect(() => {
    if (!open || entries.length > 0) return;
    fetch("/search-index.json")
      .then((res) => res.json())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [open, entries.length]);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return entries
      .map((entry) => ({ entry, s: score(entry, query.trim()) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.entry);
  }, [entries, query]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("open")}>
          <FontAwesomeIcon icon={icons.magnifyingGlass} className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96">
        <SheetHeader>
          <SheetTitle className="font-heading">{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 pt-4">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
          />
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {results.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col gap-0.5 rounded-md border border-border p-3 hover:border-primary"
                >
                  <span className="text-xs uppercase text-muted-foreground">
                    {TYPE_LABEL[entry.type]}
                  </span>
                  <span className="font-medium">{entry.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
