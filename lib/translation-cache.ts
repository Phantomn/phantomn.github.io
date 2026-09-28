/**
 * localStorage-backed cache for translated text snippets.
 * Keyed by `trans:{locale}:{contentKey}:{sha1(original)}`. Each entry stores
 * the original → translated mapping so invalidation happens implicitly when
 * the original text changes.
 */

async function sha1(input: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return h.toString(16);
  }
  const buf = new TextEncoder().encode(input);
  const hash = await window.crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function makeKey(locale: string, contentKey: string, hash: string): string {
  return `trans:${locale}:${contentKey}:${hash}`;
}

export async function getCached(
  locale: string,
  contentKey: string,
  original: string,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const hash = await sha1(original);
  try {
    return window.localStorage.getItem(makeKey(locale, contentKey, hash));
  } catch {
    return null;
  }
}

export async function setCached(
  locale: string,
  contentKey: string,
  original: string,
  translated: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const hash = await sha1(original);
  try {
    window.localStorage.setItem(makeKey(locale, contentKey, hash), translated);
  } catch {
    // localStorage full or disabled — silently skip
  }
}
