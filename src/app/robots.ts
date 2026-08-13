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
  // Three crawler roles per AI vendor: training / search-index / live-agent.
  // Search-index bots are the ones that decide citation eligibility.
  const aiCrawlers = [
    // OpenAI
    "GPTBot", // training
    "OAI-SearchBot", // ChatGPT search index → citation eligibility
    "ChatGPT-User", // live user-triggered fetch
    // Anthropic
    "ClaudeBot", // training
    "Claude-SearchBot", // Claude search index → citation eligibility
    "Claude-User", // live user-triggered fetch
    // Perplexity
    "PerplexityBot", // search index
    "Perplexity-User", // live fetch
    // Google (Gemini) — robots token, no distinct HTTP UA; Googlebot does the crawl
    "Google-Extended",
    // Apple Intelligence
    "Applebot-Extended",
    // Common Crawl (feeds many models)
    "CCBot",
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
