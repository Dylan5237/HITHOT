import { KEY_VENDORS } from "@aihot/industry/content";

/** Contact sections never enter material or raw data. */
export function withoutContacts(text: string): string {
  const lines = text.replace(/<[^>]+>/g, "\n").split(/[\r\n]+/);
  const stop = lines.findIndex(l => /凡对本次公告|对本次招标提出询问|采购人信息|采购代理机构信息/.test(l));
  return (stop >= 0 ? lines.slice(0, stop) : lines)
    .filter(l => !/联系人|联系方式|联系电话|传真|电子邮件|邮箱|身份证|联系地址|签字|负责人签名|公司负责人|主管会计|会计机构负责人|财务总监/.test(l))
    .join("\n")
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, "")
    .replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, "")
    .replace(/(?<!\d)0\d{2,3}[-－ ]?\d{7,8}(?:[-－]\d{1,6})?(?!\d)/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export const SOFTWARE = /HIS|电子病历|EMR|信息系统|信息化|平台|互联网医院|医保|数据中心|数据中台|智慧医院|互联互通|医疗大模型/i;
const BUYER = /医院|卫生健康|卫生院|卫健|医疗保障|医保局|疾控|疾病预防|妇幼|卫生服务中心/;
const CORE_SOFTWARE = /HIS|电子病历|EMR|管理系统|业务系统|互联网医院|软件|数据中台|集成平台|信息平台/i;

export function keyVendor(name: string, context = ""): boolean {
  return KEY_VENDORS.some(v => v.aliases.some(a => name.includes(a))
    && (!("exclude" in v) || !name.includes(v.exclude) || /医疗软件|信息系统|电子病历|HIS|EMR/i.test(context)));
}

export interface Procurement {
  buyer: string; province: string | null; amountRmb: number; winners: string[]; productLine: string;
}

/** The persisted shape is an institution-only allowlist, never a copy of announcement HTML. */
export function procurementFacts(title: string, values: { buyer: string; province?: string | null; amount: string; winner: string; text: string }): Procurement | null {
  const { buyer, text } = values;
  if (!BUYER.test(buyer) || !SOFTWARE.test(title + " " + text)) return null;
  if (/运维|维保|维护服务|耗材/.test(title) && !/建设|新建|改造|升级|开发/.test(title)) return null;
  if (/运维|耗材|硬件|服务器|设备采购|维保/.test(title) && !CORE_SOFTWARE.test(title)) return null;
  const money = /([\d,.]+)\s*(亿元|万元|万|元)?/.exec(values.amount.replace(/[￥¥]/g, ""));
  const amountRmb = money ? Number(money[1].replace(/,/g, "")) * (money[2] === "亿元" ? 1e8 : /万/.test(money[2] ?? "") ? 1e4 : 1) : 0;
  if (!Number.isFinite(amountRmb) || amountRmb <= 0) return null;
  const winners = values.winner.split(/[；;、，,\n]/).map(v => v.replace(/^(?:供应商名称|中标人|成交供应商|牵头人|成员)[：:]\s*/, "").trim())
    .map(v => /^(.{1,180}?(?:有限责任公司|股份有限公司|有限公司|股份公司|公司|研究院|研究所|医院|中心|大学|集团))(?=$|\s|[（(])/u.exec(v)?.[1] ?? "")
    .filter(Boolean).slice(0, 12);
  if (!winners.length || !(amountRmb >= 5_000_000 || winners.some(v => keyVendor(v, title)))) return null;
  const productLine = /HIS|医院信息系统|医院管理系统/i.test(title) ? "HIS"
    : /电子病历|EMR/i.test(title) ? "电子病历"
    : /互联网医院/.test(title) ? "互联网医院"
    : /医保/.test(title) ? "医保信息化"
    : /数据中心|数据中台|数据治理/.test(title) ? "数据平台"
    : /区域|全民健康|公共卫生/.test(title) ? "区域卫生平台" : "医疗信息系统";
  const cleanBuyer = buyer.split(/[\r\n]/)[0].replace(/^(?:采购人|采购单位|名称)[：:]\s*/, "").trim();
  if (/联系人|电话|邮箱|地址/.test(cleanBuyer)) return null;
  return { buyer: cleanBuyer.slice(0, 240), province: values.province ?? null, amountRmb, winners, productLine };
}
