// The judging and writing steps (editorial/analyze.ts): the prefilter decides relevance, two scores
// against the tier threshold decide 精选, selected and near-selected items are written by the content
// understanding and the rest by the title/summary translation, a structure step gives the category,
// subjects and fact. Material with only a feed summary has its page fetched first.
import { pointModels, Reply, stub, tag } from "./setup.ts";
import { analysisStep, type AnalysisStep } from "./analysis-steps.ts";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { analyzeArticle, buildMaterial, loadAnalyzeInput, normalizeStructure, reselectArticle, StructureSchema, tierThreshold, UNDERSTAND_FLOOR } from "@aihot/backend/editorial/analyze";
import { queueProcessing, registerContentJobs } from "@aihot/backend/jobs/content";
import { getBoss, QUEUES, stopBoss } from "@aihot/backend/jobs/queue";
import { compactAnswerFirstSummary, enforceIdentity, MAX_BODY_CHARS, parseTranslateOutput } from "@aihot/backend/editorial/writing";
import { READER_WORDING } from "@aihot/industry/wording";
import { ITEM_TYPES } from "@aihot/industry/taxonomy";
import { SELECTION } from "@aihot/industry/selection";

const T = tag();
const SOURCE = `test-analyze-${T}`;
const X_SOURCE = `test-analyze-x-${T}`;

interface Req { step: AnalysisStep; marker: string; user: string }
const requests: Req[] = [];
const MARKERS = ["CLEAR", "RESCUE", "LOW", "OFFTOPIC", "BARE", "VAGUE", "THIN", "SENSITIVE", "RESELECT", "NEGATIVE", "推文", "WORDY", "REFUSAL", "RENUMBER", "UNMENDED"];
// The scores sit a few points around the pack's T1 threshold and understand floor, so each case means
// the same after a site recalibrates them: selected when the two add up to 2 × T1, written like a
// selected item when they add up to more than 2 × FLOOR, translated otherwise.
const T1 = tierThreshold("T1")!;
const FLOOR = UNDERSTAND_FLOOR;
const LOWERED = Math.min(T1, FLOOR - 3);
const scoreAnswers: Record<string, number[]> = {
  CLEAR: [T1 + 3, T1 - 1], RESCUE: [FLOOR + 1, FLOOR], LOW: [Math.min(FLOOR, T1) - 1, Math.min(FLOOR, T1) - 2], THIN: [T1, T1], SENSITIVE: [T1, T1], 推文: [Math.min(FLOOR, T1) - 1, Math.min(FLOOR, T1) - 2],
  BARE: [FLOOR - 2, FLOOR - 4], VAGUE: [T1, T1 + 2], WORDY: [T1, T1], REFUSAL: [T1, T1], RENUMBER: [T1, T1], UNMENDED: [T1, T1],
  RESELECT: [LOWERED + 1, LOWERED], NEGATIVE: [T1, T1],
};

const WORDY = ["WORDY", "REFUSAL", "RENUMBER", "UNMENDED"];

