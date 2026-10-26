import * as cheerio from "cheerio";
import { getDocumentProxy } from "unpdf";
import { MEDICAL_SOURCES, type MedicalSource } from "@aihot/industry/medical-sources";
import { addDays, beijingDate } from "@aihot/contracts/time";
import { sql } from "@aihot/backend/db";
import { collectSource, type CollectResult } from "@aihot/backend/sources/collect";
import { collectionHttp, CollectionDeniedError } from "@aihot/backend/sources/polite";
import { readPublicationDate } from "@aihot/backend/sources/dates";
import { readable } from "@aihot/backend/content/extract";
import { collapseWhitespace, stripTags } from "@aihot/backend/lib/text";
import type { GuardedFetchOptions } from "@aihot/backend/lib/http-fetch";
import type { Candidate } from "@aihot/backend/sources/types";
import { procurementFacts, SOFTWARE, withoutContacts } from "./privacy.ts";

export interface SourceEvidence {
  limit?: number;
  sourceId: string; window: { from: string; to: string }; startedAt: string; completedAt?: string;
  requests: Array<{ url: string; status: number | null; completedAt: string; error?: string }>;
  found: number; kept: number; skipped: number; undated: number; reachedWindowStart: boolean;
  errors: Array<{ url: string; error: string }>; samples: Array<{ title: string; url: string; publishedAt: string | null }>;
}

function evidence(id: string): SourceEvidence {
  const to = beijingDate(new Date());
  return { sourceId: id, window: { from: addDays(to, -60), to }, startedAt: new Date().toISOString(), requests: [], found: 0, kept: 0, skipped: 0, undated: 0, reachedWindowStart: false, errors: [], samples: [] };
}

async function read(url: string, report: SourceEvidence, opts: GuardedFetchOptions = {}) {
  try {
    const res = await collectionHttp.fetch(url, { timeoutMs: 30_000, maxBytes: 8 * 1024 * 1024, ...opts });
    report.requests.push({ url, status: res.status, completedAt: new Date().toISOString() });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (error) {
    const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
    const message = (error instanceof Error ? error.message : String(error)) + (causeCode ? ` (${causeCode})` : "");
    if (report.requests.at(-1)?.url !== url) report.requests.push({ url, status: null, completedAt: new Date().toISOString(), error: message });
    if (error instanceof CollectionDeniedError) throw error;
    throw new Error(message, { cause: error });
  }
}

function dated(at: unknown) { return readPublicationDate(String(at ?? "")); }
function inWindow(at: Date | null | undefined, report: SourceEvidence) {
  if (!at) { report.undated++; return false; }
  if (beijingDate(at) < report.window.from) { report.reachedWindowStart = true; return false; }
  return beijingDate(at) <= report.window.to;
}
function material(id: string, title: string, url: string, body: string, date: ReturnType<typeof dated>, raw: object = {}): Candidate {
  const text = withoutContacts(body).slice(0, 30_000);
  return { identityKey: `medical:${id}`, title: collapseWhitespace(stripTags(title)), url, language: "zh", author: null,
    publishedAt: date.publishedAt, publicationTime: date.publicationTime, excerpt: text.slice(0, 1500) || null,
    bodyText: text || null, bodyStatus: text ? "ok" : "none", raw };
}

async function firstPage(url: string, report: SourceEvidence): Promise<string> {
  const res = await read(url, report, { maxBytes: 32 * 1024 * 1024 });
  if (res.body.subarray(0,5).toString() !== "%PDF-") throw new Error("Announcement did not return a public PDF");
  const pdf = await getDocumentProxy(new Uint8Array(res.body), { maxImageSize: 16_777_216 });
  try {
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    return withoutContacts(content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("")).slice(0, 3000);
  } finally { await pdf.loadingTask.destroy(); }
}

async function cninfo(source: MedicalSource, report: SourceEvidence): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let page = 1; ; page++) {
    const form = new URLSearchParams({ stock: `${source.code},${source.orgId}`, column: source.column!, tabName: "fulltext", pageSize: "50", pageNum: String(page),
      category: "", plate: "", seDate: `${report.window.from}~${report.window.to}`, searchkey: "", sortName: "time", sortType: "desc", isHLtitle: "true" });
    const res = await read(source.url, report, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
    const data = JSON.parse(res.text());
    const rows: any[] = data.announcements ?? [];
    report.found += rows.length;
    for (const row of rows) {
      const title = stripTags(String(row.announcementTitle ?? ""));
      if (!/年度报告|季度报告|半年度报告|业绩预告|业绩快报|重大合同|经营合同|中标|收购|并购|重组|战略合作|合作协议|监管|处罚|立案|警示函/.test(title)
        || /说明会|股东大会|董事会会议|监事会会议|回购股份|股权激励|期权/.test(title)) { report.skipped++; continue; }
      if (String(row.secCode) !== source.code) throw new Error("Disclosure issuer differs from configured security code");
      const at = new Date(Number(row.announcementTime));
      if (!Number.isFinite(at.getTime()) || !inWindow(at, report)) continue;
      const url = new URL(String(row.adjunctUrl), "https://static.cninfo.com.cn/").href;
      try {
        const body = await firstPage(url, report);
        out.push(material(`${source.id}:${row.announcementId}`, title, url, body, { publishedAt: at, publicationTime: at.toISOString() },
          { disclosure: { code: source.code, issuer: row.secName, id: String(row.announcementId), extractedPage: 1 } }));
        if (report.limit && out.length >= report.limit) return out;
      } catch (error) {
        report.errors.push({ url, error: String(error instanceof Error ? error.message : error) });
        if (error instanceof CollectionDeniedError) throw error;
      }
    }
    if (!data.hasMore || rows.length === 0) { report.reachedWindowStart = true; break; }
  }
  return out;
}

