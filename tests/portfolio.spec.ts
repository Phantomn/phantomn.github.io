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
  await expect(page.locator("h3:visible", { hasText: "C2021 행사" })).toBeVisible();
  await expect(page.locator("h3:visible", { hasText: "KT 기가지니" })).toHaveCount(0);
});

// 카드는 한 번만 그리고, 화면에서 필터가 가린 카드는 인쇄에서 다시 보인다(1열). print: 변형이 sm: 을 이기는지도 함께 본다.
test("portfolio prints every project in one column even while a filter is active", async ({ page }) => {
  await page.goto("/ko/portfolio/");
  await page.getByRole("button", { name: /^사이버훈련장·CTF 개발/ }).click();
  const total = await page.locator("main h3").count();
  expect(await page.locator("main h3:visible").count()).toBeLessThan(total); // 화면에서는 일부가 가려져 있다
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("main h3:visible")).toHaveCount(total);
  const columns = await page
    .locator('[class*="print:grid-cols-1"]')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(1);
});

// 이 페이지는 이력서 골격이라 같은 내용이 여러 섹션에 다시 나오기 쉽다. 대표 프로젝트가 "주요 프로젝트" 와 전체 목록(화면, 인쇄용 모두)에
// 두 번씩 나와 페이지가 늘어졌던 적이 있다. 화면에 안 보이는 인쇄용 목록까지 포함해 제목이 겹치지 않아야 한다.
for (const locale of ["ko", "en"]) {
  test(`portfolio (${locale}) shows each project once (no duplicated titles, screen or print)`, async ({ page }) => {
    await page.goto(`/${locale}/portfolio/`);
    // textContent 는 display:none 인 인쇄용 목록까지 포함한다
    const titles = await page.locator("main h3").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
    const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(titles.length).toBeGreaterThan(20);
    expect(dup, `중복 제목: ${dup.join(" | ")}`).toEqual([]);
  });
}
