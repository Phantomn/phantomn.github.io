#!/usr/bin/env node
// 성과 기록 정합성 검사. 단일 원본(data/source/competitions.json, cves.json)과 이력서 yaml·메시지의 표기를 대조한다.
//  1) 대회 라벨(예: "Locked Shields 2025")이 든 줄에서 순위를 말하면 종합 순위가 함께 있어야 한다.
//  2) 종합 순위는 참가 팀 수("N팀 중" / "of N")와 함께 쓰고, 둘 다 원본과 같아야 한다.
//  3) "N CVEs (OS Kernel ..." 처럼 내역이 붙은 총건수는 정식 번호(CVE-YYYY-NNNN)가 부여된 CVE 개수와 같아야 한다.
//  4) "N FVEs" 총건수는 정식 FVE 개수와 같아야 한다.
// 위반이 있으면 종료 코드 1. 실행: pnpm check:records
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const competitions = JSON.parse(readFileSync(join(root, "data/source/competitions.json"), "utf8"));
const cves = JSON.parse(readFileSync(join(root, "data/source/cves.json"), "utf8"));

// "정식 번호가 부여된"만 계수 - CVE-UNASSIGNED-... 같은 대기 항목은 제외.
const assignedCve = cves.filter((c) => /^CVE-\d{4}-\d{4,}$/.test(c.id)).length;
const assignedFve = cves.filter((c) => /^FVE-\d{4}-\d+-\d+$/.test(c.id)).length;

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "out" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const files = [...walk(join(root, "scripts/cv"), [".yaml"]), ...walk(join(root, "messages"), [".json"])];

const errors = [];
const RANK = /\d+위|#\d+|\b\d+(?:st|nd|rd|th)\b/;
const OVERALL_KO = /종합\s*(\d+)위/g;
const OVERALL_EN = /overall\s*(\d+)(?:st|nd|rd|th)/gi;
const OF = /(\d+)팀\s*중/g;
const OF_EN = /overall\s*\d+(?:st|nd|rd|th)\s+of\s+(\d+)/gi;
const CVE_TOTAL = [/(\d+)\**\s*CVEs?\**\s*\((?:OS )?Kernel/gi, /CVE\s*(\d+)건\s*\((?:OS )?Kernel/g];
const FVE_TOTAL = [/(\d+)\s*FVEs?\b/gi, /FVE\s*(\d+)건/g];

for (const file of files) {
  const rel = relative(root, file);
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      for (const c of competitions.filter((x) => x.overall)) {
        if (!line.includes(`${c.name} ${c.year}`)) continue;
        const ranks = [...line.matchAll(OVERALL_KO), ...line.matchAll(OVERALL_EN)].map((m) => Number(m[1]));
        if (ranks.length === 0 && RANK.test(line)) {
          errors.push(`${at}: ${c.name} ${c.year} 의 순위를 말하는데 종합 ${c.overall.rank}위가 없다`);
        }
        for (const r of ranks) {
          if (r !== c.overall.rank) errors.push(`${at}: ${c.name} ${c.year} 종합 ${r}위 (원본 ${c.overall.rank}위)`);
        }
        const denoms = [...line.matchAll(OF), ...line.matchAll(OF_EN)].map((m) => Number(m[1]));
        if (ranks.length > 0 && denoms.length === 0) {
          errors.push(`${at}: ${c.name} ${c.year} 종합 순위에 참가 팀 수(${c.overall.of}팀)가 없다`);
        }
        for (const d of denoms) {
          if (d !== c.overall.of) errors.push(`${at}: ${c.name} ${c.year} 참가 팀 ${d} (원본 ${c.overall.of}팀)`);
        }
      }
      for (const re of CVE_TOTAL) {
        for (const m of line.matchAll(re)) {
          if (Number(m[1]) !== assignedCve) errors.push(`${at}: CVE 총건수 ${m[1]} (정식 번호 ${assignedCve}건)`);
        }
      }
      for (const re of FVE_TOTAL) {
        for (const m of line.matchAll(re)) {
          if (Number(m[1]) !== assignedFve) errors.push(`${at}: FVE 총건수 ${m[1]} (정식 ${assignedFve}건)`);
        }
      }
    });
}

if (errors.length) {
  console.error(`records: ${errors.length}건 불일치\n${errors.map((e) => `  ${e}`).join("\n")}`);
  process.exit(1);
}
console.log(`records OK (${files.length} files, 정식 CVE ${assignedCve}건, FVE ${assignedFve}건, 대회 ${competitions.length}건)`);
