"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/* ── Public types ─────────────────────────────────────────────── */

export interface WriteupEntry {
  slug: string;
  name: string;
  source: string;
  sourceKey: string;
  category: string;
  categoryKey: string;
  difficulty: string;
  tags: string[];
  date: string;
  href: string;
}

/* ── Sorting ──────────────────────────────────────────────────── */

type SortField = "name" | "source" | "category" | "difficulty" | "date";
type SortDir = "asc" | "desc";

const DIFFICULTY_ORDER: Record<string, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Insane: 4,
};

/* ── Badge colour maps ────────────────────────────────────────── */

const SOURCE_STYLES: Record<string, string> = {
  htb: "border-green-600/40 bg-green-500/10 text-green-700 dark:border-green-500/40 dark:text-green-400",
  thm: "border-red-600/40 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400",
  vulnhub: "border-sky-600/40 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:text-sky-400",
  cyberdefenders:
    "border-cyan-600/40 bg-cyan-500/10 text-cyan-700 dark:border-cyan-500/40 dark:text-cyan-400",
  letsdefend:
    "border-indigo-600/40 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/40 dark:text-indigo-400",
  portswigger:
    "border-orange-600/40 bg-orange-500/10 text-orange-700 dark:border-orange-500/40 dark:text-orange-400",
  ctf: "border-violet-600/40 bg-violet-500/10 text-violet-700 dark:border-violet-500/40 dark:text-violet-400",
  wargame:
    "border-teal-600/40 bg-teal-500/10 text-teal-700 dark:border-teal-500/40 dark:text-teal-400",
};

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: "border-green-600/40 bg-green-500/10 text-green-700 dark:border-green-500/40 dark:text-green-400",
  Medium:
    "border-yellow-600/40 bg-yellow-500/10 text-yellow-700 dark:border-yellow-500/40 dark:text-yellow-400",
  Hard: "border-orange-600/40 bg-orange-500/10 text-orange-700 dark:border-orange-500/40 dark:text-orange-400",
  Insane:
    "border-red-600/40 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400",
};

const CATEGORY_STYLES: Record<string, string> = {
  blueteam:
    "border-blue-600/40 bg-blue-500/10 text-blue-700 dark:border-blue-500/40 dark:text-blue-400",
  redteam:
    "border-red-600/40 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400",
  web: "border-purple-600/40 bg-purple-500/10 text-purple-700 dark:border-purple-500/40 dark:text-purple-400",
  pwn: "border-rose-600/40 bg-rose-500/10 text-rose-700 dark:border-rose-500/40 dark:text-rose-400",
  reversing:
    "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400",
  misc: "border-slate-600/40 bg-slate-500/10 text-slate-700 dark:border-slate-500/40 dark:text-slate-400",
};

/* ── Sort indicator ───────────────────────────────────────────── */

function SortIndicator({
  field,
  current,
  dir,
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
}) {
  const active = field === current;
  return (
    <span className="ml-1 inline-flex flex-col leading-[0.55]">
      <span
        className={cn(
          "text-[10px]",
          active && dir === "asc"
            ? "text-primary"
            : "text-muted-foreground/30"
        )}
      >
        ▲
      </span>
      <span
        className={cn(
          "text-[10px]",
          active && dir === "desc"
            ? "text-primary"
            : "text-muted-foreground/30"
        )}
      >
        ▼
      </span>
    </span>
  );
}

/* ── Main component ───────────────────────────────────────────── */

export function WriteupDataGrid({
  writeups,
}: {
  writeups: WriteupEntry[];
}) {
  const router = useRouter();
  const t = useTranslations("writeups");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* Toggle or change sort column */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  /* Filtered + sorted rows */
  const rows = useMemo(() => {
    let items = [...writeups];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.category.toLowerCase().includes(q) ||
          w.difficulty.toLowerCase().includes(q) ||
          w.source.toLowerCase().includes(q) ||
          w.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "source":
          cmp = a.source.localeCompare(b.source);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "difficulty":
          cmp =
            (DIFFICULTY_ORDER[a.difficulty] ?? 99) -
            (DIFFICULTY_ORDER[b.difficulty] ?? 99);
          break;
        case "date":
          cmp =
            new Date(a.date || 0).getTime() -
            new Date(b.date || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [writeups, search, sortField, sortDir]);

  /* Sortable header cell */
  const Th = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={cn(
        "cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-foreground",
        className
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        <SortIndicator field={field} current={sortField} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* ── Search + stats bar ────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("foundCount", { count: rows.length })}</span>
        </div>
      </div>

      {/* ── Data grid ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            {/* Header */}
            <thead>
              <tr className="border-b border-border bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Th field="source">Source</Th>
                <Th field="name" className="min-w-[180px]">
                  Name
                </Th>
                <Th field="category">Category</Th>
                <Th field="difficulty">Difficulty</Th>
                <th className="px-4 py-3 text-left">Tags</th>
                <Th field="date">Date</Th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 opacity-40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-base font-medium">
                        {t("notFound")}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((w, i) => (
                  <tr
                    key={w.href}
                    onClick={() => router.push(w.href)}
                    className={cn(
                      "group cursor-pointer border-b border-border/30 transition-all hover:bg-primary/5 dark:hover:bg-primary/[0.03]",
                      i % 2 === 0
                        ? "bg-card"
                        : "bg-muted/20 dark:bg-muted/10"
                    )}
                  >
                    {/* Source */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-medium whitespace-nowrap",
                          SOURCE_STYLES[w.sourceKey]
                        )}
                      >
                        {w.source}
                      </Badge>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-foreground group-hover:text-primary transition-colors">
                      {w.name}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-medium whitespace-nowrap",
                          CATEGORY_STYLES[w.categoryKey]
                        )}
                      >
                        {w.category}
                      </Badge>
                    </td>

                    {/* Difficulty */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-medium whitespace-nowrap",
                          DIFFICULTY_STYLES[w.difficulty]
                        )}
                      >
                        {w.difficulty}
                      </Badge>
                    </td>

                    {/* Tags */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[10px] border-border/60 text-muted-foreground font-normal"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {w.tags.length > 3 && (
                          <span className="self-center text-[10px] text-muted-foreground/60">
                            +{w.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {w.date
                        ? formatDate(w.date, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "\u2014"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
