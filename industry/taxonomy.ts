// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（教程、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "policy", label: "政策监管", feedLabel: "政策与监管", section: "政策与标准", guide: "已发布或公开征求意见的法律法规、部门规章、规范性文件、行业标准（WS/T 等）、测评与评级办法、试点方案、监管处罚，以及 AI 医疗器械注册审批、算法备案、医疗服务价格立项的进展。政策草案进入征求意见算这一类；厂商解读政策归观点。" },
  { key: "product", label: "产品应用", feedLabel: "产品与应用", section: "产品与应用", guide: "可用的医疗 AI 产品、系统、功能、模块、API 与平台的发布和更新：医疗大模型、AI 辅助诊断、临床决策支持、智能病历与语音录入、智能预问诊与导诊、医保智能审核、影像与病理 AI、患者服务与随访。厂商自己发的产品稿只要讲了能力、范围或可用状态就算这一类；只讲医院怎么用归医院落地。" },
  { key: "hospital", label: "医院落地", section: "医院落地", guide: "医疗机构侧的真实部署与应用：上线、试点、扩科、成效数据（效率、质量、成本）、电子病历系统功能应用水平分级评价与医院信息互联互通标准化成熟度测评的结果、院内信息化项目招标与验收。主体是医院或医疗集团；厂商单方面的产品发布归产品应用。" },
  { key: "data", label: "数据标准", section: "数据与互操作", guide: "数据与互操作层面的进展：FHIR/HL7/DICOM 等标准的版本与实施指南、卫生信息数据集与共享文档规范、术语与编码（ICD、手术操作分类）、医疗数据要素流通与授权运营、数据质量治理、隐私计算与可信数据空间的技术方案。标准正式发布归政策监管也可以，看它是法规文件还是技术规范：带文号的行政文件归政策，技术规范与实施指南归这一类。" },
  { key: "research", label: "研究评测", section: "研究与评测", guide: "以新方法、实验设计与发现为核心的论文、临床研究、多中心验证、技术报告、公开基准与评测数据集，以及 AI 医疗器械的临床试验与真实世界研究结果。既有产品拿到注册证是审批新闻，归政策监管；厂商发的跑分成绩归产品应用。" },
  { key: "industry", label: "产业动态", feedLabel: "产业与市场", section: "产业动态", guide: "已发生的经营与合作事实：融资、并购、上市与财报、人事变动、战略合作与签约、招投标中标、机构设立与撤并、诉讼，以及真实的医疗数据安全事件与调查进展。新闻由当事方发布、带有态度，也不因此变成观点；作者的分析与预测归观点。" },
  { key: "safety", label: "安全伦理", section: "安全与伦理", guide: "医疗 AI 的风险面：误诊漏诊与不良事件、算法偏见与失效、患者隐私泄露与数据安全事件、知情同意与责任归属、伦理审查意见、监管通报与召回。真实发生的安全事件与调查归产业动态还是这一类，看重点：重点是损失与伦理争议归这一类，重点是企业经营影响归产业动态。" },
  { key: "viewpoint", label: "观点实践", feedLabel: "观点与实践", section: "观点与实践", guide: "重点是作者的解释、判断、主张、预测、评论，或可照着做的实施经验与方法复盘：CIO 访谈、建设方案解读、选型与运维经验、落地踩坑、政策与趋势分析。有可复用做法的归这一类里的实践；单纯发布产品归产品应用，只有态度和预测而无做法也归这一类。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（医疗 AI 行业是新产品上线）：日报报头的“N 个新产品”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 * 没有这样一类的行业设成 null，报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "product", tag: "产品发布", unit: "个新产品" };

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = [
  "ai", "llm", "api", "cdss", "emr", "ehr", "his", "pacs", "lis", "ris", "fhir", "hl7", "dicom", "icd",
  "drg", "dip", "nlp", "rag", "agent", "cio", "hit", "saas", "gpu",
];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = [
  "policy_standard", "regulatory_approval", "product_launch", "hospital_deployment",
  "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer",
] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "政策/法规", "标准/规范", "产品发布", "审批/准入", "医院应用", "论文/研究", "评测/基准",
  "数据/互操作", "安全/伦理", "产业动态", "观点/评论", "实践/方法", "非医疗AI", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "医疗大模型", "AI辅助诊断", "医学影像", "病理AI", "临床决策支持", "电子病历", "语音病历",
  "智慧医院", "智能问诊", "医保智能审核", "DRG/DIP", "互联互通", "FHIR", "数据要素",
  "隐私计算", "多模态", "Agent", "基层医疗", "患者服务", "科研平台", "运维/部署",
] as const;

