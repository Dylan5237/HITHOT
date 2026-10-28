/** Public endpoints and issuer identities verified against the sources' own pages. */
export interface MedicalSource {
  id: string; name: string; adapter: "cninfo" | "winning" | "bsoft" | "dhcc" | "goodwill" | "ccgp" | "xian" | "ggzy" | "ratings" | "hkex" | "gov_cms" | "unavailable";
  url: string; code?: string; orgId?: string; column?: string; query?: string; unavailable?: string;
}
export const MEDICAL_SOURCES: readonly MedicalSource[] = [
  { id: "web-nhsa-policy", name: "国家医保局 政策法规", adapter: "gov_cms", url: "https://www.nhsa.gov.cn/col/col104/index.html" },
  { id: "web-nhsa-notice", name: "国家医保局 通知公告", adapter: "gov_cms", url: "https://www.nhsa.gov.cn/col/col109/index.html" },
  { id: "web-nhsa-interpretation", name: "国家医保局 政策解读", adapter: "gov_cms", url: "https://www.nhsa.gov.cn/col/col105/index.html" },
  { id: "web-jiangsu-ybj-notice", name: "江苏省医保局 通知公告", adapter: "gov_cms", url: "https://ybj.jiangsu.gov.cn/col/col73935/index.html?number=" },
  { id: "web-jiangsu-health-files", name: "江苏省卫健委 发文通知", adapter: "gov_cms", url: "https://wjw.jiangsu.gov.cn/col/col49511/index.html" },
  { id: "cninfo-winning", name: "卫宁健康 巨潮公告", adapter: "cninfo", url: "https://www.cninfo.com.cn/new/hisAnnouncement/query", code: "300253", orgId: "9900012530", column: "szse" },
  { id: "cninfo-neusoft", name: "东软集团 巨潮公告", adapter: "cninfo", url: "https://www.cninfo.com.cn/new/hisAnnouncement/query", code: "600718", orgId: "gssh0600718", column: "sse" },
  { id: "cninfo-bsoft", name: "创业慧康 巨潮公告", adapter: "cninfo", url: "https://www.cninfo.com.cn/new/hisAnnouncement/query", code: "300451", orgId: "9900023801", column: "szse" },
  { id: "cninfo-dhcc", name: "东华软件 巨潮公告", adapter: "cninfo", url: "https://www.cninfo.com.cn/new/hisAnnouncement/query", code: "002065", orgId: "9900000405", column: "szse" },
  { id: "cninfo-goodwill", name: "嘉和美康 巨潮公告", adapter: "cninfo", url: "https://www.cninfo.com.cn/new/hisAnnouncement/query", code: "688246", orgId: "nssc1000020", column: "sse" },
  { id: "web-winning-news", name: "卫宁健康 官网新闻", adapter: "winning", url: "https://www.winning.com.cn:81/api/news" },
  { id: "xian-hospital-results", name: "西安交大二附院 中标公告", adapter: "xian", url: "https://www.xjefy.cn/defsyy/zbc/zbgg.htm" },
  { id: "web-bsoft-news", name: "创业慧康 官网新闻", adapter: "bsoft", url: "https://www.bsoft.com.cn/bsoft/newsInfo/getNewsList", unavailable: "Public endpoint returned an invalid HTTP status line (HPE_CR_EXPECTED) in both standard Node transports; no verified stable article permalink" },
  { id: "web-dhcc-news", name: "东华软件 官网新闻", adapter: "dhcc", url: "https://www.dhcc.com.cn/enterprise_news.html", unavailable: "robots.txt disallows all paths for User-agent: *; the Baiduspider exception is not used" },
  { id: "web-goodwill-news", name: "嘉和美康 官网新闻", adapter: "goodwill", url: "https://www.bjgoodwill.com/news.aspx?id=165", unavailable: "Public list contains old undated items; four detail pages expose no verifiable publication date, so a 60-day backfill cannot be established" },
  { id: "web-neusoft-news", name: "东软集团 官网新闻", adapter: "unavailable", url: "https://www.neusoft.com/cn/news/", unavailable: "Website terms section 5.1 restrict use/copying without written permission; issuer disclosures remain the alternative" },
  { id: "ccgp-results", name: "中国政府采购网 中标成交结果", adapter: "ccgp", url: "https://search.ccgp.gov.cn/bxsearch", unavailable: "Public search returned the explicit 频繁访问 restriction page (HTTP 200); abandoned without bypass" },
  { id: "ggzy-results", name: "全国公共资源交易平台 中标成交结果", adapter: "ggzy", url: "https://www.ggzy.gov.cn/deal/dealList.html?HEADER_DEAL_TYPE=02", unavailable: "Public result search works, but sampled detail did not yield verifiable institution/amount fields and a second detail read timed out; ingestion remains unverified" },
  { id: "official-emr-ratings", name: "官方电子病历评级通过名单", adapter: "ratings", url: "https://sousuo.www.gov.cn/search-gov/data", query: "电子病历 分级评价 名单", unavailable: "Production robots.txt disallows this search endpoint; original rating publisher requires a captcha or fails TLS verification" },
  { id: "official-connectivity-ratings", name: "官方互联互通测评通过名单", adapter: "ratings", url: "https://sousuo.www.gov.cn/search-gov/data", query: "互联互通 测评 名单", unavailable: "Production robots.txt disallows this search endpoint; original publisher presents an access challenge" },
  { id: "hkex-yidu", name: "医渡科技 港交所公告", adapter: "hkex", url: "https://www1.hkexnews.hk/search/titlesearch.xhtml?lang=zh", code: "02158", unavailable: "HKEX Terms of Use section 5 prohibits programmatic access and text/data mining without written permission (2025-08-19)" },
  { id: "hkex-iflytek", name: "讯飞医疗 港交所公告", adapter: "hkex", url: "https://www1.hkexnews.hk/search/titlesearch.xhtml?lang=zh", code: "02506", unavailable: "HKEX Terms of Use section 5 prohibits programmatic access and text/data mining without written permission (2025-08-19)" },
  { id: "web-cn-healthcare", name: "健康界", adapter: "unavailable", url: "https://www.cn-healthcare.com/", unavailable: "Public HTML is an access challenge rather than a stable readable news listing; no bypass" },
  { id: "web-iyiou-health", name: "亿欧大健康", adapter: "unavailable", url: "https://www.iyiou.com/", unavailable: "robots.txt returned HTTP 202; permission could not be established" },
  { id: "nmg-results", name: "内蒙古政府采购网 中标成交结果", adapter: "unavailable", url: "https://www.ccgp-neimenggu.gov.cn/", unavailable: "Public list responds, but reliable result-only filtering and complete dated pagination have not been verified; no raw responses or personal fields will be ingested" },
  { id: "hlj-results", name: "黑龙江政府采购网 中标成交结果", adapter: "unavailable", url: "https://hljcg.hlj.gov.cn/", unavailable: "Public list API returned code 4009; no authentication or encryption workaround attempted" },
];