// One stub stands in for DashScope (prefilter, structure), Zhipu (score, understand) and 讯飞医疗 (summarize).
const provider = await stub((_hit, req) => {
  const body = JSON.parse(req.body) as { messages: Array<{ role: string; content: unknown }> };
  const last = body.messages[body.messages.length - 1]!.content;
  const user = typeof last === "string" ? last : JSON.stringify(last);
  const step = analysisStep(req.body);
  const marker = MARKERS.find((m) => user.includes(m)) ?? "";
  requests.push({ step, marker, user });
  const answer = (content: unknown) => ({ id: `stub-${requests.length}`, model: "stub", choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
  if (step === "prefilter") return answer({ label: marker === "OFFTOPIC" || marker === "BARE" ? "BLOCK" : marker === "VAGUE" ? "UNKNOWN" : "PASS", reason: "测试" });
  if (step === "score") return answer({ attentionScore: scoreAnswers[marker]!.shift() });
  // Copy with a word a site keeps from readers (added to the pack's list below), and its mended form: whole (WORDY),
  // refused by the provider, with a number changed, or with as many such words as before.
  if (step === "understand" && WORDY.includes(marker)) return answer({ itemType: ITEM_TYPES[0], authorRole: "principal", tags: [], editorialJudgment: `理由里有禁用词 ${marker}`, titleZh: `标题里有禁用词 ${marker}`, summaryZh: `${marker} 的摘要。第二句补充 3 个数字。` });
  // A refusal in a provider's own words: each provider words its own, and the same request would meet it again.
  if (step === "wording" && marker === "REFUSAL") return new Reply(400, { error: { message: "request refused", type: "invalid_request_error" } });
  if (step === "wording") {
    const unmended = marker === "UNMENDED" ? "有禁用词" : "换了说法";
    return answer({ titleZh: `标题里${unmended} ${marker}`, summaryZh: `${marker} 的摘要。第二句补充 ${marker === "RENUMBER" ? 4 : 3} 个数字。`, reasonZh: `理由里${unmended} ${marker}` });
  }
  if (step === "understand") {
    if (marker === "SENSITIVE") return new Reply(400, { contentFilter: [{ level: 1, role: "user" }], error: { code: "1301", message: "系统检测到输入或生成内容可能包含不安全或敏感内容" } });
    return answer({ itemType: "policy_release", authorRole: "principal", tags: ["政策发布", "开源", "医疗大模型", "不存在的标签"], editorialJudgment: `理由 ${marker}`, titleZh: `理解标题 ${marker}`, summaryZh: `理解摘要 ${marker}。第二句补充一个关键数字。` });
  }
  if (step === "structure") return answer({ category: "policy", tags: ["政策发布", "电子病历"], subjects: ["microsoft", "unknown-co"], scope: "single", fact: { title: `事实 ${marker}`, subject: "某公司", action: "发布", object: "模型", occurredAt: null, evidence: "a lab released a model", conditions: [] } });
  return answer(`title_zh: 翻译标题 ${marker}\nsummary_zh: 翻译摘要 ${marker}。第二句补充影响。`);
});
pointModels(provider.url);

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at) VALUES
    (${SOURCE}, 'Test analyze source', 'rss', 'T1', 'editorial', '2100-01-01'),
    (${X_SOURCE}, 'Test X account', 'x_search', 'T1', 'editorial', '2100-01-01')`;
});
after(async () => {
  await provider.close();
  await stopBoss();
  await closeDb();
});

// The tag keeps each material unique: identical input would reuse an earlier run's paid answers.
const LONG = "a lab released a model with a benchmark table and pricing details. ".repeat(8);
const article = async (marker: string, extra: Record<string, unknown> = {}) =>
  (await upsertMaterial({
    sourceId: SOURCE, url: `https://example.com/${marker}-${T}`, title: `${marker} model release ${T}`, bodyText: `${marker}: ${LONG} (${T})`,
    bodyStatus: "ok", via: "fetch", publishedAt: new Date("2026-09-28T01:02:03Z"), ...extra,
  } as never)).articleId;
const calls = (marker: string) => requests.filter((r) => r.marker === marker).map((r) => r.step);
const row = async (id: string) =>
  (await sql<{ selected: boolean; relevance: string; score: string | null; title_zh: string; reason_zh: string | null; category: string | null; tags: string[]; subjects: string[]; receipt_ids: string[]; output: Record<string, any> }[]>`
    SELECT selected, relevance, score, title_zh, reason_zh, category, tags, subjects, receipt_ids, output FROM analyses WHERE article_id = ${id} ORDER BY id DESC LIMIT 1`)[0]!;

