"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocalizedProject, PortfolioCategoryKey } from "@/data/portfolio";

type FilterKey = "all" | PortfolioCategoryKey;

/** 서버 페이지가 로케일별 문구를 채워 넘긴다. 이 컴포넌트는 데이터를 직접 import 하지 않는다. */
type ProjectView = LocalizedProject & { contributionLabel: string };

interface Props {
  projects: ProjectView[];
  categories: { key: PortfolioCategoryKey; label: string; count: number }[];
  allLabel: string;
  actionsLabel: string;
  resultsLabel: string;
}

type CardLabels = Pick<Props, "actionsLabel" | "resultsLabel">;

function ProjectCard({ project, actionsLabel, resultsLabel }: { project: ProjectView } & CardLabels) {
  const detailed = project.actions.length > 0;
  return (
    <Card className="break-inside-avoid">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold leading-snug">{project.title}</h3>
          {project.contributionLabel && (
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {project.contributionLabel}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70" data-notranslate>
            {project.client}
          </span>
          <span className="tabular-nums" data-notranslate>
            {project.period}
          </span>
          <span>{project.role}</span>
        </div>

        {project.background && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {project.background}
          </p>
        )}

        {detailed && (
          <div>
            <div className="text-xs font-semibold text-foreground/80">{actionsLabel}</div>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {project.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {project.results.length > 0 && (
          <div>
            {detailed && (
              <div className="text-xs font-semibold text-foreground/80">{resultsLabel}</div>
            )}
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {project.results.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {project.stack && project.stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1" data-notranslate>
            {project.stack.map((s) => (
              <Badge key={s} variant="secondary" className="text-[11px]">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortfolioProjects({
  projects,
  categories,
  allLabel,
  actionsLabel,
  resultsLabel,
}: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filters: { key: FilterKey; label: string; count: number }[] = useMemo(
    () => [
      { key: "all", label: allLabel, count: projects.length },
      ...categories.map((c) => ({ key: c.key as FilterKey, label: c.label, count: c.count })),
    ],
    [allLabel, categories, projects.length],
  );

  const visible = useMemo(
    () =>
      filter === "all" ? projects : projects.filter((p) => p.category === filter),
    [filter, projects],
  );

  return (
    <div className="space-y-4">
      {/* 필터 — 인쇄 시 숨김 */}
      <div className="flex flex-wrap gap-2 print:hidden" data-notranslate>
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
            className={cn("h-8 gap-1.5 text-xs", filter === f.key && "font-semibold")}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                filter === f.key
                  ? "bg-primary-foreground/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {f.count}
            </span>
          </Button>
        ))}
      </div>

      {/* 인쇄 시에는 항상 전체 노출 */}
      <div className="hidden print:block">
        <div className="grid grid-cols-1 gap-3">
          {projects.map((p) => (
            <ProjectCard
              key={`print-${p.id}`}
              project={p}
              actionsLabel={actionsLabel}
              resultsLabel={resultsLabel}
            />
          ))}
        </div>
      </div>

      {/* 화면용 — 필터 적용 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:hidden">
        {visible.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            actionsLabel={actionsLabel}
            resultsLabel={resultsLabel}
          />
        ))}
      </div>
    </div>
  );
}
