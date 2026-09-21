import data from "./competitions.json";

/**
 * 대회·훈련 기록의 단일 원본 (competitions.json).
 * JSON 에는 로케일과 무관한 값(순위, 팀 수, 역할·팀 키)만 둔다. 문장은 messages 의 "records" 네임스페이스가 만든다 -
 * 한국어 문장을 데이터에 두면 런타임 기계 번역에 맡겨야 하고, 고유명사("Locked Shields")와 숫자가 번역 중에 깨진다.
 * 순위는 종합 -> 부문 순서, 종합에는 참가 팀 수(of)를 붙인다.
 * scripts/check-records.mjs 가 이 파일과 이력서 yaml 의 표기를 대조한다.
 */
export interface Competition {
  id: string;
  /** 고유명사. 번역하지 않는다. */
  name: string;
  /** 주관 기관 키. messages records.hosts.* */
  host?: string;
  year: number | string;
  /** 팀 키. messages records.teams.* */
  team?: string;
  /** 역할 키. messages records.roles.* */
  roles: string[];
  overall?: { rank: number; of: number };
  tracks?: { name: string; rank: number }[];
}

/** messages 의 "records" 네임스페이스 번역 함수 (next-intl getTranslations). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export const COMPETITIONS: Competition[] = data;

export function getCompetition(id: string): Competition {
  const found = COMPETITIONS.find((c) => c.id === id);
  if (!found) throw new Error(`unknown competition: ${id}`);
  return found;
}

/** "ELECCON" -> ko "한국전력 ELECCON", en "KEPCO ELECCON" */
function eventName(c: Competition, t: Translate): string {
  return c.host ? `${t(`hosts.${c.host}`)} ${c.name}` : c.name;
}

/** ko "종합 6위(17팀 중) · DFIR 1위" - 순위가 없으면 빈 문자열 */
export function formatResult(c: Competition, t: Translate): string {
  const parts: string[] = [];
  if (c.overall) parts.push(t("overall", { rank: c.overall.rank, of: c.overall.of }));
  for (const track of c.tracks ?? []) parts.push(t("track", { name: track.name, rank: track.rank }));
  return parts.join(" · ");
}

function rolesOf(c: Competition, t: Translate): string {
  return c.roles.map((r) => t(`roles.${r}`)).join(", ");
}

/** 연도 뒤에 붙는 설명. 예: " (한국-캐나다 연합, DFIR 블루팀): 종합 6위(17팀 중) · DFIR 1위" 또는 ": Green Team" */
function detailOf(c: Competition, t: Translate): string {
  const result = formatResult(c, t);
  if (!result) return `: ${rolesOf(c, t)}`;
  const who = [c.team && t(`teams.${c.team}`), rolesOf(c, t)].filter(Boolean).join(", ");
  return ` (${who}): ${result}`;
}

/** 한 회차: label 은 "Locked Shields 2025". 포트폴리오처럼 회차 단위로 쓰는 곳용. */
export function describeCompetition(c: Competition, t: Translate): { label: string; detail: string } {
  return { label: `${eventName(c, t)} ${c.year}`, detail: detailOf(c, t) };
}

/**
 * 같은 대회의 회차를 한 줄로 묶는다. 대회 순서는 JSON 순서, 회차는 오래된 순, 역할·결과가 같은 회차는 연도를 합친다.
 * 예(ko): "2025 - DFIR 블루팀 (한국-캐나다 연합): 종합 6위(17팀 중) · DFIR 1위 / 2026 - Special System 블루팀 (한국-헝가리 연합): 종합 9위(16팀 중)"
 * 소개 페이지의 대회 목록용.
 */
export function describeEvents(t: Translate): { name: string; editions: string[] }[] {
  const events = new Map<string, Competition[]>();
  for (const c of COMPETITIONS) events.set(c.name, [...(events.get(c.name) ?? []), c]);
  return [...events.values()].map((list) => {
    const byText = new Map<string, (number | string)[]>();
    for (const c of [...list].sort((a, b) => String(a.year).localeCompare(String(b.year)))) {
      const result = formatResult(c, t);
      const team = c.team ? ` (${t(`teams.${c.team}`)})` : "";
      const text = `${rolesOf(c, t)}${team}${result ? `: ${result}` : ""}`;
      byText.set(text, [...(byText.get(text) ?? []), c.year]);
    }
    return {
      name: eventName(list[0], t),
      editions: [...byText.entries()].map(([text, years]) => `${years.join(", ")} - ${text}`),
    };
  });
}
