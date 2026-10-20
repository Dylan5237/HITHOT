// Topic pages: which articles a topic takes, and their counts.
// Written before the code, from the ways it can go wrong:
// - a company topic takes an article about another company that only mentions it (several subjects,
//   its name nowhere in the title), or drops one about it whose title names it in English, in another
//   case, next to Chinese text, or only by a product (it is the article's only subject);
// - a Latin name matches inside another word ("Epicenter" is not Epic); a headline naming a company
//   that is not a subject of the article gets in;
// - a technical-direction topic stops taking its tags;
// - withdrawn or not yet released articles appear in a list or a count;
// - an article or story page names a topic its reports do not belong to;
// - a topic without content has no page, or an unknown slug or a page past the end has one.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { publishArticle } from "@aihot/backend/publication/publish";
import { TOPICS, loadTopicPage, listTopicSummaries, topicsOfStory } from "@aihot/backend/publication/topics";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const OFFICIAL = `test-topics-official-${T}`;
const MEDIA = `test-topics-media-${T}`;
const app = await buildApp();

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, next_fetch_at) VALUES
    (${OFFICIAL}, 'Official', 'rss', 'T1', 'editorial', true, '2100-01-01'),
    (${MEDIA}, 'Media', 'rss', 'T2', 'editorial', false, '2100-01-01')`;
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

let n = 0;
interface Report {
  source?: string;
  at: Date;
  title: string;
  originalTitle?: string;
  subjects?: string[];
  tags?: string[];
  score?: number;
  selected?: boolean;
  fact?: number;
  category?: string;
}

/** A published report; `fact` links it to a fact before publishing, as grouping would. */
async function report(r: Report): Promise<string> {
  n += 1;
  const { articleId } = await upsertMaterial({
    sourceId: r.source ?? MEDIA, url: `https://example.com/topics-${T}-${n}`, title: r.originalTitle ?? r.title, bodyText: "body", bodyHtml: "<p>body</p>", bodyStatus: "ok", via: "fetch", publishedAt: r.at,
  });
  await sql`UPDATE articles SET discovered_at = ${r.at}, timeline_at = ${r.at}, grouped_at = now() WHERE id = ${articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
            VALUES (${articleId}, 1, 'rule', 'pass', ${r.category ?? "policy"}, ${r.title}, ${`摘要 ${n}`}, ${r.score ?? 80}, ${r.selected ?? true}, ${r.subjects ?? []}, ${[r.category === "products" ? "产品发布" : r.category === "research" ? "研究/报告" : r.category === "opinion" ? "建设实践" : r.category === "industry" ? "企业经营" : r.category === "opinion" ? "观点解读" : "政策发布", ...(r.tags ?? [])]})`;
  if (r.fact) await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES (${r.fact}, ${articleId}, 'report')`;
  await publishArticle(articleId, { releasedAt: new Date(r.at.getTime() + 60_000) });
  return articleId;
}

async function story(title: string): Promise<{ id: number; publicId: string }> {
  const publicId = randomUUID();
  const [s] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title, first_report_at, latest_at) VALUES (${publicId}, ${title}, now(), now()) RETURNING id`;
  return { id: s!.id, publicId };
}

