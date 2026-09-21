// globals.css 의 --text-* 글자 크기 토큰과 src/lib/utils.ts 의 TEXT_SIZE_TOKENS 가 같은지 검사한다.
// 어긋나면 tailwind-merge 가 새 토큰을 글자 색으로 오인해 cn() 에서 색 클래스를 조용히 지운다.
// 모든 토큰은 줄 간격(--text-<name>--line-height)도 함께 정의해야 한다(크기만 있고 줄 간격이 빠지는 일을 막는다).
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles/globals.css", "utf8");
const utils = readFileSync("src/lib/utils.ts", "utf8");

const sizes = new Set();
const leadings = new Set();
for (const m of css.matchAll(/^\s*--text-([a-z][a-z-]*?)(--line-height)?:/gm)) {
  (m[2] ? leadings : sizes).add(m[1]);
}

const list = utils.match(/TEXT_SIZE_TOKENS\s*=\s*\[([^\]]*)\]/);
const registered = new Set(list ? [...list[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : []);

const errors = [];
if (!list) errors.push("src/lib/utils.ts 에서 TEXT_SIZE_TOKENS 를 찾지 못했다");
if (sizes.size === 0) errors.push("globals.css 에서 --text-* 토큰을 찾지 못했다");
for (const n of sizes) {
  if (!registered.has(n)) errors.push(`--text-${n} 가 TEXT_SIZE_TOKENS 에 없다 (cn() 이 색으로 오인한다)`);
  if (!leadings.has(n)) errors.push(`--text-${n} 에 --text-${n}--line-height 가 없다`);
}
for (const n of registered) if (!sizes.has(n)) errors.push(`TEXT_SIZE_TOKENS 의 "${n}" 에 대응하는 --text-${n} 가 globals.css 에 없다`);
for (const n of leadings) if (!sizes.has(n)) errors.push(`--text-${n}--line-height 만 있고 --text-${n} 크기가 없다`);

if (errors.length) {
  console.error(errors.map((e) => `check-type-scale: ${e}`).join("\n"));
  process.exit(1);
}
console.log(`check-type-scale: OK (토큰 ${sizes.size}개: ${[...sizes].join(", ")})`);
