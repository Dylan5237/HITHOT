// Observed (讯飞医疗 news list, 2026-10): asked with an Accept header that names JSON, the server
// returned the whole HTML page as one JSON string, and the listing matched no items.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { config } from "@aihot/backend/config";
import { fetchWebList, unwrapJsonHtml } from "@aihot/backend/sources/web-list";
import type { SourceRow } from "@aihot/backend/sources/types";

const previousDispatcher = getGlobalDispatcher();
const previousPrivate = config.allowPrivateNetworkFetch;
const previousProxy = config.egressProxyUrl;
const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);
config.allowPrivateNetworkFetch = true;
config.egressProxyUrl = null;
after(async () => {
  config.allowPrivateNetworkFetch = previousPrivate;
  config.egressProxyUrl = previousProxy;
  setGlobalDispatcher(previousDispatcher);
  await mockAgent.close();
});

const origin = "https://publisher.invalid";
const page = `<!doctype html>\n<html><body><ul>
  <li class="big"><a href="/news/181/1108.html#minban"><div class="time">06-05</div><div class="tit">数智潮涌，AI赋能基层健康服务</div></a></li>
  <li><a href="/news/181/1099.html#minban"><div class="time">05-18</div><div class="tit">讯飞医疗亮相医管局研讨大会</div></a></li>
</ul></body></html>`;

test("a listing served as a JSON string of HTML is read as that HTML", async () => {
  mockAgent.get(origin).intercept({ path: "/news/181.html" }).reply(200, JSON.stringify(page), { headers: { "content-type": "text/html; charset=utf-8" } });
  const source = {
    id: "json-wrapped", kind: "web_list", cursor: null, participation_mode: "editorial",
    config: { url: `${origin}/news/181.html`, parseMode: "html", itemSelector: "li:has(a[href*='/news/181/'])", linkSelector: "a", titleSelector: ".tit", allowUrlPrefixes: [`${origin}/news/181/`] },
  } as unknown as SourceRow;
  const items = await fetchWebList(source);
  assert.deepEqual(items.map((i) => i.title), ["数智潮涌，AI赋能基层健康服务", "讯飞医疗亮相医管局研讨大会"]);
});

test("other JSON and ordinary HTML pass through unchanged", () => {
  for (const text of ['"plain text"', '{"items":[]}', '"<unterminated', "<html></html>", " \"<p>x</p>\" trailing"]) assert.equal(unwrapJsonHtml(text), text);
  assert.equal(unwrapJsonHtml(JSON.stringify("<html>x</html>")), "<html>x</html>");
});
