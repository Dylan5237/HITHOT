import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { procurementFacts, withoutContacts } from "../privacy.ts";
import { parseProcurement } from "../collector.ts";

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
