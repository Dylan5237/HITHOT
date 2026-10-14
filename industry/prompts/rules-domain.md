
【医疗 AI 领域翻译规则 — 本平台 100% 是医疗信息化与医疗 AI 行业内容，严格遵守】

1. 歧义默认值：以下词在中文有非本行业歧义，**一律按医疗 AI 含义翻译**：
   - LLM = 大语言模型（绝不译"法学硕士"/"Master of Laws"）
   - Medical LLM / MLLM = 医疗大模型（绝不译"医学博士"）
   - Token / tokens = 模型 token（保留英文；绝不译"代币"/"令牌"）
   - Agent / Agentic = AI 智能体 / 智能体的（不译"代理人"/"中介"）
   - Inference = 推理（模型生成）
   - Reasoning = 推理（注意：与 inference 都译"推理"，必要时用"链式推理"区分 CoT）
   - Hallucination = 模型幻觉
   - Fine-tune / Fine-tuning = 微调
   - Pretrain / Pretraining = 预训练
   - Prompt = 提示词
   - RAG = 检索增强生成（也可保留英文）
   - EMR = 电子病历；EHR = 电子健康档案（按上下文，不译"电子病例"）
   - HIS = 医院信息系统；PACS = 影像归档与通信系统；LIS = 检验信息系统；RIS = 放射信息系统
   - CDSS = 临床决策支持系统
   - DRG = 疾病诊断相关分组；DIP = 按病种分值付费（可保留英文缩写）
   - Interoperability = 互联互通（医院信息互联互通标准化成熟度测评语境，不译"互用性"）
   - 三类证 = 第三类医疗器械注册证

2. 以下专有名词**一律保留英文原文**，不翻译不加中文括注：
   - 标准与术语体系：FHIR / HL7 / DICOM / ICD-10 / ICD-11 / SNOMED CT / LOINC / RadLex
     **规则**：标准名与编码体系名一律保留英文；标准号与文号（如 WS/T xxx、国卫办发〔2025〕x号）一字不改
   - 技术缩写（举例 + 通用规则）：LLM / NLP / RAG / RLHF / LoRA / MoE / CoT / SOTA / API / SDK / SaaS / GPU
     **规则**：任何 2-5 字母的全大写缩写，默认按 AI/ML 含义保留英文
   - 评测基准与数据集（举例 + 通用规则）：MedQA / USMLE / CMB / CBLUE / MedBench / MIMIC / CheXpert
     **规则**：以 -bench / -eval 结尾或全大写的评测名一律保留英文
   - 产品与平台名：Epic / Cerner Millennium / DAX Copilot / Dragon Medical / AI-Rad Companion / uAI / WiNEX / iMedical
     **规则**：产品名与版本号一字不改（包括字母数字后缀如 4o / V4 / 3.0），绝不"翻译性扩写"
   - 通用技术：API / SDK / CLI / SaaS / CDN / SSO / OAuth / JWT / WebSocket / gRPC

3. 中国机构与厂商**优先用官方中文名**（首次出现可双标"联影智能（uAI）"，后续选一种保持一致）：
   - 机构：国家卫生健康委（卫健委）/ 国家医疗保障局（医保局）/ 国家药品监督管理局（药监局）/ 国家卫生健康委统计信息中心 / 中国信息通信研究院（信通院）/ 医疗器械技术审评中心
   - 厂商：讯飞医疗（星火医疗大模型、讯飞晓医）/ 联影智能（uAI）/ 医渡科技（医渡云）/ 卫宁健康（WiNEX）/ 东软集团 / 创业慧康 / 东华医为（iMedical）/ 嘉和美康 / 腾讯健康（腾讯觅影）/ 京东健康（京医千询）/ 阿里健康 / 百度灵医智惠 / 华为（盘古）
   - 外企：微软（Nuance）/ 谷歌健康 / 西门子医疗 / GE医疗 / 飞利浦，中英文选一种保持一致

4. 代码 / 命令 / URL / 数字单位 **一字不改**保留：
   - 反引号代码 `code` 不翻译
   - 命令如 pip install、npm run 不译
   - URL 原样
   - 数字+单位：8k context / 175B params / 99.9% 原样
   - 注册证号（如 国械注准20243210xxx）、文件编号、分级评价等级（电子病历五级、互联互通四级甲等）、金额、样本量、敏感度、特异度、AUC、P 值必须保留原文的数字和单位；不要把精确数字改写成"数百家""大幅提升"等中文模糊说法
