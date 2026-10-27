# HITHOT

HITHOT 是面向医疗信息化行业的热点站，采集公开信源，筛选并整理动态，再通过网站、日报、周报、月报和机器可读接口提供内容。

[English](README.en.md) · [医疗信息化定制说明](docs/medical-it.md) · [内容分类与评分](docs/hithot-content.md)

## 工作方式

- 采集医院、政府、企业及其他公开来源；来源配置在 `industry/sources.json`，医疗行业专用适配在 `modules/medical-sources/`。
- 内容经过预筛、两次独立评分、写作和事件归组；评分提示词和入选门槛分别在 `industry/prompts/selection-score.md`、`industry/selection.ts`。
- 日报、周报和月报按 `site/site.ts` 配置的时间生成；实际出刊还取决于采集、内容处理和任务运行状态。
- 公开内容通过网站、RSS、公开 API、Agent Markdown 和 MCP 提供；来源默认只展示摘要和原文链接。

源码中的信源配置用于初始化：已部署站点的启停与调度以后台设置为准。人工补录在日报重生成时保留，并可通过日报 RSS 查阅，详见 [内容分类与评分](docs/hithot-content.md)。

## 主要目录

| 目录 | 内容 |
|---|---|
| `site/` | 站名、品牌、页面、模型配置和出刊时间 |
| `industry/` | 行业分类、主题、信源、提示词和评分门槛 |
| `modules/medical-sources/` | 医疗信息化信源的专用采集适配 |
| `apps/`、`packages/` | 网站、API、任务执行器和共享后端 |
| `database/migrations/` | 数据库迁移 |

## 运行与维护

项目使用 Node.js 24、PostgreSQL、TypeScript 和 npm workspaces。本机运行、Docker、备份和更新步骤见 [部署说明](docs/deploy.md)；架构约束见 [架构](docs/architecture.md)，信源配置见 [信源](docs/sources.md)，评分校准见 [精选与校准](docs/selection.md)。

GitHub 的 `main` 保存项目代码；现有部署另有部署远程仓库。代码同步到 GitHub 不代表服务已更新，发布和验证以实际部署流程为准。不要提交 `.env`、密钥或 `.data/` 中的数据和证据。

## 来源与许可

本项目基于 [AIHOT 开源框架](https://github.com/KKKKhazix/AIHOT) 定制。代码采用 [MIT 许可证](LICENSE)，上游项目名称和标志的许可边界及第三方字体许可见 [NOTICE](NOTICE)。