test("a selected item: prefilter, two scores, the content understanding and the structure", async () => {
  assert.ok(FLOOR >= 4 && FLOOR <= 97 && T1 >= 4 && T1 <= 97, "the cases need a few valid score points either side of the floor and threshold");
  const id = await article("CLEAR");
  const res = await analyzeArticle(id);
  assert.deepEqual([res!.output!.selected, res!.output!.score], [true, T1 + 1], `${T1 + 3} + ${T1 - 1} >= 2 × ${T1}; the mean is shown`);
  assert.deepEqual(calls("CLEAR").sort(), ["prefilter", "score", "score", "structure", "understand"]);
  const r = await row(id);
  assert.deepEqual([r.title_zh, r.reason_zh, r.category, r.receipt_ids.length], ["理解标题 CLEAR", "理由 CLEAR", "policy", 5]);
  // Failure case: the writer's independent labels contradict the structural category.
  assert.deepEqual(r.tags, ["政策发布", "电子病历", "Microsoft"], "category and tags come from the same structural judgement, plus the verified subject tag");
  assert.deepEqual(r.subjects, ["microsoft"]);
  assert.deepEqual([r.output.writer, r.output.itemType, r.output.prefilter.label, r.output.fact.title], ["understand", "policy_release", "PASS", "事实 CLEAR"]);
  assert.equal(r.output.scope, "single");
  assert.equal(r.output.fact.evidence, "a lab released a model");
  const score = requests.find((q) => q.marker === "CLEAR" && q.step === "score")!;
  assert.match(score.user, /【标题】\nCLEAR model release/, "the score reads the original title, before any writing");
});

test("a word the site keeps from readers goes back once to be changed; copy without one is not sent", async () => {
  // A word only this test bans: the pack's list is the site's own (empty in the template).
  (READER_WORDING as Array<readonly [RegExp, string]>).push([/禁用词/u, "换一个说法"]);
  try {
    const id = await article("WORDY");
    await analyzeArticle(id);
    assert.equal(calls("WORDY").filter((s) => s === "wording").length, 1);
    const r = await row(id);
    assert.deepEqual([r.title_zh, r.reason_zh], ["标题里换了说法 WORDY", "理由里换了说法 WORDY"], "the mended copy is stored");
    const sent = requests.find((q) => q.marker === "WORDY" && q.step === "wording")!;
    assert.ok(sent.user.includes("标题用了“禁用词”") && sent.user.includes("推荐理由用了“禁用词”"), "each use named");
    assert.ok(!requests.some((q) => q.step === "wording" && q.marker !== "WORDY"), "the other items' copy uses none");
  } finally {
    (READER_WORDING as Array<readonly [RegExp, string]>).pop();
  }
});

test("the first copy stands when the provider refuses the mend, the mend changes a number or leaves as many such words", async () => {
  (READER_WORDING as Array<readonly [RegExp, string]>).push([/禁用词/u, "换一个说法"]);
  try {
    for (const marker of ["REFUSAL", "RENUMBER", "UNMENDED"]) {
      const id = await article(marker);
      await analyzeArticle(id);
      const r = await row(id);
      assert.deepEqual([r.title_zh, r.reason_zh], [`标题里有禁用词 ${marker}`, `理由里有禁用词 ${marker}`], `${marker}: the first copy is stored`);
      assert.equal(calls(marker).filter((s) => s === "wording").length, 1, `${marker}: mended once`);
      const [receipt] = await sql<{ status: string }[]>`SELECT status FROM receipts WHERE purpose = 'mend_wording' AND subject LIKE ${`article:${id}@%`}`;
      assert.equal(receipt!.status, marker === "REFUSAL" ? "failed" : "completed", `${marker}: the mend's receipt`);
    }
  } finally {
    (READER_WORDING as Array<readonly [RegExp, string]>).pop();
  }
});

