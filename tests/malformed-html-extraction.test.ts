// Observed failures (gov.cn policy library, 2026-10): the page closes </html> before </body>, so the
// parser left the article outside the document and Readability threw a TypeError that the fetch path
// reported as a missing Reader key; once parsed, the page's desktop and phone copies of the same
// document were read as one body, twice as long as the text a reader sees.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readable } from "@aihot/backend/content/extract";

const paragraph = (n: number) => `<p>第${n}条 各级医疗机构应当按照统一标准建设电子病历系统，推进检查检验结果互认和数据共享，保障患者信息安全，并定期报告建设进展。</p>`;
const article = Array.from({ length: 6 }, (_, i) => paragraph(i + 1)).join("");
const copies = `<div id="UCAP-CONTENT"><div class="trs_editor_view">${article}</div></div>
  <div class="pages_content pchide"><div class="trs_editor_view">${article}</div></div>`;
const page = (body: string, tail = "</body></html>") =>
  `<html><head><title>关于推进医疗机构电子病历建设的通知</title></head><body class="ZC"><div class="wrap"><h1>关于推进医疗机构电子病历建设的通知</h1>${body}</div>${tail}`;
const count = (text: string, needle: string) => text.split(needle).length - 1;

test("an early </html> before </body> keeps the article inside the document", () => {
  // An included header fragment ends with its own </html>; the article follows it inside <body>.
  const got = readable(page(`<div class="header">首页 政策 解读</div></html><!--end header--><div class="content">${article}</div>`), "https://www.gov.cn/zhengce/a.htm");
  assert.ok(got, "the article is read instead of throwing");
  assert.equal(count(got.text, "第6条"), 1);
});

test("the desktop and phone copies of one article are read once", () => {
  const got = readable(page(copies), "https://www.gov.cn/zhengce/b.htm");
  assert.ok(got);
  assert.equal(count(got.text, "第1条"), 1, "one copy");
  assert.equal(count(got.text, "第6条"), 1, "the whole article");
});

test("a wrapper around a single copy and distinct sections stay", () => {
  const other = Array.from({ length: 6 }, (_, i) => paragraph(i + 11)).join("");
  const got = readable(page(`<div class="outer"><div class="inner">${article}</div></div><div class="more">${other}</div>`), "https://www.gov.cn/zhengce/c.htm");
  assert.ok(got);
  assert.equal(count(got.text, "第1条"), 1);
});
