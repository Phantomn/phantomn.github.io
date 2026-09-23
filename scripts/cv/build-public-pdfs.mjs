#!/usr/bin/env node
// 배포 이력서 PDF 재생성. scripts/cv 의 yaml 을 rendercv 로 렌더링해 public/docs 에 복사한다.
//   pnpm cv:pdf              렌더링 -> 쪽수 비교 -> 복사
//   pnpm cv:pdf -- --dry     복사하지 않고 쪽수만 비교
// 쪽수가 기존과 달라지면(레이아웃이 넘친 것) 복사하지 않고 실패한다.
// 필요: rendercv, pdfinfo(poppler). 먼저 check:records 를 돌려 표기 정합성을 확인한다.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const cvDir = join(root, "scripts/cv");
const docsDir = join(root, "public/docs");
const dry = process.argv.includes("--dry");

// yaml -> 배포 PDF. resume-enus, resume-ptbr 는 resume-en 과 바이트 단위로 같은 복사본이다.
const TARGETS = [
  ["Hong_Seungpyo_CV_kor.yaml", ["resume-ko"]],
  ["Hong_Seungpyo_CV.yaml", ["resume-en", "resume-enus", "resume-ptbr"]],
  ["Hong_Seungpyo_CV_xbow.yaml", ["resume-xbow"]],
  ["career-statement-ko.yaml", ["career-statement-ko"]],
  ["career-statement-en.yaml", ["career-statement-en"]],
];

const pages = (pdf) => {
  const out = execFileSync("pdfinfo", [pdf], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return Number(out.match(/^Pages:\s+(\d+)/m)?.[1]);
};

try {
  execFileSync("node", [join(root, "scripts/check-records.mjs")], { stdio: "inherit" });
} catch {
  console.error("check:records 실패 - 표기부터 고친다");
  process.exit(1);
}

let failed = false;
for (const [yaml, names] of TARGETS) {
  const tmp = mkdtempSync(join(tmpdir(), "cvpdf-"));
  try {
    execFileSync(
      "rendercv",
      ["render", yaml, "-o", tmp, "--dont-generate-markdown", "--dont-generate-html", "--dont-generate-png"],
      { cwd: cvDir, stdio: "ignore" },
    );
    const pdf = readdirSync(tmp).find((f) => f.endsWith(".pdf"));
    if (!pdf) throw new Error("PDF 가 만들어지지 않았다");
    const next = join(tmp, pdf);
    const before = existsSync(join(docsDir, `${names[0]}.pdf`)) ? pages(join(docsDir, `${names[0]}.pdf`)) : null;
    const after = pages(next);
    const same = before === null || before === after;
    console.log(`${names[0].padEnd(22)} ${before ?? "-"}쪽 -> ${after}쪽 ${same ? "OK" : "쪽수 변경, 복사 안 함"}`);
    if (!same) failed = true;
    else if (!dry) for (const n of names) copyFileSync(next, join(docsDir, `${n}.pdf`));
  } catch (e) {
    console.error(`${yaml}: ${e.message}`);
    failed = true;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(dry ? "dry-run: 복사하지 않았다" : failed ? "일부 실패" : "public/docs 갱신 완료");
process.exit(failed ? 1 : 0);
