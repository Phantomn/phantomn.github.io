#!/usr/bin/env node
// 메시지 키 패리티 검사. ko(기본 로케일)를 기준으로 en/es/pt-br 가 같은 키를 갖는지 대조한다.
//  1) 키 누락/초과  2) 빈 문자열  3) 치환 자리표시자({name})와 리치 태그(<link>) 집합 불일치
// 위반이 있으면 종료 코드 1. 실행: pnpm check:i18n
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const BASE = "ko";
const OTHERS = ["en", "es", "pt-br"];

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
    else if (cur[k] === "") problems.push(`${l}: 빈 문자열 ${k}`);
    else if (tokens(cur[k]) !== tokens(base[k])) problems.push(`${l}: 자리표시자 불일치 ${k} (ko=[${tokens(base[k])}] ${l}=[${tokens(cur[k])}])`);
  }
  for (const k of Object.keys(cur)) if (!(k in base)) problems.push(`${l}: ko에 없는 키 ${k}`);
}

if (problems.length) {
  console.error(`check-i18n: ${problems.length}건\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`check-i18n: OK (${Object.keys(base).length}개 키, ${OTHERS.length}개 로케일)`);