async function winning(source: MedicalSource, report: SourceEvidence): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let page = 1; ; page++) {
    const url = new URL(source.url); url.searchParams.set("class_name", "卫宁新闻"); url.searchParams.set("per_page", "20"); url.searchParams.set("page", String(page));
    const data = JSON.parse((await read(url.href, report)).text());
    const rows: any[] = data.data ?? [];
    report.found += rows.length;
    for (const row of rows) {
      const date = dated(row.publish_time);
      if (!inWindow(date.publishedAt, report)) continue;
      const original = String(row.link ?? "");
      if (!/^https?:\/\//.test(original)) { report.skipped++; continue; }
      // The public company API provides the abstract. A linked WeChat article is not requested.
      out.push(material(`${source.id}:${row.id}`, row.title, original, row.introduction ?? "", date, { companyNews: { issuer: "卫宁健康", id: String(row.id), publicAbstract: true } }));
      if (report.limit && out.length >= report.limit) return out;
    }
    if (report.reachedWindowStart || !rows.length || page >= Number(data.meta?.last_page ?? page)) break;
  }
  return out;
}

async function companyHtml(source: MedicalSource, report: SourceEvidence): Promise<Candidate[]> {
  const out: Candidate[] = [], seen = new Set<string>(), pages = new Set<string>();
  let url: string | null = source.url;
  while (url && !pages.has(url)) {
    pages.add(url);
    const response = await read(url, report), $ = cheerio.load(response.text());
    const links = source.adapter === "dhcc" ? $("a.m2naBox") : $("a[href*='newsinformation.aspx'], a[href*='newsinfo.aspx']");
    for (const element of links.toArray()) {
      const a = $(element), href = a.attr("href");
      if (!href) continue;
      const detailUrl = new URL(href.trim(), url).href;
      if (seen.has(detailUrl)) continue;
      seen.add(detailUrl); report.found++;
      const text = a.parent().text();
      const dateText = /\d{4}[年/-]\d{1,2}[月/-]\d{1,2}日?/.exec(text)?.[0];
      let date = dated(dateText);
      if (date.publishedAt && !inWindow(date.publishedAt, report)) continue;
      try {
        const page = await read(detailUrl, report);
        const got = readable(page.text(), page.url);
        const doc = cheerio.load(page.text());
        const title = doc("meta[property='og:title']").attr("content") || doc("h1").first().text() || a.find("img").attr("alt") || a.find("h3,h4,p").first().text() || a.text();
        if (!date.publishedAt) date = { publishedAt: got?.publishedAt ?? null, publicationTime: got?.publicationTime ?? null };
        if (!inWindow(date.publishedAt, report)) continue;
        out.push(material(`${source.id}:${detailUrl}`, title, detailUrl, got?.text ?? "", date, { companyNews: { issuer: source.name } }));
        if (report.limit && out.length >= report.limit) return out;
      } catch (error) {
        report.errors.push({ url: detailUrl, error: String(error instanceof Error ? error.message : error) });
        if (error instanceof CollectionDeniedError) throw error;
      }
    }
    if (report.reachedWindowStart) break;
    const next = $("a").toArray().find(a => /下一页|下页|Next/i.test($(a).text().trim()));
    const href = next ? $(next).attr("href") : null;
    url = href && !/^(?:javascript:|#)/.test(href) ? new URL(href, url).href : null;
  }
  return out;
}

export function parseProcurement(html: string, url: string, title: string): Candidate | null {
  const $ = cheerio.load(html), values = new Map<string,string>();
  $("tr").each((_i, row) => {
    const cells = $(row).find("td,th").toArray();
    for (let i=0; i+1<cells.length; i+=2) values.set(collapseWhitespace($(cells[i]).text()), $(cells[i+1]).text().trim());
  });
  const main = $(".vF_detail_content").first().length ? $(".vF_detail_content").first()
    : $(".TRS_Editor").first().length ? $(".TRS_Editor").first() : $("article").first();
  main.find("p,div,br,li,tr").after("\n");
  const body = main.text();
  const cell = (re: RegExp) => [...values].find(([key]) => re.test(key))?.[1] ?? "";
  const buyer = cell(/^采购单位$|^采购人$/) || /采购人信息[\s\S]*?名[\s　]*称[：:]\s*([^\n]+)/.exec(body)?.[1] || "";
  const amount = cell(/总中标金额|总成交金额/) || /(?:中标|成交)[（(]?(?:成交)?[）)]?金额[：:]\s*([^\n]+)/.exec(body)?.[1] || "";
  const winner = /供应商名称[：:]\s*([^\n]+)/.exec(body)?.[1] || /中标人[：:]\s*([^\n]+)/.exec(body)?.[1] || "";
  const facts = procurementFacts(title, { buyer, province: cell(/^行政区域$/) || null, amount, winner, text: withoutContacts(body) });
  if (!facts) return null;
  const rawDate = $("meta[name='PubDate'],meta[name='pubdate'],meta[name='firstpublishedtime']").attr("content")
    || cell(/^公告时间$/) || /\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}/.exec($("body").text())?.[0];
  const date = dated(rawDate);
  return material(`procurement:${url}`, title, url, JSON.stringify({ 项目: title, 采购人: facts.buyer, 省份: facts.province, 金额人民币元: facts.amountRmb, 中标人: facts.winners, 产品线: facts.productLine }, null, 2), date, { procurement: facts });
}