test("structure retains grounded conditions, rejects invented or unseen quotes, and does not infer missing scope", async () => {
  const input = (await loadAnalyzeInput(await article("CONDITIONS", {
    bodyText: "Preview is free for Pro users until October 10.\n" + "x".repeat(11000) + "\nOnly available in the US. " + "x".repeat(MAX_BODY_CHARS) + "This late detail was not sent.",
  })))!;
  input.translationZh = "仅中文译文中出现的限制";
  const frame = { title: "预览上线", evidence: "Preview is free for Pro users until October 10.", conditions: [
    { text: "仅Pro用户，免费至10月10日", quote: "Preview is free for Pro users until October 10." },
    { text: "仅限美国", quote: "Only available in the US." },
    { text: "无限免费", quote: "Unlimited free access for everyone." },
    { text: "不在模型输入里的句子", quote: "This late detail was not sent." },
  ] };
  const base = { category: "policy", tags: [], subjects: [], fact: frame };
  const out = normalizeStructure(StructureSchema.parse(base), input);
  assert.ok(buildMaterial(input).includes("Only available in the US."), "a condition after the old 7000-character cutoff reaches the model");
  assert.ok(buildMaterial(input).includes("后文未提供"));
  assert.equal(out.scope, "unknown", "an older result with a fact is not proof of single scope");
  assert.deepEqual(out.fact?.conditions, frame.conditions.slice(0, 2));
  assert.equal(out.fact?.evidence, frame.evidence);
  const partial = normalizeStructure(StructureSchema.parse({ ...base, fact: { ...frame, conditions: [
    { quote: "x".repeat(401) },
    { quote: "Preview is free... until October 10." },
    { quote: "Only available in the US." },
  ] } }), input);
  assert.deepEqual(partial.fact?.conditions, [{ text: "Only available in the US.", quote: "Only available in the US." }],
    "an invalid sibling cannot discard a valid original condition; spliced quotes remain rejected");
  const invented = normalizeStructure(StructureSchema.parse({ ...base, fact: { ...frame, evidence: input.source.name, conditions: [{ text: "翻译限制", quote: input.translationZh }] } }), input);
  assert.equal(invented.fact?.evidence, null, "source metadata is not original evidence");
  assert.deepEqual(invented.fact?.conditions, [], "a translation does not count as an original quote");
  assert.equal(normalizeStructure(StructureSchema.parse({ ...base, scope: "composite" }), input).fact, null, "composite output cannot also claim one fact");
  const titleOnly = normalizeStructure(StructureSchema.parse({ ...base, scope: "single" }), { ...input, bodyText: null, excerpt: null });
  assert.equal(titleOnly.scope, "unknown", "a confident model cannot supply the missing original material");
  assert.equal(titleOnly.fact, null);
});

test("a near-selected item is written like a selected one; below the floor it is translated", async () => {
  const near = await analyzeArticle(await article("RESCUE"));
  assert.deepEqual([near!.output!.selected, near!.output!.reasonZh], [2 * FLOOR + 1 >= 2 * T1, "理由 RESCUE"], `${FLOOR + 1} + ${FLOOR} > 2 × ${FLOOR}`);
  const lowId = await article("LOW");
  const low = await analyzeArticle(lowId);
  assert.deepEqual([low!.output!.selected, low!.output!.titleZh, low!.output!.reasonZh], [false, "翻译标题 LOW", null]);
  assert.deepEqual(calls("LOW").sort(), ["prefilter", "score", "score", "structure", "summarize"]);
  assert.deepEqual((await row(lowId)).tags, ["政策发布", "电子病历", "Microsoft"], "structure tags");
});

