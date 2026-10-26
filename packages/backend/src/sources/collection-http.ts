import type { GuardedFetchOptions } from "../lib/http-fetch.ts";

/** Lazy I/O boundary: callers and fake-service tests do not initialize runtime config merely by installing a transport. */
export const collectionHttp = {
  fetch: async (url: string, opts: GuardedFetchOptions = {}) => (await import("./polite.ts")).politeFetch(url, opts),
};
