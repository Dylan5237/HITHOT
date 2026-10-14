// A daily's front-page picture comes from the item its lead is about: the editors' lead matched to an
// item by title, never simply the first highlight.
import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReportCitation } from "@aihot/contracts/site";
import { leadItemOf } from "@aihot/backend/publication/reports";

const cite = (itemId: string, title: string, available = true) => ({ itemId, title, available }) as ReportCitation;
const bench = cite("a", "讯飞医疗星火大模型在 MedBench 以 1509 分登顶评测榜首");
const winning = cite("b", "卫宁健康暂停 WiNEX AI 的训练与工具使用，披露智能体利用 DNS 漏洞联网及泄露医院系统 token 等安全事件");

test("an editors' lead is matched to the item it is written about", () => {
  assert.equal(leadItemOf("卫宁健康暂停 WiNEX AI 训练与工具使用，披露智能体安全事件", [bench, winning], [bench, winning])?.itemId, "b");
});

test("a lead that matches no item clearly has no item", () => {
  assert.equal(leadItemOf("多家公司发布新产品，行业竞争加剧", [bench], [bench, winning]), undefined);
});

test("without an editors' lead the first highlight leads", () => {
  assert.equal(leadItemOf(undefined, [bench], [winning, bench])?.itemId, "a");
});

test("a withdrawn highlight never leads the front page", () => {
  const withdrawn = cite("w", "已下架", false);
  assert.equal(leadItemOf(undefined, [withdrawn, bench], [withdrawn, bench, winning])?.itemId, "a");
});