test("selection-only rechecks a lower threshold without replacing copy or making paid requests", async () => {
  const previousThreshold = SELECTION.thresholds.T1;
  try {
    SELECTION.thresholds.T1 = FLOOR + 5;
    const id = await article("RESELECT");
    await assert.rejects(queueProcessing(id, { step: "selection" }), /analyzed or blocked/,
      "an unjudged article cannot enter the zero-call queue and later fall through to the normal sweep");
    const first = await analyzeArticle(id);
    assert.equal(first!.output!.selected, false);
    const [original] = await sql<{ id: number; title_zh: string; summary_zh: string; reason_zh: string | null; receipt_ids: number[]; output: Record<string, unknown> }[]>`
      SELECT id, title_zh, summary_zh, reason_zh, receipt_ids, output FROM analyses WHERE article_id = ${id} ORDER BY id DESC LIMIT 1`;
    assert.equal(original!.output.writer, "summarize", "the high threshold and floor used the cheap copy path");
    await sql`UPDATE articles SET grouping_status = 'complete', grouped_at = now(), selection_adds_value = true, backfill = false WHERE id = ${id}`;
    const boss = await getBoss();
    const downstream = [QUEUES.group, QUEUES.digest, QUEUES.notifySelected, QUEUES.prepareMedia];
    const [jobsBefore] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pgboss.job WHERE name = ANY(${downstream})`;
    const [paidBefore] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM receipt_attempts ra JOIN receipts r ON r.id = ra.receipt_id
      WHERE r.subject LIKE ${`article:${id}@%`}`;
    const hitsBefore = requests.length;
    const providerHitsBefore = provider.hits();
    SELECTION.thresholds.T1 = LOWERED;
    const changed = await reselectArticle(id);
    assert.equal(changed?.selected, true);
    const [next] = await sql<{ id: number; origin: string; selected: boolean; title_zh: string; summary_zh: string; reason_zh: string | null; receipt_ids: number[]; output: Record<string, unknown> }[]>`
      SELECT id, origin, selected, title_zh, summary_zh, reason_zh, receipt_ids, output
      FROM analyses WHERE article_id = ${id} ORDER BY id DESC LIMIT 1`;
    assert.deepEqual([next!.origin, next!.selected, next!.output.threshold, next!.output.reselectedFrom], ["rule", true, LOWERED, original!.id]);
    assert.deepEqual([next!.title_zh, next!.summary_zh, next!.reason_zh, next!.receipt_ids, next!.output.writer, next!.output.scores],
      [original!.title_zh, original!.summary_zh, original!.reason_zh, original!.receipt_ids, "summarize", original!.output.scores]);
    assert.deepEqual(await reselectArticle(id), changed, "a repeated selection job does not append another analysis");
    assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 2);
    const [paidAfter] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM receipt_attempts ra JOIN receipts r ON r.id = ra.receipt_id
      WHERE r.subject LIKE ${`article:${id}@%`}`;
    assert.equal(paidAfter!.count, paidBefore!.count, "no new paid attempt");
    assert.equal(requests.length, hitsBefore, "the provider was not contacted");
    assert.equal(provider.hits(), providerHitsBefore);
    const [publication] = await sql<{ analysis_id: number; selection_candidate: boolean; selected: boolean }[]>`
      SELECT analysis_id, selection_candidate, selected FROM publications WHERE article_id = ${id}`;
    assert.deepEqual([publication!.analysis_id, publication!.selection_candidate, publication!.selected], [next!.id, true, true],
      "publication uses the new judgement and retains the completed grouping decision");
    const jobId = await queueProcessing(id, { step: "selection" });
    assert.ok(jobId);
    const [job] = await sql<{ name: string; data: Record<string, unknown> }[]>`
      SELECT name, data FROM pgboss.job WHERE data->>'articleId' = ${id} ORDER BY created_on DESC LIMIT 1`;
    assert.deepEqual([job!.name, job!.data.selectionOnly, job!.data.attemptTag], [QUEUES.analyze, true, undefined]);
    try {
      await registerContentJobs(boss);
      for (const worker of boss.getWipData()) if (worker.name === QUEUES.analyze) boss.notifyWorker(worker.id);
      const deadline = Date.now() + 10_000;
      let state: string | undefined;
      while (Date.now() < deadline) {
        state = (await sql<{ state: string }[]>`SELECT state FROM pgboss.job WHERE id = ${jobId}`)[0]?.state;
        if (state === "completed" || state === "failed") break;
        await delay(20);
      }
      assert.equal(state, "completed", "selection-only job must settle within ten seconds");
    } finally {
      await boss.offWork(QUEUES.analyze, { wait: true });
    }
    assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 2,
      "the worker reused the completed reselection");
    const [paidWorkerAfter] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM receipt_attempts ra JOIN receipts r ON r.id = ra.receipt_id
      WHERE r.subject LIKE ${`article:${id}@%`}`;
    assert.equal(paidWorkerAfter!.count, paidBefore!.count);
    assert.equal(provider.hits(), providerHitsBefore);
    assert.equal((await sql`SELECT 1 FROM pgboss.job WHERE name = ${QUEUES.group} AND data->>'articleId' = ${id}`).length, 0,
      "selection-only never schedules event grouping");
    const [jobsAfter] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pgboss.job WHERE name = ANY(${downstream})`;
    assert.equal(jobsAfter!.count, jobsBefore!.count, "selection-only never schedules grouping, digest, push or media preparation");
  } finally {
    SELECTION.thresholds.T1 = previousThreshold;
  }
});

test("selection-only retains blocked and unmaterialized articles without scoring", async () => {
  for (const [marker, extra, relevance] of [
    ["OFFTOPIC", { url: `https://example.com/reblock-${T}` }, "block"],
    ["BARE", { url: `https://example.com/reunknown-${T}`, bodyText: null, excerpt: null, bodyStatus: "none" }, "unknown"],
  ] as const) {
    const id = await article(marker, extra);
    await analyzeArticle(id);
    const hitsBefore = requests.length;
    const changed = await reselectArticle(id);
    const next = await row(id);
    assert.deepEqual([changed!.selected, next.relevance, next.selected, next.output.threshold], [false, relevance, false, null]);
    assert.equal(requests.length, hitsBefore);
  }
});

