<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/01-logo/svg/wid-logo-branco.svg">
  <img src="brand/01-logo/svg/wid-logo-grafite.svg" alt="WID" width="280">
</picture>

**What I did?** A local journal of tasks and human work time, with a web dashboard and MCP for agents.

WID answers **what I did each day, how much time I spent on each task, and how many hours I have recorded this month**. Intentions, progress, decisions, blockers, and deliveries persist with their sources. Estimates remain explicitly labeled as estimates.

## Run locally

Node.js **22.13+** is required. Docker and a separate database server are unnecessary: the default is embedded PostgreSQL through [PGlite](https://pglite.dev/), persisted on disk.

Install the compiled release package:

```sh
npm install -g https://github.com/natharuc/wid/releases/latest/download/wid.tgz
wid setup
wid start --background
```

Open **http://127.0.0.1:4318**. Enable agents on the **Agents** page or through the CLI:

```sh
wid agent codex
# Optional, if you use these agents:
wid agent claude
wid agent cursor
```

Open a **new agent session** to load MCP and its instructions. `npm install` does not modify global configuration; `wid setup` only detects clients. Activation is explicit and reversible.

The npm name `wid` already belongs to another project. This package is named **`@natharuc/wid`**, with the **`wid`** executable. Version 0.6.2 is distributed through GitHub; it is not published to the npm registry.

### Update the installation

An installation from a tarball does not automatically track later releases with `npm update`. To install the latest published version:

```sh
wid stop
npm install -g --prefer-online https://github.com/natharuc/wid/releases/latest/download/wid.tgz
wid start --background
wid --version
```

Tasks, settings, and history live in the data directory, separate from the package. Updating at the same installation path preserves agent configuration. To pin release 0.6.2, use `https://github.com/natharuc/wid/releases/download/v0.6.2/wid.tgz`.

You can also install from source, with an automatic local build:

```sh
npm install -g github:natharuc/wid
```

## MVP

- A quick summary of outcomes, progress, and blockers, with attribution and expandable evidence. Plans and neutral legacy notes appear separately.
- Agents record the work; the tracking dashboard has no task creation or update forms.
- Structured evidence and observed episodes, without turning messages or conversation windows into human minutes.
- Tasks with optional company, project, and references to chats, issues, tasks, and PRs.
- Dynamic contexts chosen by the agent: free-form names, filtered groups and reports, and audited reclassification.
- Persistent history: intention, start, progress, decision, blocker, completion, and cancellation.
- Time per **task/day**, estimated by the agent with evidence and confidence or reported by the user.
- A daily view, timeline, and monthly calendar with explicit coverage.
- A React interface with DaisyUI components, the corporate (light) / business (dark) themes, and Tailwind layout utilities; no custom CSS. The sun/moon toggle in the header saves the choice in the browser. The first visit follows the system theme, which is applied before the interface renders.
- Local MCP over **stdio** and **Streamable HTTP**, using the official SDK.
- Detection and activation/deactivation for Codex, Claude Code, Cursor, GitHub Copilot, Gemini CLI, and OpenCode 2.
- Managed global instructions for Codex and Claude Code; MCP instructions for every client.
- An optional Claude Code `SessionStart` hook as a recording reminder.
- JSON export with sources, original timestamps, and correction history.
- External system URLs belong to tasks and evidence events. This version has no global tool configuration, synchronization, or external credentials.

## Work summaries and evidence

The dashboard opens with the daily summary. Each task shows up to three recent facts, with outcome, attribution, and sources. The first five tasks appear immediately; the rest can be expanded. Full history, agent execution, and waiting time are secondary. Task details begin with the latest factual summary.

The agent writes the summary through `work` in `wid_record_event`. For a neutral fact that does not change the task's current state, use `kind: "work_recorded"`. It also works on completed or cancelled tasks and when only the original day is known. Actual lifecycle events can include the same block. On creation, `work` is optional and its outcome must be `planned`.

Contract example with a task ID placeholder and illustrative content:

```json
{
  "taskId": "existing task UUID",
  "kind": "work_recorded",
  "note": "Review reported by the user; duration unknown.",
  "work": {
    "day": "2026-11-25",
    "summary": "Reviewed the receipt rules and identified the required adjustment.",
    "outcome": "advanced",
    "actor": "human",
    "evidence": [
      {
        "id": "conversation-123:review-receipts:observation-1",
        "kind": "user_report",
        "summary": "The user reported the review and identified the rule to correct."
      }
    ],
    "episode": { "id": "conversation-123:review-receipts", "phase": "review" }
  },
  "idempotencyKey": "conversation-123:review-receipts:v1"
}
```

`work` fields:

- `day`: the factual local day, rather than the recording date; no invented time is required. If the event's `occurredAt` is explicitly supplied, it must match this day in the configured time zone.
- `summary`: a factual statement of up to 280 characters, supported by evidence. It does not replace the detailed note.
- `outcome`: `planned`, `advanced`, `delivered`, `blocked`, or `cancelled`. The `completed`, `blocked`, and `cancelled` events require a matching outcome.
- `actor`: `human`, `agent`, `joint`, or `unknown`. Human or joint attribution requires `human_message` or `user_report` evidence; a command result alone does not prove human participation.
- `evidence`: 1 to 20 observations with a stable `id`, a `kind` (`human_message`, `agent_message`, `tool_result`, `user_report`), and a short `summary`. These are structured reports from the agent, not independent certification. Supply `sourceId` only when the original identifier is known. An observation may include `occurredAt` with an offset, only `day`, or neither when its original time is unknown; never both.
- `episode`: a stable identifier and a `phase` (`definition`, `review`, `decision`, `validation`, `execution`, `other`). The optional `window: {startedAt, endedAt}` describes observed conversation times only. **It is not measured human duration and does not generate hours.**

The same `episode.id` on the same task/day revises that episode's entire summary: send a complete snapshot rather than a fragment. Independent facts use different episodes. Without an episode, equivalent statements are consolidated in the summary; all events remain in the audit history. An `evidence.id` already used on a task cannot receive different content, including across agents: record a new observation and preserve the original. `work_recorded` does not change the task's current state or references; links supplied on this event belong to the fact.

To correct a structured fact, use `kind: "corrected"`, `correctsEventId`, and a replacement `work` block with the correct day and evidence. A note without `work` does not silently replace the structure or day. Effort-only corrections preserve the fact. Administrative audit corrections do not become accomplishments. Older records without `work` remain accessible with text faithful to the original event, labeled as legacy with unknown attribution; no evidence is invented for them. Neutral legacy historical notes are not classified as progress merely because the task is currently completed.

`wid_report_day` and `GET /api/day/:day` add `digest`; `GET /api/tasks/:id` includes summaries by day. Queries remain filtered by context. Administrative events and estimates do not become accomplishments in the summary. Existing time estimation remains separate: no `work` block accepts `effort`, and `wid_estimate_day` does not gain an automatic estimator in this version. The connected agent provides the summary, without requiring another AI provider or key in the local service.

## How hours are calculated

Each time record is a **cumulative total for that task, day, and category**. Updating an estimate from 40 to 60 minutes results in **60**, not 100. A new revision has a different idempotency key; resending the same command uses the same key and does not duplicate the record.

Categories:

| Category | Meaning |
| --- | --- |
| `human_estimated` | Estimated human total for the task/day; requires a basis and confidence. |
| `human_measured` | Measured human total or a total explicitly reported by the user for the task/day. |
| `agent_run` | Total agent execution time; excluded from human hours. |
| `wait` | Total waiting or job time; excluded from human hours. |

For each task/day, the human total is the **greater of measured and estimated time**. The estimated portion of the report is the positive difference between the total estimate and the measurement. Example: a 90-minute estimate with 30 measured minutes yields 90 human minutes: 30 measured + 60 estimated. If only an additional portion is estimated, submit the entire total as the estimate, including what was already measured.

The agent should read the daily report before revising an estimate, account for other sessions, and provide the estimation basis and confidence. Elapsed time between messages, inactivity, delegated execution, and waiting do not equal human work. When the conversation provides insufficient evidence, time remains unknown.

The month sums daily totals by task. **This is recorded time with partial coverage**, not a declaration of a complete working schedule. Days without evidence do not mean no work occurred. WID warns about days above 24 hours; overlaps between tasks still need review below that limit. The MVP has no timer or presence detector.

```sh
wid report 2026-11
```

## Dynamic contexts

The header selector sets the work context for all navigation. Tasks, counts, history, daily/monthly hours, detail pages, and exports follow the selection. The choice is stored in the URL and remembered by the browser; internal links preserve scope, including in another tab. `All contexts` is an explicit option. A context without tasks stays empty, without silently broadening the query. Changing context on a task page opens the new group's task list. The detail API also checks the context and does not return data from another group.

Time zone and agent activation remain global. GitHub, Azure DevOps, Slack, and other tools are references on individual tasks; there is no global tool configuration. The dashboard context filters the view; each agent still chooses and sends its task's context through MCP.

The agent decides each task's context, separately from company and project. **There is no fixed catalog or mandatory registry.** `MAG`, `POLLARIS`, `SEDUCAO`, and `OUTROS` are examples; `Research / Client A` or any other name is also valid.

Before creating a task, the agent consults `wid_list_contexts` to reuse a name when appropriate and explicitly sends `context` in `wid_create_task`. A new name creates the group through that record. The dashboard builds its group list dynamically, groups tasks, and filters activity and daily/monthly hours. Comparison ignores case, accents, and repeated spaces; the readable name is preserved.

```json
{
  "title": "Review the authentication flow",
  "context": "Research / Client A",
  "project": "Portal",
  "idempotencyKey": "session-123:auth-intention"
}
```

Legacy tasks without a context appear under `OUTROS`. The agent can classify them or correct a group without duplicating the task:

```json
{
  "taskId": "existing task UUID",
  "kind": "context_changed",
  "context": "Research / Client A",
  "note": "Classification established for this work.",
  "idempotencyKey": "session-123:classify-auth"
}
```

This change is recorded in the history with the previous and new contexts. **The task's entire history and time are grouped under its current context.** For a group's queries, send `context` to `wid_list_tasks`, `wid_report_day`, and `wid_report_month`; omit it for the overall view. MCP and global instructions make this choice explicit. The API still accepts older clients without the field, using `OUTROS`; this is compatibility behavior, not a catalog restriction.

## MCP

### Follow a task

A task title opens `/task/{id}`: intention, state, full history, hours by day, and references to the original systems. The URL supports direct navigation and reloads. The dashboard is for tracking; the agent records work through MCP.

The `references` field is available on creation. Use real links when known:

```json
{
  "title": "Review receipts",
  "context": "Client A",
  "note": "Validate the requested behavior and record the results.",
  "references": [
    { "label": "Receipts issue", "url": "https://github.com/organizacao/projeto/issues/123" }
  ],
  "idempotencyKey": "session-123:receipts"
}
```

To add links later, `wid_record_event` accepts `kind: "references_added"`, `taskId`, `references: [{label, url}]`, `note`, and `idempotencyKey`. The change is audited and does not duplicate the task. Repeated URLs are consolidated, and a task accepts up to 20 references. The dashboard recognizes Azure DevOps, GitHub, and Slack links; other destinations use the reference label. WID does not query these services or send messages when opening their links.

| Tool | Use |
| --- | --- |
| `wid_list_tasks` | Find/reuse tasks and inspect their history. |
| `wid_list_contexts` | List dynamic context names and task counts to reuse a name or choose another. |
| `wid_create_task` | Record the intention to work. |
| `wid_record_event` | Record progress, decisions, blockers, delivery, time, corrections, `context_changed`, `references_added`, or `historical_note`. |
| `wid_estimate_day` | Revise a task/day's estimated human total, with a basis and confidence. |
| `wid_report_day` | Query hours by task and daily coverage. |
| `wid_report_month` | Query the monthly total, measured/estimated portions, and gaps. |

`wid_estimate_day` example:

```json
{
  "taskId": "UUID returned by wid_create_task",
  "day": "2026-11-25",
  "minutes": 45,
  "basis": "Active discussion and review of the flow. Build time excluded; no precise measurement of the start.",
  "confidence": "low",
  "idempotencyKey": "session-123:task-456:2026-11-25:estimate-v1",
  "sessionId": "session-123"
}
```

The stdio transport starts the local server in the background when needed; only that server opens the embedded database. Other clients can use `http://127.0.0.1:4318/mcp/{agent}` with the corresponding agent enabled: `codex`, `claude`, `cursor`, `copilot`, `gemini`, or `opencode`. The service does not listen on the external network.

MCP provides usage instructions, but **the agent must follow them**. The initial version does not intercept every conversation or guarantee recording by every client. The Claude hook is a reminder rather than a transcript collector or time meter. Cloud clients cannot reach this localhost.

## Historical notes

To add an older fact to an existing task without changing its current state, use `wid_record_event` with `kind: "historical_note"`. It works on planned, active, blocked, completed, and cancelled tasks. `occurredAt` is required with the original timestamp and an explicit offset; `recordedAt` remains the actual recording time. The note appears in history and daily/monthly coverage on its original date, even when records arrive out of order.

```json
{
  "taskId": "existing task UUID",
  "kind": "historical_note",
  "note": "Validation performed during the period, according to the recorded reference. Human duration unknown.",
  "occurredAt": "2026-11-03T10:00:00-03:00",
  "references": [{"label": "Record source", "url": "https://example.com/evidence"}],
  "idempotencyKey": "history:task-id:2026-11-03:validation"
}
```

Do not send `effort`, `context`, or `correctsEventId` on this note. It uses the task's context; historical references belong to the event and do not replace the task's current links. Time, when supported by evidence, uses separate effort records. Without duration evidence, time remains unknown. Repeating an idempotency key with identical content returns the same event; different content under the same key is rejected. Ordinary lifecycle events continue to use recording order and do not replay state through `occurredAt`.

## Agent configuration

WID modifies only its own entry and marked blocks. A `wid` entry from another installation produces a conflict instead of being overwritten.

| Agent | MCP | Instructions |
| --- | --- | --- |
| Codex | `$CODEX_HOME/config.toml` or `~/.codex/config.toml` | Marked block in the global `AGENTS.md`. |
| Claude Code | `~/.claude.json` | Marked block in `~/.claude/CLAUDE.md`. |
| Cursor | `~/.cursor/mcp.json` | Instructions provided by MCP itself. |
| GitHub Copilot | `$COPILOT_HOME/mcp-config.json` or `~/.copilot/mcp-config.json` | MCP instructions. Copilot CLI and the VS Code Copilot harness; does not configure the editor profile's older MCP format. |
| Gemini CLI | `~/.gemini/settings.json` | MCP instructions. |
| OpenCode 2 | `~/.config/opencode/opencode.json` or an existing `.jsonc` file | MCP instructions; entry in `mcp.servers`. The legacy format is not migrated. |

JSON adapters preserve JSONC comments and other server settings. Client configuration is validated using temporary directories, and the MCP protocol is tested locally; execution within each application depends on its installation, permissions, and policies. Detection uses directories/settings, executables, and the VS Code Copilot extension, without scanning conversations. New agents are never enabled automatically.

Formats were checked against the [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers), [VS Code](https://code.visualstudio.com/docs/agents/reference/mcp-configuration), [Gemini CLI](https://geminicli.com/docs/tools/mcp-server/), and [OpenCode](https://opencode.ai/docs/mcp-servers/) documentation. SVG logos identify clients; their source and license are in `ui/public/agents/`.

```sh
wid agent codex --disable
wid agent copilot
wid agent gemini
wid agent opencode
wid hook-install claude
wid hook-install claude --disable
```

Disabling Claude also removes this installation's hook. The hook never records raw prompts. Commands use the absolute paths to Node and the installation; if you move or reinstall at another path, disable the old installation and enable the new one.

## Data and privacy

The default directory is `%LOCALAPPDATA%/wid` on Windows and `~/.local/share/wid` on other platforms. It contains `settings.json`, the `postgres/` database, and a lock for the active process. Change it with `WID_DATA_DIR` or `--data-dir` (use the same directory for commands and agents).

- No telemetry, conversation import, screenshots, or automatic uploads.
- Record work summaries, never complete prompts, credentials, or sensitive data.
- The database and configuration files are local; protect access to your account and disk. There is no application-level encryption or authentication between processes on the same user/machine.
- HTTP restricts host and origin to localhost and requires a dedicated header for API mutations. External sites receive no CORS access.
- Corrections append events and preserve originals. To correct time, provide `correctsEventId`, category, day, and the corrected total. Each original allows one correction; later total revisions use new time events.
- JSON export is available in the dashboard. JSON import and restoration are outside the MVP.
- For a recoverable backup of the embedded database, stop WID and copy its data directory. Do not copy an embedded database while it is in use.

### External PostgreSQL (optional)

Set `WID_DATABASE_URL` in the server process environment, pointing to a **database dedicated to WID**, and run `wid start`. The schema uses `wid_*` tables. WID does not create a database/user on the server and does not store the connection string in agent configuration or exports.

This mode uses the `pg` adapter. The default local flow is tested with embedded PostgreSQL; validate connectivity and permissions in your environment before using an external server. Changing engines does not migrate data automatically.

## Development

The primary local checkout is `C:\nac\wid`. The original brand kit is in `brand/`: an SVG logo for each theme, the symbol, and web/application icons. Dashboard SVGs are imported directly from the master files; `ui/public` contains prepared favicon and application icon files served at stable URLs. Do not redraw or change the assets' proportions. The manifest declares the application identity; this version does not provide offline caching.

```sh
git clone https://github.com/natharuc/wid.git
cd wid
npm install
npm run typecheck
npm test
npm run build
npm start
```

`npm install` runs the build through `prepare`. If PATH exceeds the Windows `cmd.exe` limit, use a terminal with a shorter PATH or `npm --script-shell pwsh install` / `npm --script-shell pwsh run build`.

Structure:

```text
src/domain/           contracts, validation, states, and time accounting
src/application/      use cases and the persistence port
src/infrastructure/   PostgreSQL, settings, and agent integration
src/interface/        HTTP, MCP, and stdio
ui/                   React + DaisyUI + Tailwind dashboard
tests/                domain, real embedded database, HTTP/MCP, and isolated configuration
```

The domain has no knowledge of HTTP, MCP, the web interface, or the database. The application service depends on the `WorkStore` port; infrastructure implements it. Interfaces use the same use cases. Transactions keep tasks, events, and idempotency atomic; immutable events accompany the current projection.

## Next steps

Publication to the npm registry; authenticated read connectors for GitHub/Azure DevOps; an explicit human timer; more agents and documented hooks; pagination, filters, and user-declared coverage; export import and recovery.

## Implementation references

- [DaisyUI with Vite](https://daisyui.com/docs/install/vite/) and [built-in themes](https://daisyui.com/docs/themes/).
- [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server) and [local and HTTP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
- [Codex MCP](https://developers.openai.com/codex/mcp) and [AGENTS.md instructions](https://developers.openai.com/codex/guides/agents-md).
- [Claude Code MCP](https://code.claude.com/docs/en/mcp) and [hooks](https://code.claude.com/docs/en/hooks).
- [Cursor MCP](https://cursor.com/docs/mcp).

## License

MIT.
