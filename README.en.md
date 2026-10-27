# HITHOT

HITHOT is a healthcare IT news site. It collects public sources, selects and organizes relevant items, and publishes them through the website, daily, weekly and monthly reports, and machine-readable interfaces.

[简体中文](README.md) · [Healthcare IT customization](docs/medical-it.md) · [Content classification and scoring](docs/hithot-content.md)

## How it works

- Source definitions are maintained in `industry/sources.json`; healthcare-specific collectors are in `modules/medical-sources/`.
- Items go through pre-screening, two independent scores, writing and event grouping. The scoring rubric and thresholds are in `industry/prompts/selection-score.md` and `industry/selection.ts`.
- Report times are configured in `site/site.ts`. Actual publication also depends on collection, processing and scheduled jobs.
- The public website, RSS, API, Agent Markdown and MCP expose the published content. Sources show summaries and links by default.

Source definitions seed new installations; an existing deployment uses its administrative source settings. Manually supplemented daily items are retained when the report is regenerated and appear in the daily RSS feed.

## Project structure

| Directory | Contents |
|---|---|
| `site/` | Site identity, branding, pages, models and report times |
| `industry/` | Categories, topics, sources, prompts and thresholds |
| `modules/medical-sources/` | Healthcare-specific source adapters |
| `apps/`, `packages/` | Web app, API, worker and shared backend |
| `database/migrations/` | Database migrations |

## Running and maintenance

The project uses Node.js 24, PostgreSQL, TypeScript and npm workspaces. See the [deployment guide](docs/deploy.md) for local setup, Docker, backups and updates, and the [architecture guide](docs/architecture.md) for system boundaries.

GitHub `main` stores the source; the existing deployment uses a separate deployment remote. Updating GitHub does not itself establish that the service has been deployed. Do not commit `.env`, secrets or `.data/` contents.

## Attribution and license

This project is adapted from the [AIHOT open-source framework](https://github.com/KKKKhazix/AIHOT). Code is available under the [MIT License](LICENSE). See [NOTICE](NOTICE) for the upstream name and logo restrictions and third-party font licenses.