test("selection-only fails closed when a score receipt, prompt or model does not match", async () => {
  const id = await article("NEGATIVE");
  await analyzeArticle(id);
  const [original] = await sql<{ id: number; receipt_ids: number[]; prompt_version: string; score: number; output: Record<string, unknown> }[]>`
    SELECT id, receipt_ids, prompt_version, score, output FROM analyses WHERE article_id = ${id} ORDER BY id DESC LIMIT 1`;
  const [scoreReceipt] = await sql<{ id: number; model: string; request: Record<string, unknown> }[]>`
    SELECT id, model, request FROM receipts WHERE id = ANY(${original!.receipt_ids}) AND purpose = 'score_article' ORDER BY id LIMIT 1`;
  const hitsBefore = requests.length;
  const providerHitsBefore = provider.hits();
  const [paidBefore] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM receipt_attempts ra JOIN receipts r ON r.id = ra.receipt_id
    WHERE r.subject LIKE ${`article:${id}@%`}`;
  try {
    await sql`UPDATE analyses SET receipt_ids = '{}'::bigint[] WHERE id = ${original!.id}`;
    await assert.rejects(reselectArticle(id), /matching completed score receipts/);
    await sql`UPDATE analyses SET receipt_ids = ${original!.receipt_ids}, prompt_version = 'old-prompt' WHERE id = ${original!.id}`;
    await assert.rejects(reselectArticle(id), /current-prompt model analysis/);
    await sql`UPDATE analyses SET prompt_version = ${original!.prompt_version}, output = ${sql.json({ ...original!.output, scoreModel: "other-model" } as never)} WHERE id = ${original!.id}`;
    await assert.rejects(reselectArticle(id), /current model/);
    await sql`UPDATE analyses SET output = ${sql.json(original!.output as never)} WHERE id = ${original!.id}`;
    await sql`UPDATE receipts SET model = 'other-model' WHERE id = ${scoreReceipt!.id}`;
    await assert.rejects(reselectArticle(id), /matching completed score receipts/);
    await sql`UPDATE receipts SET model = ${scoreReceipt!.model}, request = ${sql.json({ ...scoreReceipt!.request, promptVersion: "old-score-prompt" } as never)}
      WHERE id = ${scoreReceipt!.id}`;
    await assert.rejects(reselectArticle(id), /matching completed score receipts/);
    await sql`UPDATE receipts SET request = ${sql.json({ ...scoreReceipt!.request, userHash: "wrong-material" } as never)}
      WHERE id = ${scoreReceipt!.id}`;
    await assert.rejects(reselectArticle(id), /matching completed score receipts/);
    await sql`UPDATE receipts SET request = ${sql.json(scoreReceipt!.request as never)} WHERE id = ${scoreReceipt!.id}`;
    const scores = original!.output.scores as number[];
    await sql`UPDATE analyses SET output = ${sql.json({ ...original!.output, scores: [scores[0]! + 1, scores[1]! - 1] } as never)}
      WHERE id = ${original!.id}`;
    await assert.rejects(reselectArticle(id), /score values differ from receipts/);
    await sql`UPDATE analyses SET output = ${sql.json(original!.output as never)}, score = 99 WHERE id = ${original!.id}`;
    await assert.rejects(reselectArticle(id), /score differs from its original values/);
  } finally {
    await sql`UPDATE analyses SET output = ${sql.json(original!.output as never)}, prompt_version = ${original!.prompt_version},
      receipt_ids = ${original!.receipt_ids}, score = ${original!.score} WHERE id = ${original!.id}`;
    await sql`UPDATE receipts SET model = ${scoreReceipt!.model}, request = ${sql.json(scoreReceipt!.request as never)} WHERE id = ${scoreReceipt!.id}`;
  }
  assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 1, "rejected checks append nothing");
  assert.equal(requests.length, hitsBefore, "rejected checks never reach a provider");
  assert.equal(provider.hits(), providerHitsBefore);
  const [paidAfter] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM receipt_attempts ra JOIN receipts r ON r.id = ra.receipt_id
    WHERE r.subject LIKE ${`article:${id}@%`}`;
  assert.equal(paidAfter!.count, paidBefore!.count);
});

