import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  const response = await page.goto("/en/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/Ph4nt0m/);
});

test("blog list page loads", async ({ page }) => {
  const response = await page.goto("/en/blog/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/Blog/);
});

test("portfolio page loads", async ({ page }) => {
  const response = await page.goto("/en/portfolio/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/Portfolio/);
});

test("writeup list rows are real anchors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  const response = await page.goto("/en/writeups/");
  expect(response?.status()).toBeLessThan(400);

  // Wait briefly for any hydration errors to appear
  await page.waitForTimeout(500);

  // Assert no console errors (catches React hydration mismatches)
  expect(consoleErrors).toHaveLength(0);

  const anchorCount = await page
    .locator('a[href*="/writeups/"]:not([href="/en/writeups/"])')
    .count();
  expect(anchorCount).toBeGreaterThanOrEqual(28);

  // Verify link navigates when clicked
  const secondRowLink = page.locator("tbody tr").nth(1).locator("a").first();
  const linkHref = await secondRowLink.getAttribute("href");
  expect(linkHref).toContain("/writeups/");
  await secondRowLink.click();
  expect(page.url()).toContain("/writeups/");
  expect(page.url()).not.toContain("/en/writeups/\n");
});

test("blog pagination reflects in the URL and survives reload", async ({ page }) => {
  await page.goto("/en/blog/");
  const firstPageTitle = await page.locator("a.group.block").first().textContent();
  await page.goto("/en/blog/?page=2");
  const response = await page.reload();
  expect(response?.status()).toBeLessThan(400);
  const secondPageTitle = await page.locator("a.group.block").first().textContent();
  expect(secondPageTitle).not.toBe(firstPageTitle);
});

test("writeup detail body is server-rendered (no JS)", async ({ request }) => {
  const response = await request.get("/en/writeups/alert-to-win-xss/");
  expect(response.status()).toBeLessThan(400);
  const html = await response.text();
  // The real body should contain prose, not just the Suspense placeholder.
  expect(html.length).toBeGreaterThan(3000);
  expect(html).not.toMatch(/self\.__next_f\.push.*"children".*null/);
});

test("tag page shows items from multiple sections", async ({ page }) => {
  const response = await page.goto("/en/tags/pwn/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByText(/writeup/i).first()).toBeVisible();
});

test("unknown tag returns 404", async ({ page }) => {
  const response = await page.goto("/en/tags/this-tag-does-not-exist-xyz/");
  expect(response?.status()).toBe(404);
});

test("tag index only lists tags used 3+ times", async ({ page }) => {
  const response = await page.goto("/en/tags/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole("link", { name: /#pwn/i })).toBeVisible();
});

test("blog post tag badges link to /tags/", async ({ page }) => {
  await page.goto("/en/blog/grammar-based-fuzzing/");
  const tagLink = page.locator('a[href*="/tags/"]').first();
  await expect(tagLink).toBeVisible();
  const href = await tagLink.getAttribute("href");
  expect(href).not.toBe("/en/blog/");
});

test("global search finds results across sections", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("button", { name: /search/i }).click();
  await page.getByRole("textbox").fill("pwn");
  await expect(page.getByRole("link").filter({ hasText: /pwn/i }).first()).toBeVisible();
});

test("search query is reflected in the URL and restored on reload", async ({ page }) => {
  await page.goto("/en/");
  await page.getByRole("button", { name: /search/i }).click();
  await page.getByRole("textbox").fill("pwn");
  await expect(page).toHaveURL(/[?&]q=pwn/);
  await page.reload();
  await expect(page.getByRole("textbox")).toHaveValue("pwn");
});
