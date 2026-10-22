// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（教程、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * tagColor 是飞书推送卡片里跟在标题后面的这一类小标签的颜色（飞书 text_tag 的颜色名）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "policy", tagColor: "red", label: "政策", feedLabel: "政策标准", section: "政策与标准", guide: "卫健、医保、药监、中医药、疾控、数据、网信等部门及地方主管部门正式发布或征求意见的政策文件、标准规范、评级评审方案与结果通报，以及 HL7、IHE 等标准组织的正式版本。媒体或专家对政策的解读归观点；医院按政策做的建设归实践。" },
  { key: "med-ai", tagColor: "indigo", label: "医疗AI", feedLabel: "医疗 AI", section: "医疗 AI", guide: "医疗大模型、AI 辅助诊断与临床决策、AI 病历与质控、AI 医疗器械注册获批，以及 AI 在医院、医保、公卫场景的落地。只是顺带提到 AI 的普通信息化产品归产品；以研究方法与实验结果为核心的 AI 论文归研究；关于 AI 的监管文件归政策。" },
  { key: "products", tagColor: "turquoise", label: "产品", feedLabel: "产品与方案", section: "产品与方案", guide: "厂商发布或更新的 HIS、EMR、PACS、LIS、集成平台、数据中台、互联网医院、医保与公卫系统等产品和解决方案，以及面向医疗的云、信创、网络安全产品。厂商在某家医院的上线案例归实践；厂商经营、中标和融资归行业。" },
  { key: "practice", tagColor: "green", label: "实践", feedLabel: "建设实践", section: "建设与实践", guide: "医院、医联体/医共体、区域卫生平台的信息化项目上线、评级通过、建设与运营经验复盘，重点是可借鉴的做法、规模与效果。只有宣传口号、没有做法和数据的案例稿仍放这里但不加分。" },
  { key: "industry", tagColor: "orange", label: "行业", feedLabel: "行业动态", section: "行业动态", guide: "已发生的厂商经营（财报、订单、裁员）、融资并购、招投标与中标、人事变动、合作签约、诉讼处罚、数据泄露与网络安全事故及调查进展。政策文件本身归政策。" },
  { key: "research", tagColor: "violet", label: "研究", feedLabel: "研究与报告", section: "研究与报告", guide: "以研究方法、实验设计与发现为核心的论文，以及有原始数据的行业报告、白皮书、统计公报和调查。只有观点、没有数据和方法的报告归观点。" },
  { key: "opinion", tagColor: "purple", label: "观点", feedLabel: "观点解读", section: "观点与解读", guide: "政策解读、专家与 CIO 访谈、趋势判断、评论与教程式经验分享。重点是作者的解释与判断；作者是官员或名人不自动归政策。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布：医疗信息化读者最关心新出台的政策与标准，日报报头显示“N 份新政策”。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "policy", tag: "政策发布", unit: "份新政策" };

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = ["ai", "it", "cio", "his", "emr", "pacs", "lis", "cdss", "drg", "dip", "fhir", "hl7", "api", "ceo", "ipo"];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["policy_release", "standard_or_rating", "product_launch", "project_practice", "research_report", "industry_event", "opinion_analysis"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "政策发布", "征求意见", "标准规范", "评级评审", "医保支付", "医疗AI", "产品发布", "建设实践", "招投标/中标", "企业经营", "融资并购",
  "安全事件", "研究/报告", "观点解读", "非医疗/通用IT", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "电子病历", "互联互通", "智慧服务", "智慧管理", "互联网医院", "医疗大模型", "医学影像", "检验/病理", "护理信息化", "HIS/核心系统", "集成平台/数据中台",
  "全民健康信息平台", "医共体/基层", "DRG/DIP", "医保信息平台", "医疗数据要素", "网络与数据安全", "信创", "云/基础设施", "公共卫生/疾控", "中医药",
  "药械追溯", "FHIR/互操作", "数字疗法/可穿戴",
] as const;

/** 可选的实体标签（机构、公司）。 */
export const ENTITY_TAGS = ["国家卫健委", "国家医保局", "国家药监局", "国家数据局", "卫宁健康", "东软", "万达信息", "创业慧康", "医渡科技", "讯飞医疗", "联影", "Epic", "Oracle Health", "Microsoft", "Google"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  政策: "政策发布", 通知: "政策发布", 文件: "政策发布", 法规: "政策发布", 监管: "政策发布", "政策/监管": "政策发布", 意见稿: "征求意见", 征求意见稿: "征求意见",
  标准: "标准规范", 规范: "标准规范", 指南: "标准规范", 评级: "评级评审", 评审: "评级评审", 测评: "评级评审", 分级评价: "评级评审",
  医保: "医保支付", 支付: "医保支付", 支付改革: "医保支付", ai: "医疗AI", 人工智能: "医疗AI", 大模型: "医疗AI", "医疗 AI": "医疗AI",
  产品: "产品发布", 发布: "产品发布", 产品更新: "产品发布", 解决方案: "产品发布", 案例: "建设实践", 实践: "建设实践", 上线: "建设实践", 项目: "建设实践",
  中标: "招投标/中标", 招标: "招投标/中标", 采购: "招投标/中标", 财报: "企业经营", 业绩: "企业经营", 行业动态: "企业经营", 公司动态: "企业经营",
  融资: "融资并购", 收购: "融资并购", 并购: "融资并购", 投资: "融资并购", 数据泄露: "安全事件", 勒索: "安全事件", 安全事故: "安全事件",
  论文: "研究/报告", 研究: "研究/报告", 报告: "研究/报告", 白皮书: "研究/报告", 观点: "观点解读", 解读: "观点解读", 访谈: "观点解读", 趋势: "观点解读",
  电子病历评级: "电子病历", emr: "电子病历", 互联互通测评: "互联互通", drg: "DRG/DIP", dip: "DRG/DIP", 国产化: "信创", 数据安全: "网络与数据安全", 网络安全: "网络与数据安全",
  数据要素: "医疗数据要素", 医共体: "医共体/基层", 基层医疗: "医共体/基层", fhir: "FHIR/互操作", hl7: "FHIR/互操作", pacs: "医学影像", 影像: "医学影像", lis: "检验/病理",
  非医疗: "非医疗/通用IT", 通用IT: "非医疗/通用IT",
};

// ── 机构与公司 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；orgNames 是这家机构发消息时开头用的组织名，在它自己的主题页上可以省去；
 * otherNames 是其他称呼（官方账号名、子品牌）。所有这些名字都用来认出说的是哪家机构。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  nhc: { name: "国家卫健委", displayTag: "国家卫健委", aliases: ["国家卫健委", "国家卫生健康委", "国家卫生健康委员会", "卫健委", "NHC"], orgNames: ["国家卫生健康委员会", "国家卫生健康委", "国家卫健委"], otherNames: ["国家卫生健康委统计信息中心", "国家卫健委统计信息中心", "国家卫生健康委医院管理研究所"] },
  nhsa: { name: "国家医保局", displayTag: "国家医保局", aliases: ["国家医保局", "国家医疗保障局", "医保局", "NHSA"], orgNames: ["国家医疗保障局", "国家医保局"] },
  nmpa: { name: "国家药监局", displayTag: "国家药监局", aliases: ["国家药监局", "国家药品监督管理局", "药监局", "NMPA"], orgNames: ["国家药品监督管理局", "国家药监局"], otherNames: ["国家药监局医疗器械技术审评中心", "器审中心"] },
  nda: { name: "国家数据局", displayTag: "国家数据局", aliases: ["国家数据局", "NDA"], orgNames: ["国家数据局"] },
  natcm: { name: "国家中医药局", displayTag: null, aliases: ["国家中医药局", "国家中医药管理局"], orgNames: ["国家中医药管理局", "国家中医药局"] },
  ndcpa: { name: "国家疾控局", displayTag: null, aliases: ["国家疾控局", "国家疾病预防控制局"], orgNames: ["国家疾病预防控制局", "国家疾控局"] },
  winning: { name: "卫宁健康", displayTag: "卫宁健康", aliases: ["卫宁健康", "卫宁", "Winning Health"], orgNames: ["卫宁健康科技集团", "卫宁健康"], otherNames: ["WiNEX", "WiNGPT"] },
  neusoft: { name: "东软", displayTag: "东软", aliases: ["东软集团", "东软", "Neusoft"], orgNames: ["东软集团", "东软"] },
  wonders: { name: "万达信息", displayTag: "万达信息", aliases: ["万达信息", "Wonders Information"], orgNames: ["万达信息"] },
  bsoft: { name: "创业慧康", displayTag: "创业慧康", aliases: ["创业慧康", "B-Soft"], orgNames: ["创业慧康"] },
  dhcc: { name: "东华医为", displayTag: null, aliases: ["东华医为", "东华软件"], orgNames: ["东华医为", "东华软件"] },
  goodwill: { name: "嘉和美康", displayTag: null, aliases: ["嘉和美康"], orgNames: ["嘉和美康"] },
  yidu: { name: "医渡科技", displayTag: "医渡科技", aliases: ["医渡科技", "医渡", "Yidu Tech"], orgNames: ["医渡科技"] },
  "iflytek-health": { name: "讯飞医疗", displayTag: "讯飞医疗", aliases: ["讯飞医疗", "讯飞晓医", "智医助理"], orgNames: ["讯飞医疗", "科大讯飞"] },
  "united-imaging": { name: "联影", displayTag: "联影", aliases: ["联影医疗", "联影智能", "联影", "United Imaging"], orgNames: ["联影医疗", "联影智能"] },
  "tencent-health": { name: "腾讯健康", displayTag: null, aliases: ["腾讯健康", "腾讯医疗", "腾讯觅影"], orgNames: ["腾讯健康", "腾讯"] },
  "alibaba-health": { name: "阿里健康", displayTag: null, aliases: ["阿里健康"], orgNames: ["阿里健康"] },
  "jd-health": { name: "京东健康", displayTag: null, aliases: ["京东健康"], orgNames: ["京东健康"] },
  "pingan-health": { name: "平安健康", displayTag: null, aliases: ["平安健康", "平安好医生"], orgNames: ["平安健康"] },
  "baidu-health": { name: "百度灵医", displayTag: null, aliases: ["百度灵医", "灵医智惠", "灵医大模型"], orgNames: ["百度灵医", "百度"] },
  huawei: { name: "华为", displayTag: null, aliases: ["华为", "Huawei"], orgNames: ["华为"] },
  epic: { name: "Epic", displayTag: "Epic", aliases: ["Epic", "Epic Systems", "MyChart"], orgNames: ["Epic Systems", "Epic"] },
  "oracle-health": { name: "Oracle Health", displayTag: "Oracle Health", aliases: ["Oracle Health", "Cerner", "甲骨文健康"], orgNames: ["Oracle Health", "Oracle"] },
  microsoft: { name: "Microsoft / Nuance", displayTag: "Microsoft", aliases: ["Microsoft", "微软", "Nuance", "Dragon Copilot", "DAX Copilot"], orgNames: ["Microsoft", "微软", "Nuance"] },
  google: { name: "Google Health", displayTag: "Google", aliases: ["Google", "谷歌", "Google Health", "DeepMind"], orgNames: ["Google Health", "Google DeepMind", "Google Research", "Google", "谷歌"] },
};