async function fact(storyId: number | null, title: string): Promise<number> {
  const [f] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, story_id, title) VALUES (${`f-${T}-${randomUUID()}`}, ${storyId}, ${title}) RETURNING id`;
  return f!.id;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);
const page = async (slug: string, p = 1) => {
  const data = await loadTopicPage(slug, p, new Date());
  assert.ok(data, `${slug} page ${p}`);
  return data;
};
/** Every article of a topic, over all its pages. */
async function members(slug: string): Promise<string[]> {
  const first = await page(slug);
  const out = ids(first.items);
  for (let p = 2; p <= first.pageCount; p++) out.push(...ids((await page(slug, p)).items));
  return out;
}

test("a company topic takes the articles about it, not the ones that only mention it", async () => {
  const about = await report({ at: hoursAgo(30), title: `Dragon Copilot 推出插件 ${T}`, subjects: ["microsoft"] });
  const product = await report({ at: hoursAgo(31), title: `Sonnet 新版上线 ${T}`, subjects: ["microsoft"] });
  const english = await report({ at: hoursAgo(32), title: `新政策发布 ${T}`, originalTitle: `Microsoft launches a model ${T}`, subjects: ["microsoft", "oracle-health"] });
  const subpoena = await report({ at: hoursAgo(33), title: `加州检察长向 Oracle Health 发出传票 ${T}`, subjects: ["oracle-health", "microsoft", "wonders"] });
  const lowerCase = await report({ at: hoursAgo(34), title: `oracle health 公布新的安全框架 ${T}`, subjects: ["oracle-health", "microsoft"] });
  const pact = await report({ at: hoursAgo(35), title: `二十余家科技公司签署安全协议 ${T}`, subjects: ["oracle-health", "microsoft", "google"] });
  const metadata = await report({ at: hoursAgo(36), title: `Epicenter 标准发布，Oracle Health 参与 ${T}`, subjects: ["epic", "oracle-health"] });
  const adjacent = await report({ at: hoursAgo(37), title: `发布Epic的新模型 ${T}`, subjects: ["epic", "oracle-health"] });
  const headline = await report({ at: hoursAgo(38), title: `Microsoft 被一篇盘点提到 ${T}`, subjects: ["google"] });
  const agent = await report({ at: hoursAgo(39), title: `智能体框架发布 ${T}`, tags: ["医疗大模型"] });

  const anthropic = await members("microsoft");
  for (const id of [about, product, english]) assert.ok(anthropic.includes(id), "about Microsoft");
  for (const id of [subpoena, lowerCase, pact, headline]) assert.ok(!anthropic.includes(id), "only mentions Microsoft");
  const openai = await members("oracle-health");
  for (const id of [subpoena, lowerCase, metadata]) assert.ok(openai.includes(id), "about Oracle Health");
  for (const id of [english, pact]) assert.ok(!openai.includes(id), "only mentions Oracle Health");
  const meta = await members("epic");
  assert.ok(meta.includes(adjacent), "Epic next to Chinese text");
  assert.ok(!meta.includes(metadata), "Epicenter is not Epic");
  assert.ok((await members("med-llm")).includes(agent), "a technical direction takes its tag");

  // The article page names the topics it belongs to.
  const topicsOf = async (id: string) => {
    const res = await app.inject({ method: "GET", url: `/api/site/items/${id}` });
    return (JSON.parse(res.body) as { topics: Array<{ slug: string }> }).topics.map((t) => t.slug);
  };
  assert.deepEqual(await topicsOf(about), ["microsoft", "policies"]);
  assert.deepEqual(await topicsOf(subpoena), ["oracle-health", "policies"]);
  assert.deepEqual(await topicsOf(pact), ["policies"]);
  assert.deepEqual(await topicsOf(agent), ["med-llm", "policies"]);
});

test("a story page names the topics of its reports", async () => {
  const launch = await story(`智能体框架 V2 发布 ${T}`);
  await report({ source: OFFICIAL, at: hoursAgo(26), title: `智能体框架 V2 发布 ${T}`, tags: ["医疗大模型"], fact: await fact(launch.id, "发布 V2") });
  assert.deepEqual(await topicsOfStory(launch.id), [{ slug: "med-llm", name: "医疗大模型" }, { slug: "policies", name: "政策发布" }]);
});

test("withdrawn articles stay out of lists and counts", async () => {
  const kept = await report({ at: hoursAgo(5), title: `腾讯健康 发布新模型 ${T}`, subjects: ["tencent-health"] });
  const withdrawn = await report({ at: hoursAgo(4), title: `腾讯健康 撤回的消息 ${T}`, subjects: ["tencent-health"] });
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${withdrawn}`;

  const data = await page("tencent-health");
  assert.deepEqual(ids(data.items), [kept]);
  assert.equal(data.topic.total, 1);
  const summary = (await listTopicSummaries()).topics.find((t) => t.slug === "tencent-health")!;
  assert.equal(summary.latest?.title, `腾讯健康 发布新模型 ${T}`, "the index shows the newest public article");
});

test("every topic has a page; unknown topics and pages past the end have none", async () => {
  const empty = await page("united-imaging");
  assert.equal(empty.topic.indexable, false, "a topic without content is not indexed");
  assert.deepEqual(empty.items, []);
  assert.equal(await loadTopicPage("not-a-topic", 1, new Date()), null);
  assert.equal(await loadTopicPage("united-imaging", 2, new Date()), null);
  const index = await app.inject({ method: "GET", url: "/api/site/topics" });
  const body = JSON.parse(index.body) as { groups: Array<{ key: string }>; topics: Array<{ slug: string }> };
  assert.deepEqual(body.groups.map((g) => g.key), ["company", "field", "genre"]);
  assert.deepEqual(body.topics.map((t) => t.slug).sort(), TOPICS.map((t) => t.slug).sort(), "the index lists every topic");
});
