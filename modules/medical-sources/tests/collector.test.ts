import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { addDays, beijingDate } from "@aihot/contracts/time";
import { closeDb, sql } from "@aihot/backend/db";
import { collectionHttp, CollectionDeniedError } from "@aihot/backend/sources/polite";
import { fromHtml } from "@aihot/backend/sources/web-list";
import { procurementFacts, withoutContacts } from "../privacy.ts";
import { collectMedicalSource, parseGovCmsListing, parseProcurement, previewMedicalSource } from "../collector.ts";

after(async () => closeDb());

const title = "测试医院HIS及电子病历系统建设项目中标公告";
const values = { buyer: "测试医院", province: "湖北省", amount: "800.0000 万元（人民币）", winner: "东华软件股份公司 联系人：测试联系人", text: "HIS与电子病历系统建设" };

test("procurement admission checks institution, software, supplier and amount before storing anything", () => {
  const result = procurementFacts(title, values)!;
  assert.equal(result.amountRmb, 8_000_000);
  assert.deepEqual(result.winners, ["东华软件股份公司"]);
  assert.equal(JSON.stringify(result).includes("测试联系人"), false);
  assert.equal(procurementFacts(title, { ...values, buyer: "测试企业", amount: "900万元" }), null);
  assert.equal(procurementFacts(title, { ...values, winner: "测试联系人" }), null);
  assert.equal(procurementFacts(title, { ...values, winner: "其他技术有限公司", amount: "499万元" }), null);
  assert.ok(procurementFacts(title, { ...values, winner: "其他技术有限公司", amount: "500万元" }));
  assert.ok(procurementFacts(title, { ...values, amount: "120万元" }));
  assert.equal(procurementFacts("测试医院HIS运行维护服务中标公告", values), null);
  assert.equal(procurementFacts("测试医院信息化硬件平台采购中标公告", values), null);
});

test("only institutional facts survive parsing a procurement announcement", () => {
  const html = `<meta name="PubDate" content="2026-10-21 10:00"><table><tr><td>采购单位</td><td>测试医院</td><td>行政区域</td><td>湖北省</td></tr><tr><td>总中标金额</td><td>800.00 万元（人民币）</td></tr></table>
    <div class="vF_detail_content"><p>供应商名称：东华软件股份公司</p><p>HIS及电子病历系统建设</p><p>采购人信息</p><p>联系人：测试联系人</p><p>电话：13800000000</p><p>邮箱：person@example.test</p></div>`;
  const item = parseProcurement(html, "https://www.ccgp.gov.cn/cggg/dfgg/zbgg/202610/test.htm", title)!;
  assert.equal(item.publishedAt?.toISOString(), "2026-10-21T02:00:00.000Z");
  assert.deepEqual(Object.keys((item.raw as { procurement: object }).procurement).sort(), ["amountRmb", "buyer", "productLine", "province", "winners"]);
  for (const forbidden of ["测试联系人", "13800000000", "person@example.test", "联系人", "vF_detail_content"]) assert.equal(JSON.stringify(item).includes(forbidden), false);
});

test("contact text is dropped while project facts and amounts remain", () => {
  const text = withoutContacts("项目：HIS建设\n金额：800万元\n联系人：测试联系人\n电话：13800000000\nperson@example.test");
  assert.ok(text.includes("800万元"));
  assert.equal(/测试联系人|13800000000|example\.test/.test(text), false);
});

