import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ko", "pt-br", "es"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Map our lowercase route locale (`pt-br`) to the BCP 47 form that `Intl`
 * APIs expect (`pt-BR`). Used for date/number formatting and for the
 * `source`/`target` parameters of the Lingva translator.
 */
export function toBcp47(locale: string): string {
  if (locale === "ko") return "ko-KR";
  if (locale === "pt-br") return "pt-BR";
  if (locale === "es") return "es-ES";
  return "en-US";
}