/**
 * 身份词典：摘要和标题里出现的机构或公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "nhc", name: "国家卫健委", patterns: [/卫生健康委|卫健委/] },
  { id: "nhsa", name: "国家医保局", patterns: [/医疗保障局|医保局/] },
  { id: "nmpa", name: "国家药监局", patterns: [/药品监督管理局|药监局|\bNMPA\b/] },
  { id: "nda", name: "国家数据局", patterns: [/国家数据局/] },
  { id: "winning", name: "卫宁健康", patterns: [/卫宁|\bWiNEX\b|\bWiNGPT\b/i] },
  { id: "neusoft", name: "东软", patterns: [/东软|\bneusoft\b/i] },
  { id: "wonders", name: "万达信息", patterns: [/万达信息/] },
  { id: "bsoft", name: "创业慧康", patterns: [/创业慧康/] },
  { id: "dhcc", name: "东华医为", patterns: [/东华医为|东华软件/] },
  { id: "goodwill", name: "嘉和美康", patterns: [/嘉和美康/] },
  { id: "yidu", name: "医渡科技", patterns: [/医渡/] },
  { id: "iflytek-health", name: "讯飞医疗", patterns: [/讯飞|iflytek/i] },
  { id: "united-imaging", name: "联影", patterns: [/联影|united\s?imaging/i] },
  { id: "tencent-health", name: "腾讯健康", patterns: [/腾讯|tencent/i] },
  { id: "alibaba-health", name: "阿里健康", patterns: [/阿里健康|alibaba\s?health/i] },
  { id: "jd-health", name: "京东健康", patterns: [/京东健康|jd\s?health/i] },
  { id: "pingan-health", name: "平安健康", patterns: [/平安健康|平安好医生|ping\s?an/i] },
  { id: "baidu-health", name: "百度灵医", patterns: [/百度|灵医|baidu/i] },
  { id: "huawei", name: "华为", patterns: [/华为|huawei/i] },
  { id: "epic", name: "Epic", patterns: [/\bEpic(?:\s+Systems)?\b/, /\bMyChart\b/i] },
  { id: "oracle-health", name: "Oracle Health", patterns: [/oracle|cerner|甲骨文/i] },
  { id: "microsoft", name: "Microsoft / Nuance", patterns: [/microsoft|微软|nuance|\b(?:dax|dragon)\s+copilot\b/i] },
  { id: "google", name: "Google", patterns: [/google|谷歌|deepmind/i] },
];

/** 这些域名上的文章，发布方就是对应的机构或公司（托管平台、期刊平台不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "nhc", domains: ["nhc.gov.cn"] },
  { entityId: "nhsa", domains: ["nhsa.gov.cn"] },
  { entityId: "nmpa", domains: ["nmpa.gov.cn"] },
  { entityId: "nda", domains: ["nda.gov.cn"] },
  { entityId: "yidu", domains: ["yidutech.com"] },
  { entityId: "iflytek-health", domains: ["xunfeihealthcare.com"] },
  { entityId: "epic", domains: ["epic.com"] },
  { entityId: "google", domains: ["blog.google", "health.google"] },
];

/** 原文里的这些写法也算提到了对应机构。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "nhc", pattern: /国卫[\u4e00-\u9fa5]{0,4}(?:发|函|便函)〔\d{4}〕/ },
  { entityId: "nhsa", pattern: /医保[\u4e00-\u9fa5]{0,4}(?:发|函)〔\d{4}〕/ },
  { entityId: "nmpa", pattern: /国药监[\u4e00-\u9fa5]{0,4}〔\d{4}〕/ },
];
