#!/usr/bin/env node
// 메시지 키 패리티 검사. en(저작 소스, i18n/routing.ts 의 SOURCE_LOCALE)을 기준으로 ko(DynamicTranslator 산출)가 같은 키를 갖는지 대조한다.
//  1) 키 누락/초과  2) 빈 문자열  3) 치환 자리표시자({name})와 리치 태그(<link>) 집합 불일치
// 위반이 있으면 종료 코드 1. 실행: pnpm check:i18n
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const BASE = "en";
const OTHERS = ["ko"];

const load = (l) => JSON.parse(readFileSync(join(root, "messages", `${l}.json`), "utf8"));
function flat(o, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object") flat(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = v;
  }
  return out;
}
const tokens = (s) =>
  typeof s === "string" ? [...new Set([...s.matchAll(/\{(\w+)|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`))].sort().join(",") : "";

const base = flat(load(BASE));
const problems = [];
for (const l of OTHERS) {
  const cur = flat(load(l));
  for (const k of Object.keys(base)) {
    if (!(k in cur)) problems.push(`${l}: 누락 ${k}`);
    // en(기준)도 비어 있으면 의도적으로 빈 값인 필드(예: hero.summary)이므로 통과.
    else if (cur[k] === "" && base[k] !== "") problems.push(`${l}: 빈 문자열 ${k}`);
    else if (tokens(cur[k]) !== tokens(base[k])) problems.push(`${l}: 자리표시자 불일치 ${k} (en=[${tokens(base[k])}] ${l}=[${tokens(cur[k])}])`);
  }
  for (const k of Object.keys(cur)) if (!(k in base)) problems.push(`${l}: en에 없는 키 ${k}`);
}

if (problems.length) {
  console.error(`check-i18n: ${problems.length}건\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`check-i18n: OK (메시지 ${Object.keys(base).length}개 키, ${OTHERS.length}개 로케일)`);
