/**
 * Explicit synonym overrides for cross-section tag normalization, beyond
 * plain lowercasing. Keys and values are already lowercase. Add entries here
 * when a real synonym is found (e.g. "xss" / "cross-site-scripting") - do
 * not add case-only pairs, normalizeTag() lowercases everything already.
 */
export const TAG_SYNONYMS: Record<string, string> = {};
