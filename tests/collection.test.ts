// Collection picks up where it stopped: an X search longer than one run continues in later runs until
// it meets the old watermark (no post in between is skipped, no page is bought twice). The watermark
// alone bounds it: posts made weeks before the account was added are kept too.
import { stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { collectSource } from "@aihot/backend/sources/collect";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { politeFetch, CollectionDeniedError } from "@aihot/backend/sources/polite";

const T = tag();
const X_SOURCE = `test-x-${T}`;

test("collection respects robots and keeps the same site's interval across processes", async () => {
  const starts: number[] = [];
  let deniedHits = 0;
  const server = http.createServer((req,res) => {
    if(req.url==="/robots.txt") { res.end("User-agent: *\nDisallow: /blocked\n"); return; }
    if(req.url==="/blocked") deniedHits++;
    starts.push(performance.now()); res.end("public result");
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.2",resolve));
  const base=`http://127.0.0.2:${(server.address() as {port:number}).port}`;
  try {
    const childCode = `import {politeFetch} from '@aihot/backend/sources/polite'; import {closeDb} from '@aihot/backend/db'; await politeFetch(${JSON.stringify(base+"/child")}); await closeDb();`;
    await Promise.all([
      politeFetch(base+"/parent"),
      promisify(execFile)(process.execPath,["--input-type=module","-e",childCode],{cwd:process.cwd(),env:{...process.env,ALLOW_PRIVATE_NETWORK_FETCH:"true"}}),
    ]);
    assert.equal(starts.length,2);
    assert.ok(starts[1]-starts[0]>=5000,`request interval ${starts[1]-starts[0]} ms`);
    await assert.rejects(politeFetch(base+"/blocked"),CollectionDeniedError);
    assert.equal(deniedHits,0,"robots denial must stop before an article request");
  } finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
});

// SocialData: 45 posts newer than the watermark, newest first half a day apart, 2 a page; `cursor` is the page number.
const BASE = BigInt(Date.now()) * 1000n;
const WATERMARK = BASE + 100n;
const POSTS = Array.from({ length: 45 }, (_, i) => BASE + 145n - BigInt(i));
const tweet = (id: bigint) => ({
  id_str: String(id), tweet_created_at: new Date(Date.now() - Number(BASE + 145n - id) * 12 * 3_600_000).toISOString(),
  full_text: `Post ${id} ${T}`, lang: "en", user: { name: "Test account", screen_name: `acct${T}` },
});
const socialdata = await stub((_hit, req) => {
  const u = new URL(req.url, "http://stub");
  const since = BigInt(/since_id:(\d+)/.exec(u.searchParams.get("query") ?? "")?.[1] ?? "0");
  const page = Number(u.searchParams.get("cursor") ?? 0);
  const ids = POSTS.filter((id) => id > since);
  return { tweets: ids.slice(page * 2, page * 2 + 2).map(tweet), next_cursor: (page + 1) * 2 < ids.length ? String(page + 1) : null };
});

process.env.SOCIALDATA_BASE_URL = socialdata.url;
process.env.SOCIALDATA_API_KEY = "test-key";
config.allowPrivateNetworkFetch = true;

before(async () => {
  await sql`UPDATE budgets SET per_minute = 1000, per_hour = 10000, per_day = 100000 WHERE service = 'socialdata'`;
  await sql`INSERT INTO sources (id, name, kind, config, tier, participation_mode, cursor, next_fetch_at)
            VALUES (${X_SOURCE}, 'Test X', 'x_search', ${sql.json({ query: `from:acct${T}` })}, 'T1', 'editorial',
                    ${sql.json({ initializedAt: new Date().toISOString(), lastTweetId: String(WATERMARK) })}, '2100-01-01')`;
});
after(async () => {
  await socialdata.close();
  await stopBoss();
  await closeDb();
});

test("an X search longer than one run is read to the old watermark over the next runs", async () => {
  const stored = async () => Number((await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM articles WHERE source_id = ${X_SOURCE}`)[0]!.n);
  const cursor = async () => (await sql<{ cursor: { lastTweetId: string; xBacklog?: unknown[] } }[]>`SELECT cursor FROM sources WHERE id = ${X_SOURCE}`)[0]!.cursor;

  const first = await collectSource(X_SOURCE, { force: true });
  assert.equal(first.status, "ok");
  assert.equal(await stored(), 40, "a run reads its own pages and ten more of the stretch left over");
  assert.equal((await cursor()).lastTweetId, String(BASE + 145n), "the watermark moves to the newest post");
  assert.equal((await cursor()).xBacklog?.length, 1, "the unread stretch is kept for the next run");
  const [run] = await sql<{ detail: { truncated: boolean; backlog: number } }[]>`SELECT detail FROM fetch_runs WHERE source_id = ${X_SOURCE} ORDER BY id DESC LIMIT 1`;
  assert.deepEqual([run!.detail.truncated, run!.detail.backlog], [true, 1], "the admin sees the stretch still to read");

  const receipts = await sql`SELECT status FROM receipts WHERE service = 'socialdata' AND subject = ${`source:${X_SOURCE}`}`;
  assert.equal(receipts.length, 20);
  assert.ok(receipts.every((r) => r.status === "completed"), "stored pages complete with the saved coverage, including backlog pages");

  const second = await collectSource(X_SOURCE, { force: true });
  assert.equal(second.status, "ok");
  assert.equal(await stored(), 45, "every post between the old watermark and the newest is stored");
  assert.equal((await cursor()).xBacklog, undefined, "nothing is left to read");
  assert.equal(socialdata.hits(), 20 + 1 + 3, "no page is requested twice");
});
