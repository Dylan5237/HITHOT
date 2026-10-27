# HITHOT：医疗信息化热点站的定制说明

这份仓库是医疗信息化行业热点站 HITHOT。站点配置在 `site/` 和 `industry/`，专用采集在 `modules/medical-sources/`；v3 另有评分字段、公共读取和采集 HTTP 层的配套改造，详见 [内容分类与评分](hithot-content.md)。

2026-10-26 的 v3 信源状态以 `industry/sources.json` 和 `industry/medical-sources.ts` 为准：HIStalk、HIT Consultant、Healthcare IT Today、Healthcare Dive、STAT Health Tech、JMIR Medical Informatics、HL7 Europe 已停用，保留历史数据。下文的旧试抓记录只说明当时可达性，不表示这些源仍启用。新增源的实际回填和未完成项见本次验收包；公开接口可访问不等于接入已经通过验收。

2026-10-27 新增江门市中心医院本院动态、四川大学新闻网、惠每科技客户案例和西安交大二附院中标公告。前三个用网页列表采集，首次导入各最多 8 条；惠每案例的原文标题是医院名称，具体项目以正文为准。西安中标公告由 `medical-sources` 模块读取最近 14 天的结果，只保留符合既有医院软件、金额或重点厂商规则的中标/成交项目，保存机构、金额和产品线等事实，不保存联系人及电话。四个源初始每 6 小时检查，网页列表的间隔仍会由现有自适应机制调整；内容仍通过现有精选规则。源码配置只在首次种子导入时生效，已部署站点以后台信源设置为准。

## 改了什么

| 文件 | 改动 |
|---|---|
| `site/site.ts` | 站名 HITHOT、行业词“医疗信息化”（页面上显示为“医疗信息化日报”等）、首页标题、关键词、关于页文案、MCP 前缀 `hithot`、爬虫名 `HITHOTBot/1.0` |
| `site/brand/` | 新图标（医疗十字 + 心电线），日报/周报/月报报头按新行业词重新生成 |
| `industry/taxonomy.ts` | 7 个类别：政策、医疗AI、产品、实践、行业、研究、观点；分类标签、主题标签、机构与厂商名录、防张冠李戴词典；报头统计“N 份新政策” |
| `industry/topics.json` | 机构与厂商、建设方向和内容类型主题；当前名单以配置文件为准 |
| `industry/sources.json` | 信源初始化配置；新部署的默认值以该文件为准，已部署站点的启停状态以后台设置为准。历史试抓结果见下表 |
| `industry/prompts/` | 预筛、评分标准、内容理解、结构化、术语规则、标题规则、摘要与翻译，全部换成医疗信息化的口径 |
| `industry/wording.ts` | 禁止“重磅、炸裂、全面赋能”这类说法 |

## 评分标准的取舍

v3 评分结合内容类型和行业影响、行动紧迫性、需求规模、证据充分性、软件相关性五个维度判断，按分档给出总分；具体标准以 `industry/prompts/selection-score.md` 为准。

- **重点关注**：直接产生系统建设或改造需求的政策和标准；重点厂商重大经营事件；较大规模的医疗信息化项目中标；有具体功能、架构或成效的医院建设实践。
- **压制噪声**：缺少实质信息的活动和宣传稿、与软件相关性弱的内容、纯硬件或运维采购、学术论文等；同一事件优先保留信息更完整的报道。

当前 T1、T1_5 和 T2 的入选门槛均为 59，代码以 `industry/selection.ts` 为准。2026-10-26 的自动化校准依据、样本覆盖局限和人工验收状态见 [内容分类与评分](hithot-content.md)。

## 2026-10-19 至 2026-10-23 的信源试抓记录

下表保留当时的试抓结果，不是当前启用清单；当前配置与已部署站点的状态分别以 `industry/sources.json` 和后台为准。

