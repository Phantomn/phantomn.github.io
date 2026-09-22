import type { ReactNode } from "react";

/**
 * 페이지 머리. 사이트의 모든 페이지 종류가 같은 짜임새를 쓰게 하려고 뺐다.
 * 이전에는 페이지마다 h1 과 머리말을 따로 짜서 h2 가 24/30/16px 로, h3 가 16/20/24px 로 갈렸다.
 *
 * 구성은 CVE 목록 페이지가 이미 쓰던 방식(강조선 + 모노 대문자 라벨 + 숫자 카운터)을 사이트 전체로 넓힌 것이다.
 * 순서: 머리말(eyebrow) -> 제목 -> 리드 문단 -> 숫자. 읽는 사람이 "누구/무엇을/얼마나" 를 차례로 보게 된다.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-b pb-8">
      {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
      <div className="flex items-start gap-4">
        <span aria-hidden className="mt-[0.15em] h-[1.05em] w-1 shrink-0 rounded-sm bg-primary" />
        <h1 className="text-balance font-heading text-title font-bold tracking-tight">{title}</h1>
      </div>
      {lead && <p className="mt-5 max-w-[44rem] text-body text-muted-foreground">{lead}</p>}
      {children}
    </header>
  );
}

/** 숫자 줄. 값은 늘 단일 원본(데이터 파일)에서 받아 온다 - 화면에 숫자를 적지 않는다. */
export function StatRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col-reverse gap-1">
          <dt className="eyebrow">{s.label}</dt>
          <dd className="font-heading text-heading font-bold tabular-nums" data-notranslate>
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
