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

/*
 * 이 그리드에는 대표가 아닌 프로젝트만 들어온다(대표 프로젝트는 위 "주요 프로젝트" 섹션이 상세히 보여 준다).
 * 화면에서는 제목·고객사·기간·역할·성과 한 줄까지만 읽게 하고, 배경·수행·나머지 성과·기술스택은 인쇄에서만 펼친다.
 * 예전에는 상세 여부를 actions.length > 0 으로 정해서, 데이터에 수행 내용이 붙은 22개 중 18개가 화면에서 전부 펼쳐졌다
 * (src/data/portfolio.ts 는 "나머지는 간략" 이라고 선언해 두었는데 코드가 데이터 모양을 보고 있었다).
 * 그 결과 이 섹션 하나가 페이지 글자의 48%(7,004자)를 차지했다. 완전한 기록은 맨 위에서 내려받는 경력기술서 PDF 에 있다.
 */
function ProjectCard({
  project,
  actionsLabel,
  resultsLabel,
  className,
}: { project: ProjectView; className?: string } & CardLabels) {
  const [firstResult, ...restResults] = project.results;
  return (
    <Card className={cn("break-inside-avoid", className)}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-subheading font-semibold leading-snug">{project.title}</h3>
          {project.contributionLabel && (
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {project.contributionLabel}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-muted-foreground">
          <span className="font-medium text-foreground/70" data-notranslate>
            {project.client}
          </span>
          <span className="tabular-nums" data-notranslate>
            {project.period}
          </span>
          <span>{project.role}</span>
        </div>

        {firstResult && <p className="text-body-sm text-muted-foreground">{firstResult}</p>}

        {/* 인쇄용 상세. 화면에서는 위의 성과 한 줄까지만 읽게 한다. */}
        <div className="hidden space-y-2 print:block">
          {project.background && (
            <p className="text-body-sm text-muted-foreground">{project.background}</p>
          )}

          {project.actions.length > 0 && (
            <div>
              <div className="text-meta font-semibold text-foreground/80">{actionsLabel}</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-body-sm text-muted-foreground">
                {project.actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {restResults.length > 0 && (
            <div>
              <div className="text-meta font-semibold text-foreground/80">{resultsLabel}</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-body-sm text-muted-foreground">
                {restResults.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {project.stack && project.stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1" data-notranslate>
              {project.stack.map((s) => (
                <Badge key={s} variant="secondary" className="text-label">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
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
            className={cn("h-8 gap-1.5 text-meta", filter === f.key && "font-semibold")}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-label tabular-nums",
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

      {/* 카드는 한 번만 그린다. 화면에서는 필터에 맞지 않는 카드를 가리고, 인쇄에서는 전부 보인다(1열). */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 print:grid-cols-1">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            actionsLabel={actionsLabel}
            resultsLabel={resultsLabel}
            className={filter === "all" || p.category === filter ? undefined : "hidden print:flex"}
          />
        ))}
      </div>
    </div>
  );
}
