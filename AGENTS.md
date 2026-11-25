# WID contributors

This is a personal, generic local product. Do not classify it as corporate work based on a developer's other folders or clients.

- Keep domain, application, infrastructure and interfaces separate. Use SOLID and the smallest correct implementation. Domain logic must not depend on UI, MCP, HTTP or PostgreSQL.
- Work in the original checkout on a demand branch. Do not create clones or worktrees unless requested.
- Never turn elapsed chat time, tool runtime, inactivity or job wait into measured human hours. Estimates need evidence, confidence and explicit labeling. A missing record means unknown coverage.
- Effort is a cumulative total per task/local day/category. Revisions replace totals, not add to them. Keep idempotency transactional and history append-only. Preserve original event and recording timestamps.
- Task contexts are dynamic free-form names chosen by agents, separate from company/project. Never implement a fixed enum or required context registry. List existing names for reuse, allow arbitrary new ones, group/filter consistently, and audit reclassification. The task's current context groups all its history. Keep legacy receipts and omitted-context clients compatible.
- The dashboard header selects a persistent viewing context across navigation, task detail, counts, reports and exports. Preserve explicit overall scope and empty contexts; do not silently broaden a query. This UI preference never assigns context to an agent's new work.
- Retrospective facts use historical_note with an explicit original occurredAt. Never change task status or attach effort to this event. Preserve current task references; provenance references belong to the historical event. Lifecycle events keep their normal state checks and recording-order semantics.
- Agent adapters must follow their documented configuration formats, preserve unrelated JSONC/comments and refuse ownership conflicts. Current clients: Codex, Claude Code, Cursor, GitHub Copilot CLI/harness, Gemini CLI and OpenCode 2. Validate client writes in temporary homes.
- No raw transcript ingestion, telemetry, credentials in records, public network listeners or unrequested integration writes.
- Only modify managed WID entries/blocks in client configuration. Preserve other settings and refuse ownership conflicts. Test config edits with temporary homes, never the developer's actual files.
- Use concise factual UI copy. No promotional text or filler subtitles.
- Use React with DaisyUI components and the built-in corporate (light) and business (dark) themes. Layout uses Tailwind utilities. Do not write custom CSS rules, inline styles, handcrafted themes, or a second UI framework. `ui/framework.css` only loads/configures Tailwind and DaisyUI.
- The primary local checkout is `C:\nac\wid`. Brand masters are in `brand/`; use graphite on light backgrounds and white on dark backgrounds. Preserve the supplied shapes, proportions and clear space. React imports master SVGs directly; prepared web/app icons are served from `ui/public`.
- Before publishing: `npm run typecheck`, `npm test`, `npm run build`, `npm audit`, and package/install smoke checks. Test affected UI interactions through an allowed browser. Never use Windows desktop automation.
- Keep tests, fixtures and temporary databases separate from live personal records. Clean disposable artifacts after verification.
- Report concrete validation gaps. Do not imply full monthly coverage or universal automatic agent capture.
