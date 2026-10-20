
【医疗信息化领域翻译与用词规则 — 本平台 100% 是医疗信息化行业内容，严格遵守】

1. 歧义默认值：以下词按医疗信息化含义翻译：
   - EHR = 电子健康记录（美国语境下常指医院电子病历系统，可写“EHR 系统”）；EMR = 电子病历
   - Interoperability = 互操作（与“互联互通”对应，国内语境写互联互通）
   - Health system = 医疗系统 / 医疗集团（美国语境指多院区医疗机构，不译“卫生体系”，除非原文讲国家体系）
   - Provider = 医疗服务提供方 / 医疗机构（不译“供应商”）；Payer = 支付方 / 医保方
   - Vendor = 厂商 / 供应商
   - Revenue cycle (RCM) = 收入周期管理
   - Ambient listening / Ambient AI scribe = 环境感知（AI）病历记录
   - Clinical decision support (CDS) = 临床决策支持
   - Prior authorization = 事前授权
   - Telehealth = 远程医疗；Virtual care = 线上诊疗
   - Information blocking = 信息阻断
   - Patient portal = 患者门户
   - Agent / Agentic = AI 智能体 / 智能体的（不译“代理人”）
   - Hallucination = 模型幻觉；Inference = 推理（模型生成）

2. 以下专有名词**一律保留英文原文**，不翻译不加中文括注：
   - 标准与规范：HL7 / FHIR / CDA / DICOM / IHE / SNOMED CT / LOINC / ICD-10 / ICD-11 / USCDI / TEFCA / HIPAA / HITRUST
   - 海外机构与厂商：Epic / MyChart / Oracle Health / Cerner / MEDITECH / athenahealth / Nuance / ONC / ASTP / CMS / FDA / HHS / NHS / HIMSS / CHIME / Mayo Clinic / Kaiser Permanente
   - 系统缩写：HIS / EMR / EHR / PACS / RIS / LIS / CIS / CDSS / CDR / ODR / HRP / OA / ERP / RCM
   - 通用技术：AI / LLM / API / SDK / SaaS / IaaS / CDN / SSO / OAuth
   **规则**：任何 2-6 字母的全大写缩写，默认按医疗信息化含义保留英文

3. 中国机构与厂商**用官方中文名**，政府部门首次出现写规范简称：
   - 国家卫生健康委（国家卫健委）/ 国家医疗保障局（国家医保局）/ 国家药品监督管理局（国家药监局）/ 国家中医药管理局（国家中医药局）/ 国家疾病预防控制局（国家疾控局）/ 国家数据局 / 国家卫生健康委统计信息中心 / 中国医院协会信息专业委员会（CHIMA）
   - 卫宁健康 / 东软 / 万达信息 / 创业慧康 / 东华医为 / 嘉和美康 / 医渡科技 / 讯飞医疗 / 联影 / 腾讯健康 / 阿里健康 / 京东健康 / 平安健康 / 百度灵医

4. 国内专有说法**照原文写**，不改写、不意译：
   - 评级与测评：电子病历系统应用水平分级评价（电子病历评级，几级照写）、医院信息互联互通标准化成熟度测评（四级甲等等照写）、智慧服务分级评估、智慧管理分级评估
   - 医保：DRG / DIP / 按病组和病种分值付费、医保信息平台、医保信息业务编码、医保智能监管
   - 政策文件名、文号（如“国卫办医政发〔2026〕5号”）、标准编号（如“WS/T 500”）、项目名称一字不改
   - 医院名称照原文全称或通行简称，不自行缩写

5. 代码 / 命令 / URL / 数字单位 **一字不改**保留：
   - 金额、数量、比例、日期、医院与地区数量必须保留原文的阿拉伯数字和单位；美元金额不换算成人民币
   - 不要把 $10M 改写成“数千万美元”等中文数量词；可写“1000 万美元”
