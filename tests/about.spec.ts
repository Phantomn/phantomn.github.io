import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const competitions: {
  name: string;
  year: number | string;
  overall?: { rank: number; of: number };
}[] = JSON.parse(readFileSync("src/data/competitions.json", "utf8"));

test("about shows competition results from the single source", async ({ page }) => {
  await page.goto("/ko/about/");
  const article = page.locator("article");
  for (const c of competitions) {
    if (!c.overall) continue;
    await expect(article).toContainText(c.name);
    await expect(article).toContainText(`종합 ${c.overall.rank}위(${c.overall.of}팀 중)`);
  }
});

test("CVE count is consistent across about, portfolio and the listed IDs", async ({ page }) => {
  await page.goto("/ko/about/");
  const about = await page.locator("article").innerText();
  const stated = Number(about.match(/CVE (\d+)건/)?.[1]);
  expect(stated).toBeGreaterThan(0);
  // 나열된 정식 CVE 번호 수 == 총건수 (번호 대기 항목은 슬러그가 cve-20 으로 시작하지 않는다)
  await expect(page.locator('article a[href*="/cves/cve-20"]')).toHaveCount(stated);

  await page.goto("/ko/portfolio/");
  const portfolio = await page.locator("body").innerText();
  const m = portfolio.match(/CVE (\d+)건\(([^)]*)\)/);
  expect(Number(m?.[1])).toBe(stated);
  // 내역 합계(Kernel 16 + IoT 5 + LLM 3)도 총건수와 같다
  const sum = [...(m?.[2] ?? "").matchAll(/(\d+)/g)].reduce((s, x) => s + Number(x[1]), 0);
  expect(sum).toBe(stated);
});

// 문구는 messages/*.json 한 곳에서 수정하고, 4개 로케일에 그대로 반영되어야 한다.
for (const locale of ["ko", "en", "es", "pt-br"]) {
  test(`intro and home description come from messages in ${locale}`, async ({ page }) => {
    const m = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
    await page.goto(`/${locale}/about/`);
    await expect(page.locator("article > p[data-notranslate]")).toHaveText(m.about.intro);
    await page.goto(`/${locale}/`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", m.home.description);
  });
}

// 소개는 런타임 기계 번역이 아니라 서버가 messages 로 완성해서 내려준다.
// (번역기는 "Locked Shields"를 "Escudos bloqueados"로, "Green Team"을 "Equipe Verde"로 바꿨다.)
for (const locale of ["en", "es", "pt-br"]) {
  test(`about is fully rendered on the server in ${locale} (no Korean, names intact)`, async ({ page, request }) => {
    const res = await request.get(`/${locale}/about/`);
    const html = await res.text();
    const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(article.length).toBeGreaterThan(0);
    expect(article).not.toMatch(/[가-힣]/);
    expect(article).toContain("Locked Shields");
    for (const c of competitions) {
      if (!c.overall) continue;
      expect(article).toContain(`${c.overall.rank}`);
      expect(article).toContain(`${c.overall.of}`);
    }
    // 런타임 번역기 배너가 뜨면 안 된다
    await page.goto(`/${locale}/about/`);
    await expect(page.locator('[role="status"]')).toHaveCount(0);
  });
}
