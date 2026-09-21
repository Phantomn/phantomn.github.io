import data from "./competitions.json";

/**
 * 대회·훈련 기록의 단일 원본 (competitions.json).
 * 소개·포트폴리오의 순위 문구는 모두 여기서 만든다 - 같은 순위를 문자열로 여러 곳에 적으면 어긋난다.
 * 순위는 종합 -> 부문 순서, 종합에는 참가 팀 수(of)를 붙인다.
 * scripts/check-records.mjs 가 이 파일과 이력서 yaml 의 표기를 대조한다.
 */
export interface Competition {
  id: string;
  name: string;
  year: number | string;
  team?: string;
  roles: string[];
  overall?: { rank: number; of: number };
  tracks?: { name: string; rank: number }[];
}

export const COMPETITIONS: Competition[] = data;

export function getCompetition(id: string): Competition {
  const found = COMPETITIONS.find((c) => c.id === id);
  if (!found) throw new Error(`unknown competition: ${id}`);
  return found;
}

/** "종합 6위(17팀 중) · DFIR 1위" - 순위가 없으면 빈 문자열 */
export function formatResult(c: Competition): string {
  const parts: string[] = [];
  if (c.overall) parts.push(`종합 ${c.overall.rank}위(${c.overall.of}팀 중)`);
  for (const t of c.tracks ?? []) parts.push(`${t.name} ${t.rank}위`);
  return parts.join(" · ");
}

/** 연도 뒤에 붙는 설명. 예: " (한국-캐나다 연합, DFIR 블루팀): 종합 6위(17팀 중) · DFIR 1위" 또는 ": Green Team" */
function detailOf(c: Competition): string {
  const result = formatResult(c);
  if (!result) return `: ${c.roles.join(", ")}`;
  const who = [c.team, ...c.roles].filter(Boolean).join(", ");
  return ` (${who}): ${result}`;
}

/** 한 회차: label 은 "Locked Shields 2025". 포트폴리오처럼 회차 단위로 쓰는 곳용. */
export function describeCompetition(c: Competition): { label: string; detail: string } {
  return { label: `${c.name} ${c.year}`, detail: detailOf(c) };
}

/**
 * 같은 대회의 회차를 한 줄로 묶는다. 대회 순서는 JSON 순서, 회차는 오래된 순, 역할·결과가 같은 회차는 연도를 합친다.
 * 예: "2025 - DFIR 블루팀 (한국-캐나다 연합): 종합 6위(17팀 중) · DFIR 1위 / 2026 - Special System 블루팀 (한국-헝가리 연합): 종합 9위(16팀 중)"
 * 소개 페이지의 대회 목록용.
 */
export function describeEvents(): { name: string; editions: string[] }[] {
  const events = new Map<string, Competition[]>();
  for (const c of COMPETITIONS) events.set(c.name, [...(events.get(c.name) ?? []), c]);
  return [...events.entries()].map(([name, list]) => {
    const byText = new Map<string, (number | string)[]>();
    for (const c of [...list].sort((a, b) => String(a.year).localeCompare(String(b.year)))) {
      const result = formatResult(c);
      const text = `${c.roles.join(", ")}${c.team ? ` (${c.team})` : ""}${result ? `: ${result}` : ""}`;
      byText.set(text, [...(byText.get(text) ?? []), c.year]);
    }
    return { name, editions: [...byText.entries()].map(([text, years]) => `${years.join(", ")} - ${text}`) };
  });
}
