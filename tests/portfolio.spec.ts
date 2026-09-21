import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const ko: Record<string, { title: string }> = JSON.parse(readFileSync("src/data/portfolio-text/ko.json", "utf8"));
const ids = Object.keys(ko);

// 포트폴리오는 런타임 기계 번역이 아니라 서버가 messages + portfolio-text JSON 으로 완성해서 내려준다.
for (const locale of ["en", "es", "pt-br"]) {
  test(`portfolio is fully rendered on the server in ${locale} (no Korean, names intact)`, async ({ request }) => {
    const html = await (await request.get(`/${locale}/portfolio/`)).text();
    const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
    expect(main.length).toBeGreaterThan(0);
    expect(main).not.toMatch(/[가-힣]/);
    const en: Record<string, { title: string }> = JSON.parse(
      readFileSync(`src/data/portfolio-text/${locale}.json`, "utf8"),
    );
    // 모든 프로젝트 카드가 해당 로케일 제목으로 그려졌는지 (HTML 이스케이프 무시하고 앞부분만 대조)
    const flat = main.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
    for (const id of ids) expect(flat, id).toContain(en[id].title.slice(0, 24));
    expect(flat).toContain("Locked Shields");
  });
}

test("portfolio (ko) keeps the record wording from the single source", async ({ page }) => {
  await page.goto("/ko/portfolio/");
  const body = await page.locator("main").innerText();
  expect(body).toContain("종합 6위(17팀 중)");
  expect(body).toContain("기여도");
  // 필터: 분류를 누르면 해당 분류 프로젝트만 남는다
  await page.getByRole("button", { name: /^사이버훈련장·CTF 개발/ }).click();
  await expect(page.locator("h3:visible", { hasText: "HACKSIUM" }).first()).toBeVisible();
  await expect(page.locator("h3:visible", { hasText: "KT 기가지니" })).toHaveCount(0);
});
