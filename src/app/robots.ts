import type { MetadataRoute } from "next";

// Required for `output: export` — emit robots.txt as a static file at build.
export const dynamic = "force-static";

const BASE = "https://phantomn.github.io";

/**
 * robots.txt — explicitly allow AI answer-engine crawlers so the site is
 * eligible for citation in ChatGPT / Claude / Perplexity / Copilot answers
 * (AEO). Search crawlers get the same open access; nothing here is private.
 */
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = [
    "GPTBot", // OpenAI / ChatGPT
    "OAI-SearchBot", // ChatGPT search
    "ChatGPT-User", // ChatGPT browsing
    "ClaudeBot", // Anthropic Claude
    "Claude-Web",
    "PerplexityBot", // Perplexity
    "Perplexity-User",
    "Google-Extended", // Gemini training/grounding
    "Applebot-Extended",
    "CCBot", // Common Crawl (feeds many models)
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
