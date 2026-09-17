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
