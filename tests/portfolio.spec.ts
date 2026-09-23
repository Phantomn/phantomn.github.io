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

/*
 * 이 페이지는 훑어보는 포트폴리오이고, 완전한 기록은 맨 위에서 내려받는 경력기술서 PDF 다.
 * "그 밖의 프로젝트" 카드가 화면에서 배경·수행까지 다 펼쳐져 프로젝트 서술이 페이지 글자의 76% 를 차지한 적이 있다
 * (원인: 상세 여부를 featured 플래그가 아니라 데이터에 actions 가 있는지로 판단). 화면에서는 한 줄까지만 보여야 한다.
 */
test("portfolio keeps the non-featured cards scannable on screen and full in print", async ({ page }) => {
  await page.goto("/ko/portfolio/");
  const grid = page.locator("section#projects");
  const cards = grid.locator("[data-slot='card']");
  const count = await cards.count();
  expect(count).toBeGreaterThan(15);

  // 화면: 수행/성과 라벨이 보이지 않고, 카드마다 보이는 글자가 짧다
  // getByText 는 숨은 요소도 세므로 보이는 것만 고른다
  const visibleActionLabels = grid.locator(":text-is('주요 수행'):visible");
  await expect(visibleActionLabels).toHaveCount(0);
  const visibleLengths = await cards.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").trim().length),
  );
  expect(Math.max(...visibleLengths), `가장 긴 카드: ${Math.max(...visibleLengths)}자`).toBeLessThan(300);

  // 인쇄: 상세가 펼쳐진다
  await page.emulateMedia({ media: "print" });
  expect(await visibleActionLabels.count()).toBeGreaterThan(10);
  const printLengths = await cards.evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").trim().length),
  );
  expect(Math.max(...printLengths)).toBeGreaterThan(Math.max(...visibleLengths));
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

/*
 * 레이아웃 불변식. 표본 97곳을 브라우저로 재서 얻은 기준이다.
 * - 섹션을 전부 테두리 박스로 감싼 사이트는 8%뿐이고 위계가 좋은 그룹은 섹션 중 17%만 박스였다 -> 섹션은 카드로 감싸지 않는다.
 * - h3 가 18/16/15px 세 종류였고 그중 16px 는 본문과 같아서 제목으로 읽히지 않았다 -> 한 종류만 쓴다.
 * - 11화면 페이지에 페이지 내 이동 장치가 없었다(표본 35%, 위계 좋은 그룹 39%가 앵커를 둔다) -> 앵커 줄을 둔다.
 */
test("portfolio layout invariants: one h3 size, section anchors resolve, sections are not cards", async ({ page }) => {
  await page.goto("/ko/portfolio/");

  const h3Sizes = await page.locator("main h3:visible").evaluateAll((els) => [
    ...new Set(els.map((e) => getComputedStyle(e).fontSize)),
  ]);
  expect(h3Sizes, `h3 크기: ${h3Sizes.join(", ")}`).toHaveLength(1);

  const bodySize = await page
    .locator("main p:visible")
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(parseFloat(h3Sizes[0]), "h3 가 본문과 같은 크기면 제목으로 읽히지 않는다").toBeGreaterThan(bodySize);

  // 앵커가 실제 섹션을 가리켜야 한다(id 오타로 조용히 깨지는 것을 막는다)
  const hrefs = await page.locator('main nav a[href^="#"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!.slice(1)),
  );
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  for (const id of hrefs) await expect(page.locator(`section#${id}`)).toHaveCount(1);

  // 섹션 자체는 카드가 아니다(프로젝트·CVE 카드는 섹션 안에 있다)
  const boxedSections = await page.locator("main section[id]").evaluateAll((els) =>
    els.filter((e) => {
      const s = getComputedStyle(e);
      return s.boxShadow !== "none" || parseFloat(s.borderTopWidth) >= 1;
    }).length,
  );
  expect(boxedSections).toBe(0);
});

/*
 * 히어로의 숫자 줄. 성과가 요약 문장 안에 묶여 있어 훑어서 읽히지 않았다(표본에서 숫자 배지로 내세우는 곳 21%).
 * 값은 단일 원본에서 와야 한다 - 화면의 숫자와 데이터가 어긋나면 실패한다.
 */
test("portfolio hero shows the record numbers from the single source", async ({ page }) => {
  const projects: Record<string, unknown> = JSON.parse(readFileSync("src/data/portfolio-text/ko.json", "utf8"));
  const competitions: { id: string; tracks?: { name: string; rank: number }[] }[] = JSON.parse(
    readFileSync("src/data/competitions.json", "utf8"),
  );
  const ls2025 = competitions.find((c) => c.id === "ls2025")!;

  await page.goto("/ko/portfolio/");
  const stats = page.locator("main header dl");
  await expect(stats).toHaveCount(1);
  const pairs = await stats.locator("dd").allInnerTexts();
  expect(pairs, "프로젝트 수는 데이터에서 센 값과 같아야 한다").toContain(String(Object.keys(projects).length));
  expect(pairs, "Locked Shields 2025 DFIR 순위").toContain(`${ls2025.tracks![0].rank}위`);
  // 숫자가 본문보다 크게 보여야 훑어서 읽힌다
  const ddSize = await stats.locator("dd").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const bodySize = await page.locator("main header p").first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(ddSize).toBeGreaterThan(bodySize);
});

/* 섹션 수. 표본 97곳의 중앙값 3, 사분위 [2,6]. 이력서 골격 때문에 섹션이 늘어나기 쉬워 상한을 걸어 둔다. */
test("portfolio keeps the section count within the sample range", async ({ page }) => {
  await page.goto("/ko/portfolio/");
  const sections = await page.locator("main section[id]").count();
  expect(sections, `섹션 ${sections}개`).toBeLessThanOrEqual(6);
  expect(sections).toBeGreaterThanOrEqual(4);
});
