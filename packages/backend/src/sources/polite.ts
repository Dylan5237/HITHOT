import { createRequire } from "node:module";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "../db.ts";
import { SITE } from "@aihot/site";
import { DEFAULT_UA, guardedFetch, type GuardedFetchOptions, type GuardedResponse } from "../lib/http-fetch.ts";

interface Robots { isAllowed(url: string, ua: string): boolean | undefined; getCrawlDelay(ua: string): number | undefined }
const robotsParser = createRequire(import.meta.url)("robots-parser") as (url: string, text: string) => Robots;
type Policy = { parser: Robots; intervalMs: number };
const policies = new Map<string, { at: number; value: Promise<Policy> }>();
export class CollectionDeniedError extends Error {}

/** Subdomains and ports of a public site share their request interval across api and worker. */
export function crawlSite(url: URL): string {
  if (net.isIP(url.hostname)) return url.hostname;
  const parts = url.hostname.toLowerCase().split(".");
  return parts.slice(/\.(?:com|gov|org)\.cn$/.test(url.hostname) ? -3 : -2).join(".");
}

async function request(url: URL, intervalMs: number, opts: GuardedFetchOptions): Promise<GuardedResponse> {
  const host = crawlSite(url), session = await sql.reserve();
  const lock = `crawl:${host}`;
  try {
    // The api's preview and the worker can crawl together. Keep the site's lock through the
    // response, then wait at least five seconds after it finished; delayed wakeups cannot shorten it.
    await session`SELECT pg_advisory_lock(hashtext(${lock}))`;
    const [previous] = await session<{ wait_ms: number; interval_ms: number }[]>`SELECT
      greatest(0,extract(epoch FROM finished_at-clock_timestamp())*1000 + greatest(interval_ms,${intervalMs}))::float AS wait_ms,
      interval_ms FROM crawl_request_slots WHERE host=${host}`;
    const interval = Math.max(5000, intervalMs, previous?.interval_ms ?? 0);
    if (previous?.wait_ms) await delay(Math.ceil(previous.wait_ms) + 1);
    try {
      return await guardedFetch(url.href, { ...opts, followRedirects: false, headers: { ...opts.headers, "user-agent": DEFAULT_UA } });
    } finally {
      await session`INSERT INTO crawl_request_slots(host,finished_at,interval_ms) VALUES(${host},clock_timestamp(),${interval})
        ON CONFLICT(host) DO UPDATE SET finished_at=EXCLUDED.finished_at,interval_ms=EXCLUDED.interval_ms`;
    }
  } finally {
    try { await session`SELECT pg_advisory_unlock(hashtext(${lock}))`; } finally { session.release(); }
  }
}

export { collectionHttp } from "./collection-http.ts";

async function readRobots(origin: string): Promise<Policy> {
  let url = new URL("/robots.txt", origin);
  let res: GuardedResponse | null = null;
  for (let n = 0; n < 4; n++) {
    res = await request(url, 5000, { timeoutMs: 20_000, maxBytes: 512_000 });
    if ([301,302,303,307,308].includes(res.status) && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url); continue;
    }
    break;
  }
  if (!res || ![200,404,410].includes(res.status)) throw new CollectionDeniedError(`robots.txt unavailable (${res?.status ?? "no response"}) for ${origin}`);
  const text = res.status === 200 ? res.text() : "";
  if (res.status === 200 && /<html|captcha|验证码|安全验证/i.test(text)) throw new CollectionDeniedError(`robots.txt is an access challenge for ${origin}`);
  const parser = robotsParser(new URL("/robots.txt", origin).href, text);
  const seconds = parser.getCrawlDelay(SITE.crawlerName);
  return { parser, intervalMs: Math.max(5000, Number.isFinite(seconds) ? Number(seconds) * 1000 : 5000) };
}

async function policy(origin: string): Promise<Policy> {
  const entry = policies.get(origin);
  if (entry && Date.now() - entry.at < 6 * 3600_000) return entry.value;
  const value = readRobots(origin);
  policies.set(origin, { at: Date.now(), value });
  return value;
}

/** Public collection only. Every redirect has its own robots check; paid APIs use guardedFetch. */
export async function politeFetch(input: string, opts: GuardedFetchOptions = {}): Promise<GuardedResponse> {
  let url = new URL(input);
  // Local fake services retain the normal SSRF check without querying production crawl state.
  if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return guardedFetch(input, opts);
  const initialOrigin = url.origin;
  const publicHeaders = new Set(["accept","accept-language","accept-encoding","user-agent","cache-control","if-modified-since","if-none-match","range","if-range"]);
  const protectedRequest = opts.redirectPolicy === "same-origin" || opts.body !== undefined || Object.keys(opts.headers ?? {}).some(k => !publicHeaders.has(k.toLowerCase()));
  let current = { ...opts };
  for (let hop = 0; ; hop++) {
    const rules = await policy(url.origin);
    if (rules.parser.isAllowed(url.href, SITE.crawlerName) === false) throw new CollectionDeniedError(`robots.txt disallows ${url.origin}${url.pathname}`);
    const res = await request(url, rules.intervalMs, current);
    if ([401,403,429,202].includes(res.status) || /html/i.test(res.headers.get("content-type") ?? "") && /<title[^>]*>[^<]*(?:验证码|安全验证|访问受限|频繁访问|Just a moment|Access Denied)/i.test(res.text()))
      throw new CollectionDeniedError(`Collection access restriction (${res.status}) at ${url.origin}${url.pathname}`);
    if (![301,302,303,307,308].includes(res.status) || !res.headers.get("location")) return res;
    if (hop >= (opts.maxRedirects ?? 5)) throw new Error("Too many collection redirects");
    const next = new URL(res.headers.get("location")!, url);
    if (protectedRequest && next.origin !== initialOrigin) throw new Error("Blocked cross-origin redirect for a protected collection request");
    if ([301,302,303].includes(res.status) && (current.method ?? "GET").toUpperCase() === "POST") {
      const headers = { ...current.headers };
      for (const key of Object.keys(headers)) if (key.toLowerCase().startsWith("content-")) delete headers[key];
      current = { ...current, method: "GET", body: undefined, headers };
    }
    url = next;
  }
}
