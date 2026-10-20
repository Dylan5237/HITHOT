# HITHOT：医疗信息化热点站的定制说明

这份仓库是从 AIHOT 开源框架改出来的**医疗信息化**行业热点站（暂定站名 HITHOT）。引擎代码没有改动，改的都在 `site/` 和 `industry/` 里。

## 改了什么

| 文件 | 改动 |
|---|---|
| `site/site.ts` | 站名 HITHOT、行业词“医疗信息化”（页面上显示为“医疗信息化日报”等）、首页标题、关键词、关于页文案、MCP 前缀 `hithot`、爬虫名 `HITHOTBot/1.0` |
| `site/brand/` | 新图标（医疗十字 + 心电线），日报/周报/月报报头按新行业词重新生成 |
| `industry/taxonomy.ts` | 7 个类别：政策、医疗AI、产品、实践、行业、研究、观点；分类标签、主题标签、机构与厂商名录、防张冠李戴词典；报头统计“N 份新政策” |
| `industry/topics.json` | 36 个主题：14 个机构与厂商，14 个建设方向（电子病历、互联互通、智慧医院、医保信息化、医疗大模型……），8 个内容类型 |
| `industry/sources.json` | 21 个示范信源（见下表），18 个启用。2026-10-19 在沙盒用项目自带的采集器实测；2026-10-20 又从部署服务器（阿里云乌兰察布机房 IP）逐个复测，FDA 与 MedCity 被反爬拦掉、雷峰网实测医疗信息化命中为 0，三个都改为默认停用 |
| `industry/prompts/` | 预筛、评分标准、内容理解、结构化、术语规则、标题规则、摘要与翻译，全部换成医疗信息化的口径 |
| `industry/wording.ts` | 禁止“重磅、炸裂、全面赋能”这类说法 |

## 评分标准的取舍

评分保留了原框架的结构：七种内容类型 × 五个维度加权、噪声压制、安全边界。改的是“什么算重要”：

- **加分**：国家层面的政策与征求意见稿；电子病历、互联互通、智慧服务等评级规则与名单；DRG/DIP 与医保信息平台的变化；AI 医疗器械获批；有规模和数据的建设实践；主要厂商的重大经营变化；安全事故；高质量的医疗 AI 研究。
- **压分**：厂商的“签约、赋能、打造标杆”通稿；单家医院的宣传稿和领导调研；会议、展会、培训、评奖；与信息化关系弱的部委文件；例行招标；只说“接入了大模型”的产品稿。
- 七种类型的权重见 `industry/prompts/selection-score.md`；类型列表同时写在 `industry/taxonomy.ts` 的 `ITEM_TYPES` 里，两处要一起改。

入选门槛（`industry/selection.ts`）**还没改**，仍是原框架按 AI 行业校准的 T1 60、T1_5 65、T2 76。上线前要用你自己标注的样本重新校准，见下文。

## 示范信源

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

**合规原则**（2026-10-19 免费信源测试时确定）：只抓公开网页和 RSS，遵守 robots.txt，低频抓取；遇到人机验证、WAF、频率限制一律不绕过；站内只展示标题、AI 摘要和原文链接，未获授权不开全文（`site_fulltext`、`syndicate_fulltext` 保持关闭）；网站明确禁止时立即停用。

公众号暂不接入：第三方接口（含极致了）和借用微信读书账号转 RSS 的方案都有合规或封号风险，优先与 HIT专家网、CHIMA 等机构谈授权。

试抓失败、没放进去的候选（服务器换到海外或国内机房后可以在后台再试一次）：

- 403（可能只拦了沙盒的 IP）：Healthcare IT News、Fierce Healthcare、MobiHealthNews、Becker's Health IT、ONC HealthITbuzz、HHS News、Digital Health
- 沙盒与部署机房的出口 IP 不同，可达性结论不能互相搬用：FDA 与 MedCity News 在沙盒能抓、从部署机房（阿里云乌兰察布）被反爬拦掉，已默认停用；反过来 HIT专家网在沙盒超时、从部署机房 0.82 秒就返回。上面这批 403 的候选换到部署机房也应复测一次再下结论
- 部委官网反爬（412）：国家卫健委、国家药监局官网列表页；国家医保局的列表数据在脚本里，网页列表抓不到
- 有人机验证或频率限制（不绕过）：健康界（阿里云 WAF）、中国政府采购网（“频繁访问”）、器审中心、亿欧
- robots.txt 禁止或条款受限：Google 新闻 RSS（robots 禁止 `/rss`）、Bing 新闻 RSS（条款限制较多）
- 已停更：人民网健康频道 RSS（停在 2025 年 6 月）
- 海外访问不通：国家卫健委统计信息中心（可在国内服务器再试）
- 期刊订阅格式问题：npj Digital Medicine（跳转要 cookie）、The Lancet Digital Health（条目没有日期）

## 需要你自己决定的事

1. **站名**：现在是 HITHOT，改 `site/site.ts` 的 `name` 和 `organization.name`。不能用 AIHOT 的名字和 Logo。
2. **信源**：上面这份是起点，要按你实际要盯的地区、厂商和公众号补齐。
3. **分类**：7 个类别的 key（`policy`、`med-ai`、`products`、`practice`、`industry`、`research`、`opinion`）会出现在网址和 RSS 地址里，上线后不能再改。
4. **门槛校准**：从信源里挑 100–200 条资料，自己标“该选 / 不该选”，存成 `.data/gold.jsonl`（格式见 `industry/gold.example.jsonl`），运行 `node --env-file=.env scripts/eval-selection.ts --gold .data/gold.jsonl`，按结果调评分提示词和 `industry/selection.ts`。
5. **条款与隐私说明**：`site/pages/terms.md`、`privacy.md` 仍是模板，上线前要改。
6. **备案**：放在中国大陆的话，在 `site/site.ts` 填 `icp`、`psb`。

## 跑起来

```bash
node scripts/init-env.ts --llm-key <你的模型 API Key>   # 默认按 DeepSeek 配置
docker compose up -d --build
```

打开 http://localhost:3000，后台在 `/admin`（密码在 `.env` 的 `ADMIN_PASSWORD`）。部署到服务器、配置域名与 HTTPS 见 `docs/deploy.md`。

## 验证记录

- 正文提取修复（2026-10-20）：gov.cn 政策页在 `<body>` 里夹了一个页头片段自带的 `</html>`，linkedom 把正文留在文档外，Readability 抛 TypeError，被抓取路径吞掉后误报成 `JINA_API_KEY is not configured`；修好后又发现页面同时有电脑版和手机版两份正文，读出来会翻倍。见 `packages/backend/src/lib/page-content.ts`、`content/extract.ts` 和 `tests/malformed-html-extraction.test.ts`。

- `npm run typecheck`：通过。
- `npm test`（928 项）：903 通过，其余 25 项与改动前的原版仓库一致，均为环境原因（沙盒缺 `pg_dump`/`tar` 备份链路、standalone 用例需先 `npm run build -w @aihot/web`）。构建后 standalone 用例 14/14 通过。
- `apps/web/tests` 中依赖 Playwright 浏览器（Chromium/WebKit）的用例需先 `npx playwright install`。
- 测试里的示例值已按 AGENTS.md 换成本行业的分类、实体与标签（如 `policy`、`oracle-health`、`政策发布`）。