test("hospital result listing keeps dated PACS awards and follows the next page without storing contacts", async () => {
  const today = beijingDate(new Date()), old = addDays(today, -15);
  const list = "https://www.xjefy.cn/defsyy/zbc/zbgg.htm";
  const next = "https://www.xjefy.cn/defsyy/zbc/zbgg/1.htm";
  const award = "https://www.xjefy.cn/defsyy/info/12831/101.htm";
  const awardTitle = "测试医院PACS系统更新改造项目中标公告";
  const row = (name: string, id: number, date: string) =>
    `<li><a href="../info/12831/${id}.htm" title="${name}">${name}<span>${date}</span></a></li>`;
  const pages: Record<string, string> = {
    [list]: `<ul class="lb-list">${row(awardTitle, 101, today)}${row("测试医院PACS系统项目中标候选人公示", 102, today)}${row("测试医院PACS项目废标公告", 103, today)}${row("测试医院设备采购中标公告", 104, today)}</ul><a href="zbgg/1.htm">下页</a>`,
    [next]: `<ul class="lb-list">${row("测试医院PACS系统中标公告", 105, old)}</ul>`,
    [award]: `<div class="article-sm">时间：${today}</div><div class="v_news_content"><p>供应商名称：测试科技有限公司</p><p>中标（成交）金额：580.0000000（万元）</p><p>采购人信息</p><p>名称：测试医院</p><p>联系人：测试联系人</p><p>电话：13800000000</p></div>`,
  };
  const requested: string[] = [], original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    requested.push(url);
    assert.ok(pages[url], `unexpected request: ${url}`);
    return { status: 200, url, text: () => pages[url] } as never;
  };
  try {
    const result = await previewMedicalSource("xian-hospital-results");
    assert.deepEqual(requested, [list, award, next]);
    assert.deepEqual(result.evidence.errors, []);
    assert.equal(result.evidence.reachedWindowStart, true);
    assert.equal(result.candidates.length, 1);
    const item = result.candidates[0]!;
    assert.equal(item.title, awardTitle);
    assert.equal(item.url, award);
    assert.equal(item.publicationTime, today);
    assert.equal(item.publishedAt && beijingDate(item.publishedAt), today);
    assert.equal((item.raw as { procurement: { amountRmb: number } }).procurement.amountRmb, 5_800_000);
    assert.equal((item.raw as { procurement: { productLine: string } }).procurement.productLine, "PACS");
    assert.equal(/测试联系人|13800000000|联系人|电话/.test(JSON.stringify(item)), false);
  } finally {
    collectionHttp.fetch = original;
  }
});

test("the three hospital and vendor listings retain their own links and dates", () => {
  const sources = JSON.parse(readFileSync(new URL("../../../industry/sources.json", import.meta.url), "utf8")).sources as Array<{ id: string; kind: string; config: Record<string, unknown> }>;
  const examples = [
    { id: "web-jiangmen-hospital", html: `<li><a class="fstyle1" href="./202610/a.html">智能预问诊上线</a><div class="time">2026-10-26</div></li>`, title: "智能预问诊上线", url: "https://www.jmszxyy.com.cn/byjs/bydt/202610/a.html" },
    { id: "web-scu-news", html: `<li data-aos="fade-up"><a href="info/1135/1.htm"><h3>医院医疗大模型上线</h3><span>2026-10-26</span></a></li>`, title: "医院医疗大模型上线", url: "https://news.scu.edu.cn/info/1135/1.htm" },
    { id: "web-huimei-cases", html: `<li class="newsList"><a class="toDetailBtn" href="/casesDetails/1.html"><h3>测试医院</h3><p class="time"><span>医疗大模型</span> 2026-10-26</p><p>案例简介</p></a></li>`, title: "测试医院", url: "https://www.huimei.com/casesDetails/1.html" },
  ];
  for (const example of examples) {
    const source = sources.find(s => s.id === example.id)!;
    const items = fromHtml(example.html, String(source.config.url), source as never);
    assert.equal(items.length, 1, example.id);
    assert.equal(items[0]!.title, example.title, example.id);
    assert.equal(items[0]!.url, example.url, example.id);
    assert.equal(items[0]!.publicationTime, "2026-10-26", example.id);
    assert.equal(items[0]!.publishedAt && beijingDate(items[0]!.publishedAt), "2026-10-26", example.id);
  }
});

const govList = (records: string[]) => `<script type="text/xml"><datastore><recordset>${records.map(row => `<record><![CDATA[${row}]]></record>`).join("")}</recordset></datastore></script>`;
const govRow = (id: number, day: string, href = `/art/2026/10/28/art_104_${id}.html`) =>
  `<li><span>索引</span><span><a href="${href}" title="医保信息系统政策 ${id} 的完整标题">医保信息系统政策...</a></span><span>${day}</span></li>`;

