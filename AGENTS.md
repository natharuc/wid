# WID contributors

This is a personal, generic local product. Do not classify it as corporate work based on a developer's other folders or clients.

- Keep domain, application, infrastructure and interfaces separate. Use SOLID and the smallest correct implementation. Domain logic must not depend on UI, MCP, HTTP or PostgreSQL.
- Work in the original checkout on a demand branch. Do not create clones or worktrees unless requested.
- Never turn elapsed chat time, tool runtime, inactivity or job wait into measured human hours. Estimates need evidence, confidence and explicit labeling. A missing record means unknown coverage.
- Effort is a cumulative total per task/local day/category. Revisions replace totals, not add to them. Keep idempotency transactional and history append-only. Preserve original event and recording timestamps.
- No raw transcript ingestion, telemetry, credentials in records, public network listeners or unrequested integration writes.
- Only modify managed WID entries/blocks in client configuration. Preserve other settings and refuse ownership conflicts. Test config edits with temporary homes, never the developer's actual files.
- Use concise factual UI copy. No promotional text or filler subtitles.
- Use React with DaisyUI components and the built-in corporate (light) and business (dark) themes. Layout uses Tailwind utilities. Do not write custom CSS rules, inline styles, handcrafted themes, or a second UI framework. `ui/framework.css` only loads/configures Tailwind and DaisyUI.
- Before publishing: `npm run typecheck`, `npm test`, `npm run build`, `npm audit`, and package/install smoke checks. Test affected UI interactions through an allowed browser. Never use Windows desktop automation.
- Keep tests, fixtures and temporary databases separate from live personal records. Clean disposable artifacts after verification.
- Report concrete validation gaps. Do not imply full monthly coverage or universal automatic agent capture.
