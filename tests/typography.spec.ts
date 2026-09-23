import { test, expect, type Page } from "@playwright/test";

/**
 * 문서 성격의 페이지(소개, 포트폴리오)의 읽기 품질을 렌더링된 값으로 검사한다.
 * 클래스 이름이 아니라 computed style 을 보므로 text-sm, text-[Npx], 줄 간격 누락 등 어떤 경로로 작아져도 잡힌다.
 * 기준은 글자 크기 체계(src/styles/globals.css 의 --text-*)에서 온다: 본문 15px 이상, 줄 간격 1.5 이상, h1 32px 이상, 어떤 글자도 12px 미만 금지.
 * 사이트 104곳 조사에서 본문 중앙값은 16px/1.6, h1 중앙값은 48px 이었다.
 */
const PAGES = ["/ko/about/", "/ko/portfolio/"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 400, height: 800 },
];

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      for (let n: Element | null = e; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
      }
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const label = (e: Element) => `<${e.tagName.toLowerCase()}> "${(e.textContent ?? "").trim().slice(0, 24)}"`;
    const problems: string[] = [];

    const bodies = [...document.querySelectorAll("p, li, dd, blockquote")].filter(
      (e) => !e.closest("nav, header, footer, aside") && visible(e) && (e.textContent ?? "").trim().length >= 40,
    );
    for (const e of bodies) {
      const s = getComputedStyle(e);
      const size = parseFloat(s.fontSize);
      const ratio = (s.lineHeight === "normal" ? 1.2 * size : parseFloat(s.lineHeight)) / size;
      if (size < 15) problems.push(`본문 글자 ${size}px < 15px: ${label(e)}`);
      if (ratio < 1.5) problems.push(`본문 줄 간격 ${ratio.toFixed(2)} < 1.5: ${label(e)}`);
    }

    const h1 = [...document.querySelectorAll("h1")].find(visible);
    const h1Size = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    if (h1Size < 32) problems.push(`h1 ${h1Size}px < 32px`);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !(n.textContent ?? "").trim() || el.closest("script, style, noscript") || !visible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) problems.push(`글자 ${size}px < 12px: ${label(el)}`);
    }
    return { bodies: bodies.length, problems: [...new Set(problems)] };
  });
}

for (const path of PAGES) {
  for (const vp of VIEWPORTS) {
    test(`typography floor: ${path} (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(path);
      const { bodies, problems } = await audit(page);
      expect(bodies, "본문 표본이 없으면 검사가 의미 없다").toBeGreaterThan(5);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

/*
 * h1 은 페이지마다 따로 지정돼 있었다(text-3xl / text-4xl sm:text-5xl 등 9곳). 그래서 같은 사이트에서 30~48px 로 갈렸다.
 * 이제 globals.css 의 --text-title 한 곳에서 정하고 화면 폭에 따라 36~48px 로 변한다
 * (표본 h1 중앙값: 데스크톱 54px, 모바일 36px). 페이지 종류가 달라도 같은 폭에서는 같은 크기여야 한다.
 */
const H1_PAGES = ["/ko/", "/ko/about/", "/ko/portfolio/", "/ko/blog/", "/ko/cves/"];

for (const vp of VIEWPORTS) {
  test(`h1 comes from one token on every page type (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const sizes: Record<string, number> = {};
    for (const path of H1_PAGES) {
      await page.goto(path);
      sizes[path] = await page
        .locator("h1")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    }
    const distinct = [...new Set(Object.values(sizes))];
    expect(distinct, `페이지별 h1: ${JSON.stringify(sizes)}`).toHaveLength(1);
    expect(distinct[0]).toBeGreaterThanOrEqual(vp.name === "mobile" ? 34 : 44);
  });
}

/*
 * 사이트 전체 제목 위계. 페이지를 하나씩 고치다가 편차가 커진 적이 있다(h2 30/24/16px, h3 24/20/16px,
 * 본문 17/16/15px, 줄간격 5종, 글 폭 6종). 값은 globals.css 토큰 한 곳에서 정하고, 페이지 종류가 달라도
 * 같은 단계는 같은 크기여야 한다. 12px 미만 글자는 어느 목록에도 없어야 한다(예전엔 블로그 목록 글자의 16.6%).
 */
const ALL_PAGES = [
  "/ko/",
  "/ko/about/",
  "/ko/portfolio/",
  "/ko/blog/",
  "/ko/blog/aarch64-easy-linux-pwn/",
  "/ko/cves/",
  "/ko/cves/cve-2019-18885/",
  "/ko/writeups/",
  "/ko/tags/",
];

test("heading levels have one size each across every page type", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const seen: Record<string, Map<number, string[]>> = { h1: new Map(), h2: new Map(), h3: new Map() };
  const tinyText: string[] = [];

  for (const path of ALL_PAGES) {
    await page.goto(path);
    const r = await page.evaluate(() => {
      const vis = (e: Element) => {
        for (let n: Element | null = e; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
        }
        return e.getBoundingClientRect().height > 0;
      };
      const main = document.querySelector("main") ?? document.body;
      const sizes = (sel: string) => [
        ...new Set(
          [...main.querySelectorAll(sel)]
            .filter(vis)
            .map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize))),
        ),
      ];
      const tiny: string[] = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !(n.textContent ?? "").trim() || el.closest("script, style, noscript") || !vis(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) tiny.push(`${size}px <${el.tagName.toLowerCase()}> "${(n.textContent ?? "").trim().slice(0, 20)}"`);
      }
      return { h1: sizes("h1"), h2: sizes("h2"), h3: sizes("h3"), tiny: [...new Set(tiny)] };
    });
    for (const tag of ["h1", "h2", "h3"] as const) {
      for (const size of r[tag]) {
        if (!seen[tag].has(size)) seen[tag].set(size, []);
        seen[tag].get(size)!.push(path);
      }
    }
    for (const t of r.tiny) tinyText.push(`${path}: ${t}`);
  }

  for (const tag of ["h1", "h2", "h3"] as const) {
    const found = [...seen[tag].entries()].map(([size, paths]) => `${size}px (${paths.join(", ")})`);
    expect(seen[tag].size, `${tag} 크기가 여러 개: ${found.join(" | ")}`).toBeLessThanOrEqual(1);
  }
  expect(tinyText, `12px 미만 글자:\n${tinyText.join("\n")}`).toEqual([]);
});