function policyPdf(text: string, scan = false, pages = 1): Buffer {
  const stream = (scan ? "q 500 0 0 600 20 20 cm /Scan Do Q\n" : "") + `BT /F1 12 Tf 20 700 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> ${scan ? "/XObject << /Scan 6 0 R >>" : ""} >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  if (scan) objects.push("<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n0\nendstream");
  const kids = ["3 0 R"];
  for (let n = 1; n < pages; n++) { objects.push(objects[2]!); kids.push(`${objects.length} 0 R`); }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`;
  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(out + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

test("Jiangsu numbered department files are filtered before the import limit and retain attachment completeness", async () => {
  const day = beijingDate(new Date()), list = "https://wjw.jiangsu.gov.cn/col/col49511/index.html";
  const origin = "https://wjw.jiangsu.gov.cn", original = collectionHttp.fetch, requests: string[] = [];
  const row = (id: number, title: string) => `<li><a href="/art/2026/10/28/art_49511_${id}.html" title="${title}">${title}</a><span>${day}</span></li>`;
  const rows = [...Array.from({ length: 9 }, (_, i) => row(i + 1, "个人资格和名单公示")),
    row(100, "关于印发医疗服务意见的通知（苏卫医政〔2026〕30号）"),
    row(101, "关于印发医院评审细则的通知（苏卫规（医政）〔2026〕28号）")];
  collectionHttp.fetch = async url => {
    requests.push(url);
    if (url.startsWith(origin + "/module/download/")) {
      const scan = url.includes("scan.pdf");
      const body = policyPdf(scan ? "SCANNED POLICY HEADER" : "Hospitals shall update information systems.", scan);
      return { status: 200, url, body, text: () => body.toString() } as never;
    }
    const scan = url.includes("_101.html");
    const html = url === list ? govList(rows)
      : `<meta name="PubDate" content="${day} 08:30"><div id="zoom"><p>现印发实施，请遵照执行。</p><a href="/module/download/downfile.jsp?filename=${scan ? "scan" : "policy"}.pdf">政策附件</a></div>`;
    assert.ok(url === list || /_10[01]\.html$/.test(url), `unexpected detail read: ${url}`);
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-jiangsu-health-files", { limit: 2 });
    assert.equal(result.evidence.found, 11);
    assert.deepEqual(result.evidence.errors, []);
    assert.equal(result.candidates.length, 2);
    assert.match(result.candidates[0]!.bodyText!, /Hospitals shall update information systems/);
    assert.equal(result.candidates[0]!.bodyStatus, "unconfirmed");
    assert.equal(result.candidates[1]!.bodyStatus, "unconfirmed");
    assert.match(result.candidates[1]!.bodyText!, /现印发实施/);
    assert.equal(requests.length, 5);
  } finally { collectionHttp.fetch = original; }
});

test("large or long Jiangsu PDF attachments retain the notice without reading their policy text", async () => {
  const day = beijingDate(new Date()), list = "https://wjw.jiangsu.gov.cn/col/col49511/index.html";
  const original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    if (url.includes("filename=")) {
      const body = url.includes("large.pdf") ? Buffer.concat([policyPdf("ATTACHED POLICY"), Buffer.alloc(2 * 1024 * 1024)]) : policyPdf("ATTACHED POLICY", false, 11);
      return { status: 200, url, body, text: () => body.toString() } as never;
    }
    const html = url === list ? govList([1, 2].map(id => `<li><a href="/art/2026/10/28/art_49511_${id}.html" title="关于印发实施办法的通知（苏卫〔2026〕${id}号）">通知</a><span>${day}</span></li>`))
      : `<meta name="PubDate" content="${day} 08:30"><div id="zoom"><p>现印发实施，请遵照执行。</p><a href="/module/download/downfile.jsp?filename=${url.includes("_1.html") ? "large" : "long"}.pdf">附件</a></div>`;
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-jiangsu-health-files");
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(result.evidence.errors, []);
    for (const candidate of result.candidates) {
      assert.equal(candidate.bodyStatus, "unconfirmed");
      assert.match(candidate.bodyText!, /现印发实施/);
      assert.doesNotMatch(candidate.bodyText!, /ATTACHED POLICY/);
    }
  } finally { collectionHttp.fetch = original; }
});

test("an unreadable or foreign Jiangsu policy attachment never becomes confirmed full material", async () => {
  const day = beijingDate(new Date()), list = "https://wjw.jiangsu.gov.cn/col/col49511/index.html";
  const original = collectionHttp.fetch, requests: string[] = [];
  collectionHttp.fetch = async url => {
    requests.push(url);
    if (url.includes("bad.pdf")) throw new Error("attachment unavailable");
    assert.ok(url.startsWith("https://wjw.jiangsu.gov.cn/"));
    const html = url === list ? govList([`<li><a href="/art/2026/10/28/art_49511_1.html" title="关于印发实施办法的通知（苏卫〔2026〕1号）">通知</a><span>${day}</span></li>`])
      : `<meta name="PubDate" content="${day} 08:30"><div id="zoom"><p>现印发实施，请遵照执行。</p><a href="https://outside.example/policy.pdf">外部附件</a><a href="/module/download/downfile.jsp?filename=bad.pdf">办法</a></div>`;
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-jiangsu-health-files");
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]!.bodyStatus, "unconfirmed");
    assert.equal(result.evidence.errors.length, 1);
    assert.equal(requests.length, 3);
  } finally { collectionHttp.fetch = original; }
});