| 信源 | 类型 | 分级 | 说明 |
|---|---|---|---|
| 国家卫健委、国家医保局、国家药监局、国家中医药局、国家疾控局 | json_list | T1 | 中国政府网“部门文件”库按发文部门筛选的接口。部委官网有反爬，抓不到，这个接口能稳定拿到正式文件，但比官网晚几天 |
| 国家数据局 通知公告 | web_list | T1 | 官网列表页，数据要素相关的通知由预筛再筛一遍 |
| HL7 International：The Standard | rss | T1_5 | FHIR 等标准组织的官方博客 |
| Google Health 博客 | rss | T1 | 厂商官方 |
| FDA Press Releases | rss | T1 | **默认停用**（`enabled: false`）。沙盒可抓；从国内机房请求被 302 跳到 `fda.gov/apology_objects/abuse-detection-apology.html`，是 FDA 的反爬，按合规原则不绕过 |
| JMIR Medical Informatics | rss | T1 | 医学信息学期刊。**文章页从国内机房返回 202 + 空正文**，只有订阅摘要可用，按摘要判定 |
| HIStalk、Healthcare Dive、STAT Health Tech、Healthcare IT Today、HIT Consultant | rss | T2 | 海外医疗 IT 媒体，国内机房实测订阅均可直连。**HIStalk 的文章页返回 307 且不带 `location`**（订阅本身正常），同样按订阅摘要判定；这两处都是站点对机房 IP 的反爬，按合规原则不绕过 |
| MedCity News Health Tech | rss | T2 | **默认停用**（`enabled: false`）。沙盒可抓；从国内机房返回 403 + Cloudflare「Just a moment...」人机验证，不绕过 |
| 雷峰网 | rss | T2 | **默认停用**（`enabled: false`）。科技综合媒体，实测医疗信息化命中为 0，开着只消耗预筛额度 |
| CHIMA 政策法规 | web_list | T2 | 中国医院协会信息专业委员会转载的政策文件，4 小时一次 |
| CHIMA 案例分享 | web_list | T2 | 医院信息化建设案例，6 小时一次 |
| 动脉网 | web_list | T2 | 医疗健康产业媒体首页；列表页多数条目没日期，靠详情页 `span.spa2` 补齐 |
| HIT专家网 | rss | T2 | 2026-10-20 从国内机房实测 200、10 条、0.82 秒，已启用（沙盒里超时是沙盒出口的问题，不是信源的问题） |
| 医渡科技 公司新闻 | web_list | T1_5 | 厂商官网新闻列表，6 小时一次（2026-10-22 第二轮免费信源测试加入，下同） |
| 讯飞医疗 企业动态 | web_list | T1_5 | 厂商官网；列表只有月日，日期从详情页 `.z_hxxq_page .time` 读。这个站对带 JSON 的 Accept 头返回“JSON 字符串包着的 HTML”，`web-list.ts` 的 `unwrapJsonHtml` 负责还原 |
| 北京市卫健委 政策文件、政策解读 | web_list | T1_5 | 地方卫健委；政策文件列表标题被截断，靠详情页 `meta[name=ArticleTitle]` 补全 |
| 广东省卫健委 工作动态 | web_list | T1_5 | 地方卫健委，内容偏综合，由预筛留下数字健康相关条目 |
| 上海市卫健委 通知公告 | web_list | T1_5 | 地方卫健委；通知公告列表自带日期，2026-10-23 预览 19 条全有日期，首轮导入 8 条 |

上面三个靠详情页补齐的源（动脉网、讯飞医疗、北京市卫健委政策文件）都必须在 `detail` 里写 `maxFetches`：它是每轮读取详情页的页数上限，不设即 0，一页都不读，列表缺的日期和标题就永远补不上（`fetch_runs.detail` 会记成 `detailAttempts: 0`、`detailPending` 等于条目数）。本站取 12，够一次首轮导入把 `initialBackfillLimit: 8` 的条目全读完；平时每轮只有新条目要读，用不满。2026-10-22 就是因为补丁漏了这一项，讯飞 8 条全无日期、北京 5 条标题带省略号，动脉网 22 条里只有 3 条有日期。

**合规原则**（2026-10-19 免费信源测试时确定）：只抓公开网页和 RSS，遵守 robots.txt，低频抓取；遇到人机验证、WAF、频率限制一律不绕过；站内只展示标题、AI 摘要和原文链接，未获授权不开全文（`site_fulltext`、`syndicate_fulltext` 保持关闭）；网站明确禁止时立即停用。

公众号暂不接入：第三方接口（含极致了）和借用微信读书账号转 RSS 的方案都有合规或封号风险，优先与 HIT专家网、CHIMA 等机构谈授权。

试抓失败、没放进去的候选（服务器换到海外或国内机房后可以在后台再试一次）：

