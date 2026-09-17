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
  const response = await page.goto("/en/writeups/");
  expect(response?.status()).toBeLessThan(400);
  const anchorCount = await page
    .locator('a[href*="/writeups/"]:not([href="/en/writeups/"])')
    .count();
  expect(anchorCount).toBeGreaterThanOrEqual(28);

  // Verify whole row is clickable: the Link overlay covers entire row
  const secondRowLink = page.locator("tbody tr").nth(1).locator("a").first();
  const linkHref = await secondRowLink.getAttribute("href");
  expect(linkHref).toContain("/writeups/");

  // Verify link navigates when clicked
  await secondRowLink.click();
  expect(page.url()).toContain("/writeups/");
  expect(page.url()).not.toContain("/en/writeups/\n");
});
