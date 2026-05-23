import { toBcp47 } from "@/i18n/routing";

const REQUEST_TIMEOUT_MS = 10_000;
const BATCH_SEP = "\n@@§§@@\n";
const MAX_BATCH_CHARS = 2500;
const CONCURRENCY = 4;

function toLangCode(locale: string): string {
  const bcp = toBcp47(locale);
  if (bcp.startsWith("pt")) return "pt";
  return bcp.split("-")[0].toLowerCase();
}

function mergeSignals(
  user?: AbortSignal,
  timeout?: AbortSignal,
): AbortSignal | undefined {
  if (!user && !timeout) return undefined;
  if (!user) return timeout;
  if (!timeout) return user;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([user, timeout]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  user.addEventListener("abort", onAbort);
  timeout.addEventListener("abort", onAbort);
  return controller.signal;
}

async function fetchWithTimeout(
  url: string,
  userSignal?: AbortSignal,
): Promise<Response> {
  const timeoutCtl = new AbortController();
  const timer = setTimeout(() => timeoutCtl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: mergeSignals(userSignal, timeoutCtl.signal),
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google Translate public gtx endpoint — same backend the web widget uses.
 * No API key, CORS-friendly, high quality. Response shape:
 *   [ [[segment, original, ...], ...], null, sourceLang, ... ]
 */
async function googleTranslate(
  text: string,
  source: string,
  target: string,
  signal?: AbortSignal,
): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetchWithTimeout(url, signal);
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("google unexpected response");
  }
  let out = "";
  for (const seg of data[0] as unknown[]) {
    if (Array.isArray(seg) && typeof seg[0] === "string") {
      out += seg[0];
    }
  }
  if (!out) throw new Error("google empty");
  return out;
}

/**
 * MyMemory fallback — no key, ~50k chars/day by IP, decent quality.
 */
async function myMemoryTranslate(
  text: string,
  source: string,
  target: string,
  signal?: AbortSignal,
): Promise<string> {
  const tgt = target === "pt" ? "pt-BR" : target;
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(text)}&langpair=${source}|${tgt}`;
  const res = await fetchWithTimeout(url, signal);
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
  };
  const out = data.responseData?.translatedText;
  if (!out) throw new Error("mymemory empty");
  return out;
}

export async function translateText(
  text: string,
  fromLocale: string,
  toLocale: string,
  signal?: AbortSignal,
): Promise<string> {
  const source = toLangCode(fromLocale);
  const target = toLangCode(toLocale);
  if (source === target) return text;

  try {
    return await googleTranslate(text, source, target, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  try {
    return await myMemoryTranslate(text, source, target, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    throw err;
  }
}

function groupBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of texts) {
    const add = t.length + BATCH_SEP.length;
    if (len + add > MAX_BATCH_CHARS && cur.length > 0) {
      batches.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += add;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

async function translateBatchOrFallback(
  batch: string[],
  fromLocale: string,
  toLocale: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (batch.length === 1) {
    try {
      return [await translateText(batch[0], fromLocale, toLocale, signal)];
    } catch {
      return [batch[0]];
    }
  }
  try {
    const joined = batch.join(BATCH_SEP);
    const translated = await translateText(joined, fromLocale, toLocale, signal);
    const parts = translated.split(BATCH_SEP);
    if (parts.length === batch.length) return parts;
  } catch {
    /* fall through to per-item */
  }
  const out: string[] = [];
  for (const item of batch) {
    if (signal?.aborted) break;
    try {
      out.push(await translateText(item, fromLocale, toLocale, signal));
    } catch {
      out.push(item);
    }
  }
  return out;
}

export async function translateMany(
  texts: string[],
  fromLocale: string,
  toLocale: string,
  opts?: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<string[]> {
  if (texts.length === 0) return [];
  const batches = groupBatches(texts);
  const results: string[][] = new Array(batches.length);
  let nextIdx = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      if (opts?.signal?.aborted) return;
      const i = nextIdx++;
      if (i >= batches.length) return;
      results[i] = await translateBatchOrFallback(
        batches[i],
        fromLocale,
        toLocale,
        opts?.signal,
      );
      completed++;
      opts?.onProgress?.(completed, batches.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker()),
  );
  return results.flat();
}