- 403（可能只拦了沙盒的 IP）：Healthcare IT News、Fierce Healthcare、MobiHealthNews、Becker's Health IT、ONC HealthITbuzz、HHS News、Digital Health
- 沙盒与部署机房的出口 IP 不同，可达性结论不能互相搬用：FDA 与 MedCity News 在沙盒能抓、从部署机房（阿里云乌兰察布）被反爬拦掉，已默认停用；反过来 HIT专家网在沙盒超时、从部署机房 0.82 秒就返回。上面这批 403 的候选换到部署机房也应复测一次再下结论
- 部委官网反爬（412）：国家卫健委、国家药监局官网列表页；国家医保局的列表数据在脚本里，网页列表抓不到
- 有人机验证或频率限制（不绕过）：健康界（阿里云 WAF）、中国政府采购网（“频繁访问”）、器审中心、亿欧
- robots.txt 禁止或条款受限：Google 新闻 RSS（robots 禁止 `/rss`）、Bing 新闻 RSS（条款限制较多）
- 已停更：人民网健康频道 RSS（停在 2025 年 6 月）
- 已接入：上海市卫健委 通知公告（2026-10-23 预览 19 条、全有日期）
- 国内机房可达但列表不可直接用 web_list：卫宁健康首页为 JS 渲染、没有公开列表；浙江省卫健委通知公告列表由 JS 异步加载，web_list 读不到，暂不接入
- 需登录和人机验证，不接入：国家卫健委统计信息中心（chiss.org.cn）
- 第二轮（2026-10-22）没放进去的：东软（集团新闻混着汽车、教育，噪声大）；嘉和美康（新闻停在 2020 年）；联影智能（新闻链到外部媒体）；创业慧康（前端渲染，页面无内容）；万达信息（420 反爬，不绕过）；东华医为（域名解析失败）；健康报（列表数据嵌在页面脚本里，内容以大众健康为主）
- 期刊订阅格式问题：npj Digital Medicine（跳转要 cookie）、The Lancet Digital Health（条目没有日期）

## 需要你自己决定的事

1. **站名**：现在是 HITHOT，改 `site/site.ts` 的 `name` 和 `organization.name`。不能用 AIHOT 的名字和 Logo。
2. **信源**：以 `industry/sources.json` 和后台实际设置为准，再决定要追踪的地区、厂商和其他来源。
3. **分类**：7 个类别的 key（`policy`、`med-ai`、`products`、`practice`、`industry`、`research`、`opinion`）会出现在网址和 RSS 地址里，上线后不能再改。
4. **门槛复核**：现有 59 分门槛及其自动化校准局限见 [内容分类与评分](hithot-content.md)；新增样本或人工标注后，可按 [精选与校准](selection.md) 重新评估。
5. **条款与隐私说明**：核对 `site/pages/terms.md`、`privacy.md` 与实际运营、数据处理方式是否一致；修改内容需由站长确认。
6. **备案**：放在中国大陆的话，在 `site/site.ts` 填 `icp`、`psb`。

## 跑起来

```bash
node scripts/init-env.ts --llm-key <你的模型 API Key>   # 默认按 DeepSeek 配置
docker compose up -d --build
```

打开 http://localhost:3000，后台在 `/admin`（密码在 `.env` 的 `ADMIN_PASSWORD`）。部署到服务器、配置域名与 HTTPS 见 `docs/deploy.md`。

## 历史验证记录

- 正文提取修复（2026-10-20）：gov.cn 政策页在 `<body>` 里夹了一个页头片段自带的 `</html>`，linkedom 把正文留在文档外，Readability 抛 TypeError，被抓取路径吞掉后误报成 `JINA_API_KEY is not configured`；修好后又发现页面同时有电脑版和手机版两份正文，读出来会翻倍。见 `packages/backend/src/lib/page-content.ts`、`content/extract.ts` 和 `tests/malformed-html-extraction.test.ts`。

- `npm run typecheck`：通过。
- `npm test`（928 项）：903 通过，其余 25 项与改动前的原版仓库一致，均为环境原因（沙盒缺 `pg_dump`/`tar` 备份链路、standalone 用例需先 `npm run build -w @aihot/web`）。构建后 standalone 用例 14/14 通过。
- `apps/web/tests` 中依赖 Playwright 浏览器（Chromium/WebKit）的用例需先 `npx playwright install`。
- 测试里的示例值已按 AGENTS.md 换成本行业的分类、实体与标签（如 `policy`、`oracle-health`、`政策发布`）。