test("a temporarily unavailable Jiangsu file does not route to the generic body reader", async () => {
  const day = beijingDate(new Date()), list = "https://wjw.jiangsu.gov.cn/col/col49511/index.html";
  const original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    if (url !== list) throw new Error("HTTP 503");
    const html = govList([`<li><a href="/art/2026/10/28/art_49511_1.html" title="关于印发实施办法的通知（苏卫〔2026〕1号）">通知</a><span>${day}</span></li>`]);
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-jiangsu-health-files");
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]!.bodyStatus, "unconfirmed");
    assert.ok(!result.candidates[0]!.bodyText);
    assert.equal(result.evidence.errors.length, 1);
  } finally { collectionHttp.fetch = original; }
});

test("government XML records retain full titles, source dates and only same-site article URLs", () => {
  const day = "2026-10-20", url = "https://www.nhsa.gov.cn/col/col104/index.html";
  const html = govList([govRow(1, day), govRow(2, day, "https://outside.example/art/a.html"), govRow(3, day, "/col/col104/index.html"), govRow(1, day)]);
  const items = parseGovCmsListing(html, url);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.title, "医保信息系统政策 1 的完整标题");
  assert.equal(items[0]!.url, "https://www.nhsa.gov.cn/art/2026/10/28/art_104_1.html");
  assert.equal(items[0]!.publicationTime, day);
  assert.equal(items[0]!.publishedAt?.toISOString(), "2026-10-19T16:00:00.000Z");
  assert.throws(() => parseGovCmsListing("<html>结构已变化</html>", url), /No government list records/);
});

test("government preview reads original time and correctly decodes a mislabelled UTF-8 TXT", async () => {
  const day = beijingDate(new Date());
  const list = "https://www.nhsa.gov.cn/col/col104/index.html";
  const one = "https://www.nhsa.gov.cn/art/2026/10/28/art_104_1.html";
  const two = "https://www.nhsa.gov.cn/art/2026/10/28/art_104_2.html";
  const txt = "https://www.nhsa.gov.cn/module/download/downfile.jsp?filename=policy.txt";
  const text = "国家医保局通知：医保信息系统应完成分组方案更新。\n联系人：测试联系人\n联系电话：13800000000";
  const pages: Record<string, string> = {
    [list]: govList([govRow(1, day), govRow(2, day)]),
    [one]: `<meta name="PubDate" content="${day} 10:30"><div id="zoom"><p>医保信息系统完成统一编码和接口更新。</p><p>联系人：测试联系人</p><p>电话：13800000000</p></div>`,
    [two]: `<meta name="PubDate" content="${day} 11:10"><div id="zoom"><a href="/module/download/downfile.jsp?filename=policy.txt">通知.txt</a></div>`,
    [txt]: text,
  };
  const requests: string[] = [], original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    requests.push(url);
    assert.ok(pages[url], `unexpected request: ${url}`);
    const body = Buffer.from(pages[url], "utf8");
    return { status: 200, url, body, text: () => url === txt ? new TextDecoder("gb18030").decode(body) : pages[url] } as never;
  };
  try {
    const result = await previewMedicalSource("web-nhsa-policy", { limit: 2 });
    assert.deepEqual(requests, [list, one, two, txt]);
    assert.deepEqual(result.evidence.errors, []);
    assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0]!.publicationTime, new Date(`${day}T10:30:00+08:00`).toISOString());
    assert.match(result.candidates[0]!.bodyText!, /统一编码和接口更新/);
    assert.match(result.candidates[1]!.bodyText!, /医保信息系统应完成分组方案更新/);
    assert.equal(result.candidates[1]!.publicationTime, new Date(`${day}T11:10:00+08:00`).toISOString());
    assert.doesNotMatch(JSON.stringify(result.candidates), /测试联系人|13800000000/);
  } finally { collectionHttp.fetch = original; }
});