test("the prefilter's BLOCK stops everything; UNKNOWN with material goes on like PASS", async () => {
  const offCallsBefore = calls("OFFTOPIC").length;
  const off = await analyzeArticle(await article("OFFTOPIC"));
  assert.deepEqual([off!.output!.relevance, off!.output!.selected], ["block", false]);
  assert.deepEqual(calls("OFFTOPIC").slice(offCallsBefore), ["prefilter"]);
  // An UNKNOWN with material is judged and written like a PASS, up to 精选 (T1 + T1 + 2 ≥ 2 × T1).
  const vagueId = await article("VAGUE");
  const vague = await analyzeArticle(vagueId);
  assert.deepEqual([vague!.output!.relevance, vague!.output!.selected, vague!.output!.titleZh], ["pass", true, "理解标题 VAGUE"]);
  assert.equal((await row(vagueId)).output.prefilter.label, "UNKNOWN", "the prefilter's own answer stays on record");
  // Nothing but a title and no page to fetch: it waits for material without a model call.
  const bare = await analyzeArticle(await article("BARE", { bodyText: null, excerpt: null, bodyStatus: "none" }));
  assert.deepEqual([bare!.output!.relevance, bare!.output!.selected, bare!.output!.score], ["unknown", false, null]);
  assert.deepEqual(calls("BARE"), []);
});

test("a feed summary alone: the article page is fetched first, then the whole article is judged", async () => {
  const id = await article("THIN", { bodyText: null, bodyStatus: "pending", excerpt: `THIN: a short feed summary (${T}).` });
  // The queue sends it to extraction although its source does not ask for full text (the sweep does
  // the same after a failed fetch, so extraction failures add up to "unconfirmed" and end).
  await queueProcessing(id);
  const [job] = await sql<{ name: string }[]>`SELECT name FROM pgboss.job WHERE data->>'articleId' = ${id}`;
  assert.equal(job?.name, QUEUES.extractBody);
  const first = await analyzeArticle(id);
  assert.deepEqual([first!.needsBody, first!.output], [true, null]);
  assert.deepEqual(calls("THIN"), [], "no model call before the page");
  assert.equal((await sql`SELECT 1 FROM analyses WHERE article_id = ${id}`).length, 0, "nothing committed");
  // What extraction does: the body lands as a new revision.
  await sql`UPDATE articles SET body_text = ${`THIN: ${LONG} (${T}) full page`}, body_status = 'ok', revision = revision + 1 WHERE id = ${id}`;
  const second = await analyzeArticle(id);
  assert.deepEqual([second!.needsBody ?? false, second!.output!.selected], [false, true]);
});

test("a short post in Chinese is its own copy; a content-filter refusal is translated instead", async () => {
  // The tag rides as a hashtag, which the language check strips.
  const text = `推文：今天把智能体接进了工作流，效果不错。#t${T}`;
  const { articleId } = await upsertMaterial({
    sourceId: X_SOURCE, url: `https://x.com/test/status/1${Date.now()}`, title: text, via: "fetch", publishedAt: new Date(),
    xPost: { tweetId: `1${Date.now()}`, authorName: "测试", handle: "test", text },
  });
  const post = await analyzeArticle(articleId);
  assert.deepEqual([post!.output!.titleZh, post!.output!.summaryZh], [text, text]);
  assert.ok(!calls("推文").includes("summarize"), "no translation call");
  const sensitive = await analyzeArticle(await article("SENSITIVE"));
  assert.deepEqual([sensitive!.output!.selected, sensitive!.output!.titleZh], [true, "翻译标题 SENSITIVE"]);
  assert.deepEqual(calls("SENSITIVE").filter((s) => s === "understand" || s === "summarize"), ["understand", "summarize"]);
});

