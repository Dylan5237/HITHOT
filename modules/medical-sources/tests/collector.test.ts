import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { addDays, beijingDate } from "@aihot/contracts/time";
import { collectionHttp } from "@aihot/backend/sources/polite";
import { fromHtml } from "@aihot/backend/sources/web-list";
import { procurementFacts, withoutContacts } from "../privacy.ts";
import { parseProcurement, previewMedicalSource } from "../collector.ts";

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
