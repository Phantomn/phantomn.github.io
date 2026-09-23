import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

/*
 * 홈. 이전에는 전체 화면 히어로(외부 영상 + 큰 아바타)와 네비게이션 카드 3개뿐이어서 첫 화면에 보이는 글자가 153자였고
 * 작업물이 하나도 없었다(표본 97곳 중 46%는 첫 화면에 작업물을 보여 준다). 히어로가 다시 화면을 다 차지하거나
 * 숫자가 데이터와 어긋나면 실패해야 한다.
 */
const competitions: { id: string; tracks?: { name: string; rank: number }[] }[] = JSON.parse(
  readFileSync("src/data/competitions.json", "utf8"),
);
const portfolioText: Record<string, unknown> = JSON.parse(
  readFileSync("src/data/portfolio-text/ko.json", "utf8"),
);

test("home shows the record numbers from the single source", async ({ page }) => {
  await page.goto("/ko/");
  const values = await page.locator("main header dl dd").allInnerTexts();
  expect(values.length).toBeGreaterThanOrEqual(3);
  expect(values, "프로젝트 수는 데이터에서 센 값과 같아야 한다").toContain(
    String(Object.keys(portfolioText).length),
  );
  const ls2025 = competitions.find((c) => c.id === "ls2025")!;
  expect(values, "Locked Shields 2025 DFIR 순위").toContain(`${ls2025.tracks![0].rank}위`);
});

test("home puts work in the first screen instead of a full-viewport hero", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ko/");

  // 머리(이름·소개·숫자)가 한 화면을 다 먹지 않는다
  const headerHeight = await page
    .locator("main header")
    .evaluate((e) => e.getBoundingClientRect().height);
  expect(headerHeight, `머리 높이 ${Math.round(headerHeight)}px`).toBeLessThan(700);

  // 첫 화면(0~900px) 안에 실제 기록으로 가는 링크가 있다
  const linksInFirstScreen = await page
    .locator('main a[href*="/blog/"], main a[href*="/cves/"]')
    .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().top < 900).length);
  expect(linksInFirstScreen, "첫 화면에 글·CVE 링크가 없다").toBeGreaterThan(0);
});

test("home lists recent posts and CVEs with working links", async ({ page }) => {
  await page.goto("/ko/");
  const posts = page.locator("section#recent-posts li a");
  const cves = page.locator("section#recent-cves li a");
  expect(await posts.count()).toBeGreaterThanOrEqual(3);
  expect(await cves.count()).toBeGreaterThanOrEqual(3);

  // 첫 글 링크를 따라가면 그 글이 열린다(깨진 링크를 잡는다)
  const href = await posts.first().getAttribute("href");
  const title = (await posts.first().locator("span span").first().innerText()).trim();
  const res = await page.request.get(href!);
  expect(res.status(), `${href} 응답`).toBe(200);
  expect(title.length).toBeGreaterThan(5);
});

/*
 * 히어로 배경 모티프. 강조색 번짐을 두 테마에 똑같이 넣었더니 라이트 모드에서 --primary 가 거의 검정(#121212)이라
 * 회색 얼룩으로 보였다. 번짐은 다크 전용이고 라이트는 격자만 깔린다. 한 테마에서만 드러나는 결함이라 둘 다 본다.
 */
test("hero grid keeps the accent glow out of light mode", async ({ page }) => {
  await page.goto("/ko/");
  const layers = async () =>
    page.locator(".hero-grid").evaluate((e) => {
      const bg = getComputedStyle(e).backgroundImage;
      return { radial: bg.includes("radial-gradient"), lines: (bg.match(/linear-gradient/g) ?? []).length };
    });

  const dark = await layers();
  expect(dark.radial, "다크에서는 강조색 번짐이 있다").toBe(true);
  expect(dark.lines).toBe(2);

  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  const light = await layers();
  expect(light.radial, "라이트에서는 번짐이 없어야 한다(회색 얼룩이 된다)").toBe(false);
  expect(light.lines).toBe(2);
});
