import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * globals.css 의 --text-* 토큰 이름. tailwind-merge 는 모르는 text-* 를 글자 색으로 취급해서
 * cn("text-xs text-secondary-foreground", "text-label") 이 색(text-secondary-foreground)을 지우고 text-xs 를 남긴다.
 * 여기에 등록해야 글자 크기로 인식된다. 이 목록과 CSS 는 pnpm check:type-scale 이 대조한다.
 */
export const TEXT_SIZE_TOKENS = ["title", "heading", "subheading", "body", "body-sm", "meta", "label"];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: TEXT_SIZE_TOKENS }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a plain-date string (e.g. "2026-04-16" from markdown frontmatter)
 * without the off-by-one timezone bug.
 *
 * `new Date("2026-04-16")` parses the string as UTC midnight. Any browser in
 * a timezone west of UTC (e.g. America/Sao_Paulo, UTC-3) would then render
 * that instant as the previous day. Forcing `timeZone: "UTC"` in the
 * formatter keeps the displayed day identical to what the author wrote in
 * frontmatter, regardless of where the page is viewed.
 */
export function formatDate(
  input: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  locale: string = "en-US",
): string {
  return new Date(input).toLocaleDateString(locale, {
    ...options,
    timeZone: "UTC",
  });
}