async function ccgp(source: MedicalSource, report: SourceEvidence): Promise<Candidate[]> {
  const out: Candidate[] = [], seen = new Set<string>();
  // Normal public search parameters, with separate result/transaction categories and software terms.
  for (const bidType of ["7", "11"]) for (const query of ["医院 信息化", "医院 信息系统", "医院 电子病历", "卫健 平台", "医保 信息", "疾控 信息"] ) {
    for (let page = 1; ; page++) {
      const url = new URL(source.url);
      const params = { searchtype: "1", page_index: String(page), bidSort: "0", bidType, dbselect: "bidx", kw: query,
        start_time: report.window.from.replaceAll("-", ":"), end_time: report.window.to.replaceAll("-", ":"), timeType: "6" };
      for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
      const response = await read(url.href, report), $ = cheerio.load(response.text());
      const anchors = $("a[href*='/cggg/']").toArray().filter(a => /\/(?:zbgg|cjgg)\//.test($(a).attr("href") ?? ""));
      let newlySeen = 0;
      for (const a of anchors) {
        const original = new URL($(a).attr("href")!, url).href.replace(/^http:\/\//,"https://"), title = collapseWhitespace($(a).text());
        if (seen.has(original)) continue;
        seen.add(original); newlySeen++; report.found++;
        if (!SOFTWARE.test(title) || !/中标|成交/.test(title) || /运维|耗材|办公设备|硬件平台|维保/.test(title) && !/HIS|电子病历|软件|信息化建设|信息系统/i.test(title)) { report.skipped++; continue; }
        try {
          const detail = await read(original, report), candidate = parseProcurement(detail.text(), original, title);
          if (candidate && inWindow(candidate.publishedAt, report)) out.push(candidate); else report.skipped++;
          if (report.limit && out.length >= report.limit) return out;
        } catch (error) {
          report.errors.push({ url: original, error: String(error instanceof Error ? error.message : error) });
          if (error instanceof CollectionDeniedError) throw error;
        }
      }
      const next = $("a").toArray().find(a => /下一页|下页/.test($(a).text()));
      if (!next || !newlySeen) { report.reachedWindowStart = true; break; }
    }
  }
  return out;
}

async function ratings(source: MedicalSource, report: SourceEvidence): Promise<Candidate[]> {
  const url = new URL(source.url);
  for (const [k,v] of Object.entries({ t: "zhengcelibrary_bm", q: source.query!, bmfl: "国家卫生健康委员会", timetype: "timeqb", sort: "pubtime", sortType: "1", p: "1", n: "50", type: "gwyzcwjk" })) url.searchParams.set(k,v);
  const data = JSON.parse((await read(url.href, report)).text()), out: Candidate[] = [];
  const rows: any[] = data.searchVO?.listVO ?? []; report.found = rows.length;
  for (const row of rows) {
    const title = stripTags(String(row.title ?? ""));
    if (!/电子病历|互联互通/.test(title) || !/名单|通过|评价|测评/.test(title)) continue;
    const at = new Date(Number(row.pubtime));
    if (!Number.isFinite(at.getTime()) || !inWindow(at,report)) continue;
    const original = String(row.url ?? "");
    if (!/^https?:\/\/[^/]*\.(?:gov\.cn|org\.cn)\//.test(original)) continue;
    const res = await read(original,report), got = readable(res.text(),res.url);
    out.push(material(`${source.id}:${row.id}`,title,original,got?.text ?? row.summary ?? "",{publishedAt:at,publicationTime:at.toISOString()},{ officialList: true }));
  }
  report.reachedWindowStart = rows.some(r=>Number(r.pubtime)<Date.parse(report.window.from)) || rows.length<50;
  return out;
}

export async function previewMedicalSource(id: string, opts: { limit?: number } = {}): Promise<{ candidates: Candidate[]; evidence: SourceEvidence }> {
  const spec = MEDICAL_SOURCES.find(s=>s.id===id);
  if (!spec) throw new Error("Unknown medical source");
  const report = evidence(id);
  if (opts.limit) report.limit = opts.limit;
  let candidates: Candidate[];
  try {
    if (spec.unavailable) throw new Error(spec.unavailable);
    if (spec.adapter === "cninfo") candidates = await cninfo(spec,report);
    else if (spec.adapter === "winning") candidates = await winning(spec,report);
    else if (spec.adapter === "dhcc" || spec.adapter === "goodwill") candidates = await companyHtml(spec,report);
    else if (spec.adapter === "ccgp") candidates = await ccgp(spec,report);
    else if (spec.adapter === "ratings") candidates = await ratings(spec,report);
    else throw new Error("A stable permitted public endpoint has not been verified");
  } catch (error) {
    report.errors.push({url:spec.url,error:String(error instanceof Error?error.message:error)});
    report.completedAt = new Date().toISOString();
    return { candidates: [], evidence: report };
  }
  candidates = [...new Map(candidates.map(c=>[c.identityKey,c])).values()];
  report.kept = candidates.length;
  report.samples = candidates.slice(0,3).map(c=>({title:c.title,url:c.url,publishedAt:c.publishedAt?.toISOString() ?? null}));
  report.completedAt = new Date().toISOString();
  return { candidates, evidence: report };
}

export async function collectMedicalSource(id: string, opts: { force?: boolean; process?: boolean } = {}): Promise<Record<string,unknown>> {
  let report: SourceEvidence | undefined;
  const result: CollectResult = await collectSource(id,{...opts,initialLimit:10_000,externalFetch:async()=>{
    const preview = await previewMedicalSource(id);
    report = preview.evidence;
    // A refused endpoint is a failed fetch, with the existing source backoff and health record.
    if (report.errors.length && !preview.candidates.length) throw new Error(report.errors.map(e=>e.error).join("; "));
    return preview.candidates;
  }});
  const [run] = await sql<{id:number}[]>`SELECT id FROM fetch_runs WHERE source_id=${id} ORDER BY id DESC LIMIT 1`;
  if (run && report) await sql`UPDATE fetch_runs SET detail=coalesce(detail,'{}'::jsonb)||${sql.json({ medical: report } as never)} WHERE id=${run.id}`;
  return { ...result,evidence:report };
}
