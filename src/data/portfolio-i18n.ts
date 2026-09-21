import ko from "./portfolio-text/ko.json";
import en from "./portfolio-text/en.json";
import es from "./portfolio-text/es.json";
import ptBr from "./portfolio-text/pt-br.json";
import { describeCompetition, getCompetition, type Translate } from "./competitions";
import {
  PORTFOLIO_PROJECTS,
  type LocalizedProject,
  type PortfolioProjectText,
} from "./portfolio";

const TEXTS: Record<string, Record<string, PortfolioProjectText>> = {
  ko,
  en,
  es,
  "pt-br": ptBr,
};

/** `{ls2025}` -> "Locked Shields 2025 (한국-캐나다 연합, DFIR 블루팀): 종합 6위(17팀 중) · DFIR 1위" (순위는 competitions.json 에서만 만든다) */
function expand(text: string, tr: Translate): string {
  return text.replace(/\{(\w+)\}/g, (_, id: string) => {
    const { label, detail } = describeCompetition(getCompetition(id), tr);
    return `${label}${detail}`;
  });
}

/** 서버 컴포넌트 전용 - 4개 로케일 JSON 을 모두 번들에 넣으므로 클라이언트 컴포넌트에서 import 하지 않는다. */
export function getLocalizedProjects(locale: string, tr: Translate): LocalizedProject[] {
  const texts = TEXTS[locale] ?? TEXTS.ko;
  return PORTFOLIO_PROJECTS.map((p) => {
    const t = texts[p.id];
    if (!t) throw new Error(`portfolio text missing: ${locale}/${p.id}`);
    return { ...p, ...t, results: t.results.map((r) => expand(r, tr)) };
  });
}