/** 可选的实体标签（公司、机构、平台）。 */
export const ENTITY_TAGS = [
  "国家卫健委", "国家医保局", "国家药监局", "中国信通院", "HL7", "讯飞医疗", "联影智能", "医渡科技",
  "卫宁健康", "东软集团", "创业慧康", "东华医为", "嘉和美康", "腾讯健康", "京东健康", "阿里健康",
  "华为", "Epic", "Oracle Health", "微软", "谷歌健康", "西门子医疗",
] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  政策: "政策/法规", 监管: "政策/法规", 法规: "政策/法规", 文件: "政策/法规", 通知: "政策/法规", 意见: "政策/法规",
  规划: "政策/法规", 试点: "政策/法规", 处罚: "政策/法规",
  标准: "标准/规范", 规范: "标准/规范", 指南: "标准/规范", 行业标准: "标准/规范", "ws/t": "标准/规范", 团体标准: "标准/规范",
  产品: "产品发布", 发布: "产品发布", 上线: "产品发布", 更新: "产品发布", 新品: "产品发布", 功能: "产品发布",
  审批: "审批/准入", 准入: "审批/准入", 注册证: "审批/准入", 三类证: "审批/准入", 备案: "审批/准入", 获批: "审批/准入", 物价: "审批/准入",
  医院: "医院应用", 落地: "医院应用", 部署: "医院应用", 应用: "医院应用", 案例: "医院应用", 上线医院: "医院应用", 评级: "医院应用",
  电子病历分级: "医院应用", 互联互通测评: "互联互通", 招标: "医院应用", 中标: "产业动态",
  论文: "论文/研究", 研究: "论文/研究", paper: "论文/研究", papers: "论文/研究", 临床研究: "论文/研究", 试验: "论文/研究",
  评测: "评测/基准", 基准: "评测/基准", benchmark: "评测/基准", 榜单: "评测/基准", 跑分: "评测/基准",
  数据: "数据/互操作", 互操作: "数据/互操作", 数据集: "数据/互操作", 术语: "数据/互操作", 编码: "数据/互操作",
  安全: "安全/伦理", 伦理: "安全/伦理", 隐私: "安全/伦理", 泄露: "安全/伦理", 误诊: "安全/伦理", 不良事件: "安全/伦理", 召回: "安全/伦理",
  融资: "产业动态", 收购: "产业动态", 并购: "产业动态", 投资: "产业动态", 合作: "产业动态", 生态: "产业动态",
  签约: "产业动态", 人事: "产业动态", 财报: "产业动态", 上市: "产业动态", 公司动态: "产业动态", 行业: "产业动态", 动态: "产业动态",
  观点: "观点/评论", 评论: "观点/评论", 分析: "观点/评论", 解读: "观点/评论", 趋势: "观点/评论", 访谈: "观点/评论", 大佬观点: "观点/评论",
  教程: "实践/方法", 实践: "实践/方法", 方法: "实践/方法", 经验: "实践/方法", 复盘: "实践/方法", 玩法: "实践/方法", 最佳实践: "实践/方法",
  大模型: "医疗大模型", 医疗大模型: "医疗大模型", 影像: "医学影像", 放射: "医学影像", 病理: "病理AI",
  决策支持: "临床决策支持", 病历: "电子病历", 语音录入: "语音病历", 问诊: "智能问诊", 预问诊: "智能问诊", 导诊: "智能问诊",
  医保: "医保智能审核", 审核: "医保智能审核", 控费: "医保智能审核", 支付改革: "DRG/DIP",
  fhir: "FHIR", hl7: "HL7", 隐私计算: "隐私计算", 联邦学习: "隐私计算", 数据要素: "数据要素", 授权运营: "数据要素",
  多模态: "多模态", 智能体: "Agent", 基层: "基层医疗", 患者: "患者服务", 随访: "患者服务", 科研: "科研平台", 运维: "运维/部署",
  "non-medical": "非医疗AI", 通用工具: "非医疗AI", 非医疗: "非医疗AI",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；otherNames 是公司自己的其他称呼（官方账号名、子品牌），
 * 把事实的主体对到发布方时也认它们。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  nhc: { name: "国家卫生健康委", displayTag: "国家卫健委", aliases: ["国家卫生健康委", "国家卫健委", "卫健委"], otherNames: ["国家卫生健康委统计信息中心", "国家卫健委统计信息中心"] },
  nhsa: { name: "国家医疗保障局", displayTag: "国家医保局", aliases: ["国家医疗保障局", "国家医保局", "医保局"] },
  nmpa: { name: "国家药品监督管理局", displayTag: "国家药监局", aliases: ["国家药品监督管理局", "国家药监局", "药监局"], otherNames: ["国家药监局器审中心", "医疗器械技术审评中心"] },
  miit: { name: "工业和信息化部", displayTag: null, aliases: ["工业和信息化部", "工信部"] },
  caict: { name: "中国信息通信研究院", displayTag: "中国信通院", aliases: ["中国信息通信研究院", "中国信通院", "信通院"] },
  hl7: { name: "HL7 International", displayTag: "HL7", aliases: ["HL7", "Health Level Seven"], otherNames: ["HL7 International", "FHIR", "HL7 FHIR"] },
  "iflytek-medical": { name: "讯飞医疗", displayTag: "讯飞医疗", aliases: ["讯飞医疗", "科大讯飞医疗", "讯飞医疗科技"], otherNames: ["讯飞晓医", "星火医疗大模型", "科大讯飞"] },
  "united-imaging-intelligence": { name: "联影智能", displayTag: "联影智能", aliases: ["联影智能", "上海联影智能科技"], otherNames: ["uAI", "联影智能医疗"] },
  "united-imaging": { name: "联影医疗", displayTag: null, aliases: ["联影医疗", "上海联影医疗科技"], otherNames: ["United Imaging"] },
  yidu: { name: "医渡科技", displayTag: "医渡科技", aliases: ["医渡科技", "医渡云"], otherNames: ["Yidu Tech", "医渡（北京）技术有限公司"] },
  infervision: { name: "推想医疗", displayTag: null, aliases: ["推想医疗", "推想科技"], otherNames: ["InferVision", "推想"] },
  deepwise: { name: "深睿医疗", displayTag: null, aliases: ["深睿医疗", "深睿"], otherNames: ["Deepwise", "深睿博士"] },
  shukun: { name: "数坤科技", displayTag: null, aliases: ["数坤科技", "数坤"], otherNames: ["Shukun", "数坤数字心", "数字人体"] },
  airdoc: { name: "鹰瞳科技", displayTag: null, aliases: ["鹰瞳科技", "鹰瞳"], otherNames: ["Airdoc", "鹰瞳Airdoc"] },
  zuoshou: { name: "左手医生", displayTag: null, aliases: ["左手医生"], otherNames: ["左手君"] },
  "baidu-health": { name: "百度灵医智惠", displayTag: null, aliases: ["灵医智惠", "百度灵医智惠"], otherNames: ["灵医大模型", "百度健康", "文心医疗"] },
  winning: { name: "卫宁健康", displayTag: "卫宁健康", aliases: ["卫宁健康", "卫宁"], otherNames: ["Winning Health", "WiNEX", "卫宁互联网", "纳里健康"] },
  neusoft: { name: "东软集团", displayTag: "东软集团", aliases: ["东软集团", "东软"], otherNames: ["Neusoft", "东软医疗", "东软熙康", "东软望海", "添翼健康"] },
  bsoft: { name: "创业慧康", displayTag: null, aliases: ["创业慧康", "慧康"], otherNames: ["B-Soft", "创业慧康科技股份有限公司"] },
  dhcc: { name: "东华医为", displayTag: null, aliases: ["东华医为", "东华软件医疗"], otherNames: ["iMedical", "东华医为科技有限公司"] },
  meikang: { name: "嘉和美康", displayTag: null, aliases: ["嘉和美康"], otherNames: ["嘉和美康（北京）科技股份有限公司", "美康"] },
  "tencent-health": { name: "腾讯健康", displayTag: "腾讯健康", aliases: ["腾讯健康", "腾讯医疗"], otherNames: ["腾讯觅影", "觅影", "腾讯 healthcare", "微信医疗健康", "腾讯AI Lab"] },
  "jd-health": { name: "京东健康", displayTag: null, aliases: ["京东健康"], otherNames: ["JD Health", "京医千询", "京东健康互联网医院"] },
  "ali-health": { name: "阿里健康", displayTag: null, aliases: ["阿里健康"], otherNames: ["Alibaba Health", "医鹿"] },
  ant: { name: "蚂蚁集团", displayTag: null, aliases: ["蚂蚁集团", "蚂蚁AQ"], otherNames: ["AQ", "安诊儿", "支付宝医疗健康", "蚂蚁数字医疗"] },
  huawei: { name: "华为", displayTag: null, aliases: ["华为"], otherNames: ["Huawei", "华为云", "华为云医疗", "盘古"] },
  epic: { name: "Epic", displayTag: "Epic", aliases: ["Epic", "Epic Systems"], otherNames: ["Epic Systems Corporation"] },
  "oracle-health": { name: "Oracle Health", displayTag: null, aliases: ["Oracle Health", "Cerner"], otherNames: ["甲骨文医疗", "Cerner Millennium"] },
  microsoft: { name: "微软", displayTag: null, aliases: ["微软", "Microsoft"], otherNames: ["Nuance", "DAX Copilot", "Dragon Medical", "Microsoft Health"] },
  "google-health": { name: "谷歌健康", displayTag: null, aliases: ["Google Health", "谷歌健康"], otherNames: ["DeepMind Health", "AMIE", "Med-PaLM", "MedGemini"] },
  "siemens-healthineers": { name: "西门子医疗", displayTag: null, aliases: ["西门子医疗", "Siemens Healthineers"], otherNames: ["AI-Rad Companion"] },
  "ge-healthcare": { name: "GE医疗", displayTag: null, aliases: ["GE医疗", "GE HealthCare", "通用电气医疗"] },
  philips: { name: "飞利浦医疗", displayTag: null, aliases: ["飞利浦", "飞利浦医疗", "Philips"], otherNames: ["Philips Healthcare"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "nhc", name: "国家卫生健康委", patterns: [/国家卫生健康委|国家卫健委|卫健委|\bNHC\b/i] },
  { id: "nhsa", name: "国家医疗保障局", patterns: [/国家医疗保障局|国家医保局|医保局|\bNHSA\b/i] },
  { id: "nmpa", name: "国家药品监督管理局", patterns: [/国家药品监督管理局|国家药监局|药监局|\bNMPA\b/i] },
  { id: "caict", name: "中国信息通信研究院", patterns: [/中国信息通信研究院|中国信通院|信通院|\bCAICT\b/i] },
  { id: "hl7", name: "HL7 / FHIR", patterns: [/\bHL7\b|\bFHIR\b/i] },
  { id: "iflytek-medical", name: "讯飞医疗", patterns: [/讯飞医疗|科大讯飞|讯飞晓医|\biFLYTEK\b/i] },
  { id: "united-imaging-intelligence", name: "联影智能", patterns: [/联影智能/] },
  { id: "united-imaging", name: "联影医疗", patterns: [/联影医疗|联影集团/] },
  { id: "yidu", name: "医渡科技", patterns: [/医渡科技|医渡云|Yidu/i] },
  { id: "infervision", name: "推想医疗", patterns: [/推想医疗|推想科技|InferVision/i] },
  { id: "deepwise", name: "深睿医疗", patterns: [/深睿医疗|深睿|Deepwise/i] },
  { id: "shukun", name: "数坤科技", patterns: [/数坤科技|数坤|Shukun/i] },
  { id: "airdoc", name: "鹰瞳科技", patterns: [/鹰瞳科技|鹰瞳|Airdoc/i] },
  { id: "zuoshou", name: "左手医生", patterns: [/左手医生/] },
  { id: "baidu-health", name: "百度灵医智惠", patterns: [/灵医智惠|灵医大模型|百度健康|文心/i] },
  { id: "winning", name: "卫宁健康", patterns: [/卫宁健康|卫宁|Winning\s*Health|\bWiNEX\b/i] },
  { id: "neusoft", name: "东软集团", patterns: [/东软集团|东软医疗|东软熙康|东软望海|\bNeusoft\b/i] },
  { id: "bsoft", name: "创业慧康", patterns: [/创业慧康|B-?Soft/i] },
  { id: "dhcc", name: "东华医为", patterns: [/东华医为|iMedical|东华软件/i] },
  { id: "meikang", name: "嘉和美康", patterns: [/嘉和美康/] },
  { id: "tencent-health", name: "腾讯健康", patterns: [/腾讯健康|腾讯觅影|觅影|腾讯医疗/] },
  { id: "jd-health", name: "京东健康", patterns: [/京东健康|京医千询|JD\s*Health/i] },
  { id: "ali-health", name: "阿里健康", patterns: [/阿里健康|Alibaba\s*Health/i] },
  { id: "ant", name: "蚂蚁集团", patterns: [/蚂蚁集团|蚂蚁数科|支付宝医疗|\bAQ\b|安诊儿/] },
  { id: "huawei", name: "华为", patterns: [/华为|Huawei|盘古/i] },
  { id: "epic", name: "Epic", patterns: [/\bEpic\b/i] },
  { id: "oracle-health", name: "Oracle Health / Cerner", patterns: [/Oracle\s*Health|\bCerner\b/i] },
  { id: "microsoft", name: "微软 / Nuance", patterns: [/微软|Microsoft|\bNuance\b|\bDAX\b|Dragon\s*Medical/i] },
  { id: "google-health", name: "谷歌健康", patterns: [/Google\s*Health|谷歌健康|\bAMIE\b|Med-?PaLM|\bMedGemini\b/i] },
  { id: "siemens-healthineers", name: "西门子医疗", patterns: [/西门子医疗|Siemens\s*Healthineers|AI-Rad\s*Companion/i] },
  { id: "ge-healthcare", name: "GE医疗", patterns: [/\bGE\s*医疗|GE\s*HealthCare|通用电气医疗/i] },
  { id: "philips", name: "飞利浦医疗", patterns: [/飞利浦|Philips/i] },
];

/**
 * 这些域名上的文章，发布方就是对应的公司（托管平台不算）。
 * 只列已核对过的官方域名；新加信源时确认了域名归属再补，填错会把别人的报道算成这家公司发布。
 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "nhc", domains: ["nhc.gov.cn"] },
  { entityId: "nhsa", domains: ["nhsa.gov.cn"] },
  { entityId: "nmpa", domains: ["nmpa.gov.cn"] },
  { entityId: "miit", domains: ["miit.gov.cn"] },
  { entityId: "caict", domains: ["caict.ac.cn"] },
  { entityId: "hl7", domains: ["hl7.org"] },
  { entityId: "epic", domains: ["epic.com"] },
  { entityId: "neusoft", domains: ["neusoft.com"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "tencent-health", pattern: /腾讯(?:研究院|AI\s*Lab)|Tencent\s*(?:Health|MI)/i },
  { entityId: "iflytek-medical", pattern: /讯飞(?:开放平台|研究院)|iFLYTEK\s*Medical/i },
  { entityId: "hl7", pattern: /Health\s*Level\s*Seven/i },
];
