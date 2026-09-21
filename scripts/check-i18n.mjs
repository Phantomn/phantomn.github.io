#!/usr/bin/env node
// 메시지 키 패리티 검사. ko(기본 로케일)를 기준으로 en/es/pt-br 가 같은 키를 갖는지 대조한다.
//  1) 키 누락/초과  2) 빈 문자열  3) 치환 자리표시자({name})와 리치 태그(<link>) 집합 불일치
//  4) src/data/portfolio-text/<locale>.json 이 ko 와 같은 id·키·배열 길이를 갖고, 문자열마다 숫자와 {자리표시자}가 같고 한글이 없는지
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

// 포트폴리오 서술(프로젝트별). ko 가 기준이다. 번역은 사실을 바꾸지 않아야 하므로 숫자와 자리표시자는 그대로여야 한다.
const digits = (s) => (s.match(/\d+/g) ?? []).sort().join(",");
const holders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
function compare(base, cur, path, l) {
  if (Array.isArray(base)) {
    if (!Array.isArray(cur) || cur.length !== base.length) return problems.push(`${l}: ${path} 배열 길이 ${base.length} != ${cur?.length}`);
    return base.forEach((b, i) => compare(b, cur[i], `${path}[${i}]`, l));
  }
  if (base && typeof base === "object") {
    if (!cur || typeof cur !== "object") return problems.push(`${l}: ${path} 객체 아님`);
    for (const k of Object.keys(base)) k in cur ? compare(base[k], cur[k], `${path}.${k}`, l) : problems.push(`${l}: ${path}.${k} 누락`);
    for (const k of Object.keys(cur)) if (!(k in base)) problems.push(`${l}: ${path}.${k} 는 ko 에 없음`);
    return;
  }
  if (typeof cur !== "string" || cur.trim() === "") return problems.push(`${l}: ${path} 빈 값`);
  if (/[가-힣]/.test(cur)) problems.push(`${l}: ${path} 한글 남음`);
  if (digits(base) !== digits(cur)) problems.push(`${l}: ${path} 숫자 불일치 (ko=${digits(base)} ${l}=${digits(cur)})`);
  if (holders(base) !== holders(cur)) problems.push(`${l}: ${path} 자리표시자 불일치`);
}
const loadText = (l) => JSON.parse(readFileSync(join(root, "src/data/portfolio-text", `${l}.json`), "utf8"));
const baseText = loadText(BASE);
for (const l of OTHERS) compare(baseText, loadText(l), "portfolio", l);

if (problems.length) {
  console.error(`check-i18n: ${problems.length}건\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`check-i18n: OK (메시지 ${Object.keys(base).length}개 키, 포트폴리오 ${Object.keys(baseText).length}개 프로젝트, ${OTHERS.length}개 로케일)`);