test("guards: a company the input does not name is not written in; long summaries are cut at sentences", () => {
  const input = { title: "某实验室发布新模型", text: "某实验室发布了一个新模型，参数规模和价格都有说明。", sourceKind: "rss" };
  const guarded = enforceIdentity(input, { titleZh: "Oracle Health 发布新模型", summaryZh: "某实验室发布新模型。" });
  assert.deepEqual([guarded.titleZh, guarded.summaryZh, guarded.identityGuard.outcome], ["某实验室发布新模型", "某实验室发布新模型。", "fallback"]);
  // The identity lexicon: a Chinese rendering of a company the input names in English is no invention.
  const alibaba = { title: "Alibaba ships a new coding model", text: "Alibaba released a coding model with pricing details.", sourceKind: "rss" };
  assert.equal(enforceIdentity(alibaba, { titleZh: "阿里巴巴发布编程模型", summaryZh: "阿里巴巴发布了编程模型并公布价格。" }).identityGuard.outcome, "pass");
  const long = "第一句交代了谁做了什么以及关键结果，这一句本身已经足够说明核心事件的来龙去脉。".repeat(3) + "第二句补充数字。".repeat(20);
  assert.ok(compactAnswerFirstSummary(long).length <= 190);
  // A short first sentence and a long second one: the card once ended "…可连接 Google Ads 和 Epic 账号在 Google。".
  const lovable = "Lovable 推出增长工具，在原有建应用聊天窗口中提供增长计划、广告投放和 SEO 能力。用户设定目标后，Lovable 依据应用上下文生成可执行计划；可连接 Google Ads 和 Epic 账号在 Google、YouTube、Facebook、Instagram 投放广告，广告上线前需用户审批，计费直接走 Google Ads 和 Epic 账号，Lovable 不加收服务费；SEO 方面覆盖索引基础、内置 Semrush 关键词机会分析和站外社区推广建议。功能现已在 Free、Pro 和 Business 计划可用。";
  assert.equal(compactAnswerFirstSummary(lovable), "Lovable 推出增长工具，在原有建应用聊天窗口中提供增长计划、广告投放和 SEO 能力。", "whole sentences, never half of one");
  // Only a first sentence longer than the limit is cut, at a clause, never inside an enumeration.
  const runOn = "某实验室发布新模型，支持" + "甲乙丙、".repeat(39) + "甲乙丙，" + "补充说明".repeat(20) + "。";
  const head = compactAnswerFirstSummary(runOn).slice(0, -1);
  assert.ok(runOn.startsWith(head) && "，；".includes(runOn[head.length]!), head);
  assert.deepEqual(parseTranslateOutput("title_zh: 标题\nsummary_zh: 第一句。\n第二句。"), { titleZh: "标题", summaryZh: "第一句。\n第二句。", bodyZh: "" });
  assert.equal(parseTranslateOutput("title_zh: 标题\nbody_zh: 我们懂你。\n\n来源：X：PixVerse (@PixVerse)").bodyZh, "我们懂你。", "a repeated prompt line is dropped");
});

test("analysing the same revision again reuses every paid answer", async () => {
  scoreAnswers.CLEAR = [T1 + 2, T1];
  const id = await article("CLEAR", { url: `https://example.com/CLEAR-again-${T}`, title: `CLEAR model release again ${T}` });
  const first = await analyzeArticle(id);
  assert.equal(first!.reused, false);
  const hits = provider.hits();
  const again = await analyzeArticle(id);
  assert.equal(provider.hits(), hits, "no new requests");
  assert.deepEqual([again!.reused, again!.receiptIds], [true, first!.receiptIds]);
});