test("policy interpretation uses its own feed and shares an original without duplicating the article", async () => {
  const day = beijingDate(new Date()), id = "web-nhsa-interpretation", policyId = "web-nhsa-policy";
  const list = "https://www.nhsa.gov.cn/col/col105/index.html", policyList = "https://www.nhsa.gov.cn/col/col104/index.html";
  const url = "https://www.nhsa.gov.cn/art/2026/10/28/art_104_900001.html";
  const requests: string[] = [], original = collectionHttp.fetch;
  collectionHttp.fetch = async target => {
    requests.push(target);
    assert.ok([list, policyList, url].includes(target), `unexpected request: ${target}`);
    const html = target === url
      ? `<meta name="PubDate" content="${day} 08:30"><div id="zoom"><p>医保统一编码与信息系统接口更新的政策解读。</p></div>`
      : govList([govRow(900001, day, url)]);
    return { status: 200, url: target, body: Buffer.from(html), text: () => html } as never;
  };
  for (const sourceId of [policyId, id]) await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled) VALUES (${sourceId},'医保测试','external','{}','T1','editorial',true)`;
  try {
    const policy = await collectMedicalSource(policyId, { process: false });
    const interpretation = await collectMedicalSource(id, { process: false });
    assert.equal(policy.status, "ok");
    assert.equal(policy.created, 1);
    assert.equal(interpretation.status, "ok");
    assert.equal(interpretation.created, 0);
    assert.ok(requests.includes(list));
    const articles = await sql`SELECT id,source_id,publication_time,body_text FROM articles WHERE url=${url}`;
    assert.equal(articles.length, 1);
    assert.equal(articles[0]!.source_id, policyId);
    assert.equal(articles[0]!.publication_time, new Date(`${day}T08:30:00+08:00`).toISOString());
    assert.match(articles[0]!.body_text, /统一编码与信息系统接口/);
    const discoveries = await sql`SELECT source_id FROM article_discoveries WHERE article_id=${articles[0]!.id} ORDER BY source_id`;
    assert.deepEqual(discoveries.map(row => row.source_id), [id, policyId].sort());
  } finally { collectionHttp.fetch = original; }
});

test("a refused government article stops the source instead of bypassing the restriction", async () => {
  const day = beijingDate(new Date()), list = "https://www.nhsa.gov.cn/col/col104/index.html";
  const original = collectionHttp.fetch, requests: string[] = [];
  collectionHttp.fetch = async url => {
    requests.push(url);
    if (url !== list) throw new CollectionDeniedError("robots.txt disallows the article");
    const html = govList([govRow(1, day), govRow(2, day)]);
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-nhsa-policy");
    assert.equal(result.candidates.length, 0);
    assert.match(result.evidence.errors[0]!.error, /robots\.txt disallows/);
    assert.equal(requests.length, 2);
  } finally { collectionHttp.fetch = original; }
});

test("a missing policy TXT is not mistaken for an attachment-only body", async () => {
  const day = beijingDate(new Date()), list = "https://www.nhsa.gov.cn/col/col104/index.html";
  const original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    if (url.includes("downfile.jsp")) return { status: 404, url, body: Buffer.alloc(0), text: () => "" } as never;
    const html = url === list ? govList([govRow(1, day)]) :
      `<meta name="PubDate" content="${day} 09:00"><div id="zoom">附件：<a href="/module/download/downfile.jsp?filename=missing.txt">通知.txt</a></div>`;
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-nhsa-policy");
    assert.equal(result.candidates[0]!.bodyStatus, "unconfirmed");
    assert.equal(result.candidates[0]!.bodyText, null);
    assert.match(result.evidence.errors[0]!.error, /HTTP 404/);
  } finally { collectionHttp.fetch = original; }
});

test("a policy containing only PDF links keeps its body unconfirmed", async () => {
  const day = beijingDate(new Date()), list = "https://www.nhsa.gov.cn/col/col104/index.html";
  const original = collectionHttp.fetch, requests: string[] = [];
  collectionHttp.fetch = async url => {
    requests.push(url);
    const html = url === list ? govList([govRow(1, day)]) :
      `<meta name="PubDate" content="${day} 09:00"><div id="zoom">附件：<a href="/module/download/downfile.jsp?filename=policy.pdf">政策.pdf</a></div>`;
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const result = await previewMedicalSource("web-nhsa-policy");
    assert.equal(result.candidates[0]!.bodyStatus, "unconfirmed");
    assert.equal(result.candidates[0]!.bodyText, null);
    assert.equal(requests.length, 2);
  } finally { collectionHttp.fetch = original; }
});

test("a date-only listing on the 48-hour boundary is checked against the article's time", async () => {
  const day = beijingDate(new Date()), boundaryDay = addDays(day, -2);
  const list = "https://www.nhsa.gov.cn/col/col104/index.html", original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    const html = url === list ? govList([govRow(1, boundaryDay)]) :
      `<meta name="PubDate" content="${boundaryDay} 18:00"><div id="zoom"><p>医保信息系统数据标准更新。</p></div>`;
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  try {
    const initializedAt = new Date(`${day}T12:00:00+08:00`).toISOString();
    const result = await previewMedicalSource("web-nhsa-policy", { initializedAt });
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]!.publicationTime, new Date(`${boundaryDay}T18:00:00+08:00`).toISOString());
  } finally { collectionHttp.fetch = original; }
});

test("government source bounds first import and does not re-fetch stored bodies", async () => {
  const id = "web-nhsa-notice", day = beijingDate(new Date());
  const list = "https://www.nhsa.gov.cn/col/col109/index.html";
  const items = Array.from({ length: 10 }, (_, i) => govRow(i + 1, day));
  const requests: string[] = [], original = collectionHttp.fetch;
  collectionHttp.fetch = async url => {
    requests.push(url);
    const html = url === list ? govList(items) : `<meta name="PubDate" content="${day} 00:05"><div id="zoom"><p>医保信息系统已完成接口和数据标准更新。</p></div>`;
    return { status: 200, url, body: Buffer.from(html), text: () => html } as never;
  };
  await sql`INSERT INTO sources (id,name,kind,config,tier,participation_mode,enabled) VALUES (${id},'医保测试','external','{}','T1','editorial',true)`;
  try {
    const first = await collectMedicalSource(id, { process: false });
    assert.equal(first.status, "ok");
    assert.equal(first.created, 8);
    assert.equal(requests.length, 9);
    assert.equal((await sql`SELECT count(*)::int AS n FROM articles WHERE source_id=${id} AND backfill`)[0]!.n, 8);
    requests.length = 0;
    const next = await collectMedicalSource(id, { process: false });
    assert.equal(next.status, "ok");
    assert.equal(next.created, 2);
    assert.equal(requests.length, 3);
    requests.length = 0;
    const unchanged = await collectMedicalSource(id, { process: false });
    assert.equal(unchanged.status, "ok");
    assert.equal(unchanged.created, 0);
    assert.deepEqual(requests, [list]);
  } finally { collectionHttp.fetch = original; }
});
