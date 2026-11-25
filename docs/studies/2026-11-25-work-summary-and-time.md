# Work summaries and human time estimation in WID

Product and method study, November 25, 2026. Baseline: version 0.5.0. This document proposes future work; it does not implement the capabilities it describes.

## Recommendation

WID should open with a short summary of work performed with AI and recorded human work time. History remains the auditable foundation, but users should not have to reconstruct their day by reading technical events.

Estimation should use episodes of human participation, with evidence, duration ranges, and personal calibration. AI interprets the work; deterministic rules reconcile sources and add up time. Counts of messages, tokens, tests, commits, or agent duration do not provide a valid conversion to human minutes.

Nathan chose **conversations and agent events only** as sources. Editor, active-window, keyboard, mouse, and screenshot sensors are outside this proposal. Agents continue to fill in the records; exceptional confirmations happen through conversation, without a mandatory dashboard form.

## What the baseline product does not yet solve

Version 0.5.0 provides persistence, global context, references, history, and separate time categories. However:

| Code finding | Consequence |
| --- | --- |
| `ui/DayOverview.tsx` highlights four metrics before activities. `ui/WorkComponents.tsx` presents a title and the current state. | There is no direct answer about that day's outcome or progress. |
| `ui/ActivityView.tsx` selects activities based on any event that day. | A context, reference, or estimate change can look like work performed on the task. |
| `src/interface/mcp.ts`, `estimateSchema`, and `wid_estimate_day` receive minutes, a free-text basis, and declared confidence. | The service stores the number chosen by the agent. There is no calibrated evidence-based estimator at this baseline. |
| `src/domain/work.ts`, `summarize`, keeps the latest total per task/day/category. | Idempotent writes do not resolve competing estimates or repeated work across chats. |
| The monthly warning detects days above 24 hours. | Smaller overlaps can also inflate totals. |

Synthetic example of the concurrency problem: two chats read the same review; one writes 60 minutes and the other 20. The latest total wins, without distinguishing complementary, repeated, or conflicting evidence. The current `max(measured, estimated)` rule is also an accounting convention, not validation of the estimate.

Small estimates attributed solely to a few messages, such as two or three minutes, should be treated as legacy estimates without method validation. This study does not modify or delete those records.

## Lessons from existing methods

The following sources describe their vendors' features, not proven accuracy for WID's use case.

| Reference | What to adopt | What should not transfer automatically |
| --- | --- | --- |
| [ActivityWatch](https://docs.activitywatch.net/en/latest/faq.html) | Local storage and a distinction between observed signals and presumed absence. | It uses application/inactivity signals that this WID proposal will not have. |
| [RescueTime](https://help.rescuetime.com/article/245-how-rescuetime-works) | Separate clock time from activity and allow work outside capture to be added. | Computer presence does not determine dedication to a task. |
| [Timely Memory](https://www.timely.com/help/handbook/autosheet/memory-101/) | Group signals into blocks and make suggestions inspectable. | Its timeline depends on activity sources other than conversations. |
| [Rize](https://docs.rize.io/automatic-tracking/time-entry-suggestions-settings) | Separate capture, grouping, and task attribution; learn from corrections. | Confidence in task classification is not confidence in human duration. |
| [Timely Agent Tracking](https://www.timely.com/ai-agents/) | Keep agent outcomes and execution in a separate track. | The reviewed offering is a beta; agent session duration does not measure human work time. |

The conclusion for WID is to adopt blocks and work attribution while preserving the chosen source restriction. The reviewed references do not validate a universal message-to-human-minutes formula.

The [SPACE framework, from Microsoft Research/ACM](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/), supports separating activity from productivity; it does not propose converting counts into duration. The [BLS American Time Use Survey diary](https://www.bls.gov/tus/) is a reference for reconstructing episodes with reported duration or start/end times. Self-report remains an imperfect reference, not a timer.

## The primary experience

The opening view should make the period understandable within seconds. The following is a synthetic example, unrelated to Nathan's actual hours:

```text
Context: Project A                         Today

What you did
• Defined the task classification rules.
• Reviewed the receipts fix; validation completed.
• Publication was blocked by the environment configuration.

Recorded human time: 30–35 min
20 min from a declared timer + 10–15 min estimated
Some periods have unknown human duration.

Each activity opens its task. View evidence is available in the details.
```

The list should consolidate repetitions by task/outcome and show a few main activities, with expansion for the rest. Intention without execution stays planned. Test evidence should explain what was validated. Administrative changes remain in the audit history and do not automatically become work accomplishments.

Agent-produced outcomes are part of work performed **with AI**, but wording must respect the roles: “Fix implemented by the agent and reviewed by you” requires evidence for both actions. An agent completion notice alone does not prove human review.

Task details should begin with a summary of outcomes, progress, and blockers. Hours, sources, and full history follow. Agent execution, waiting, tokens, and technical records belong in a secondary section. The existing global context continues to apply to every query.

## Proposed estimation method

### Extract facts before estimating duration

The agent records short, structured facts: task/context, action, actor, outcome, source, and evidence IDs. Requests, decisions, declared human reviews, reported manual tests, agent execution, declared pauses, and simple administrative updates must be distinguished.

“Test this” is an intention. “I tested it and reproduced the error” reports human execution. “The test command finished” demonstrates process execution. None of these statements determines human duration on its own.

WID should preserve the original source timestamp, recording time, and available temporal precision separately. An MCP call's `recordedAt` is not the time of a human message. When a client provides no timestamps, the service must not fabricate them from message order. Sources known only by day need to retain that granularity in a future contract; the baseline historical note requires a timestamp with an offset.

### Reconstruct episodes

An episode groups coherent participation: defining a requirement, reviewing an output, discussing a decision, or validating a result. It may include several messages and end with a topic change, an explicit pause, or evidence of another period.

Timestamps delimit a **candidate window**, not a proven continuous block of human work. An hour between messages could contain an hour of reading or a few minutes of interaction followed by a long absence. Agent events help explain the window but do not eliminate that ambiguity.

Any inactivity threshold used to segment episodes will be an experimental parameter, subject to validation. There will be no “X minutes per message,” “Y minutes per test,” or fixed percentage of chat duration. Message length and cadence may be supporting signals in a future model, never standalone measures: text may have been pasted, and reading can happen silently.

### Distinguish duration sources

| Source | Proposed treatment |
| --- | --- |
| “I timed 20 minutes.” | A user-declared measurement, with that provenance explicit. |
| “I probably spent between 10 and 15 minutes.” | A user-reported estimate. Do not promote it to a measurement. |
| A participation pattern with a sufficient personal reference | An inferred estimate, with a range, method, and evidence. |
| Proven participation without enough temporal support | Recorded activity with unknown duration. |
| Automatic execution or waiting | A separate agent/wait track; do not add it as human time. |

A declared measurement covering an entire episode replaces that episode's previous estimate. When it covers only part, it replaces only the corresponding part. Comparison requires identifying coverage; do not automatically choose the greater number or add a measurement already included in an estimate. A revision may reduce the total while preserving correction history.

During a job, the user may read, review, or work on another task. Including all execution time or subtracting all agent runtime would both be incorrect. The exclusion concerns automatic inference; human review evidenced during a job remains eligible.

### Start without false precision

Initially, prioritize explicitly reported durations and episodes with sufficient temporal evidence. For other episodes, present provisional range suggestions only when there is an explainable basis; without temporal support, record the fact and leave its duration unknown.

A numerical range must derive from reported duration, factual time constraints, or a personal model evaluated for that episode type. An eloquent LLM explanation does not satisfy this requirement. Timestamps delimiting a window alone do not support a positive lower bound for human time. Without that basis, the operational output is an episode recorded with unknown duration; experimental predictions do not automatically enter the reported total.

A wide range that materially changes the total may justify an occasional question in the chat: “Were you reviewing during this period, or did you leave the agent working?” The question must not be a condition for continuing the task. Without an answer, the gap remains.

Low/medium/high labels are not probabilities. Do not publish “90% confidence” or a percentage error until an evaluation supports that claim. The literature on [interval calibration](https://arxiv.org/abs/2107.07511) is a reference for later development, not automatic validation of an LLM-generated range.

### Reconcile every chat belonging to the same person

Evidence needs a stable source identity: conversation, message/event, and delegation relationships when available. A request forwarded to three agents does not represent three new human interventions. Textual similarity alone does not prove duplication either.

The service should reconcile evidence before summing time. Where known human intervals exist, consider their union and assign time across tasks without duplicating the same minute. A candidate window, however, cannot be treated as a measured human interval for that union.

If only duration is known but its position in time or attribution is uncertain, record a reconciliation pending state. Do not divide time equally between tasks or add the full duration in each context. Known human time without a defined task should remain visible in the overall total, with attribution pending.

Reconciliation must consider the person's contexts before applying the visual filter. Concurrent revisions need to identify the previous revision and the evidence set considered, so a partial estimate does not silently erase another. Corrections remain auditable.

## Calculation example

This example is entirely synthetic; durations come from the scenario's reports, not message coefficients:

| Evidence | Human time | Agent execution |
| --- | --- | --- |
| The user declares a timed 20-minute review. | 20 min, declared measurement | — |
| A job runs for 20 min with no information about human participation. | Unknown in that window | 20 min |
| The user estimates 10–15 min of validation. A second agent references the same validation. | 10–15 min, once | Separate, if recorded |

Result: **30–35 recorded human minutes**, comprising 20 declared measured minutes and 10–15 estimated minutes. The job window still lacks sufficient human coverage; this does not mean the user did no work. The result does not represent a complete working schedule.

This sum assumes that review and validation are distinct activities, with no overlap or inclusion of one duration within the other. The second agent's mention references the same validation rather than a new activity.

## Answering how many hours were worked this month

The report should state recorded work time for the period, its composition by source, and its gaps. For example, using synthetic figures: “33h30–41h30 recorded, including 5h30 from a declared timer and 28–36h estimated; six activities still have no duration.” A range covers only the estimated portion, not unobserved work.

Adding lower and upper bounds may form a range of recorded scenarios. This does not create a monthly interval with guaranteed probabilistic coverage: episode and daily errors may be dependent. The aggregation method and its validation must be explicit. Unknown time never becomes zero, a standard working day, or a way to fill the remaining hours of a day.

## Minimal contract and architecture evolution

This table describes future needs, **not parameters available in the baseline tools**:

| Information | Purpose |
| --- | --- |
| Evidence IDs, source, actor, and temporal precision | Support facts and enable deduplication. |
| Episode and observed window, with pauses/gaps | Organize participation without assuming continuous presence. |
| Duration source, bounds, and an optional central point | Separate reports, declared measurement, inference, and unknown time. |
| Method/version, assumptions, and excluded evidence | Explain and reproduce the estimate. |
| Previous revision and evidence already covered | Resolve concurrency and corrections without silent loss. |
| Summary per task/day with supporting IDs | Feed the quick summary without inventing outcomes. |

The first implementation can extend existing records and reports without multiplying MCP tools. Connected agents extract facts from the conversation context. The local service validates references, states, revisions, and sums; it does not initially require an additional LLM or provider key in WID.

During transition, a legacy task/day total and new episodes reconstructing that same work are alternative revisions, not additive portions. The new revision identifies the already-covered evidence it replaces. Without a sufficient match, mark reconciliation as pending and do not automatically add episodes to the old total. Preserving data includes preserving this distinction alongside the audit trail.

Collectors should state which data each client can actually provide. Connecting MCP does not guarantee access to the entire conversation or original timestamps. Records store summaries and minimal identifiers, without raw transcripts, credentials, or complete prompts. This proposal does not include a general history import.

## Delivery order and acceptance criteria

1. **Summary first.** A home view with facts/deliveries, progress, and blockers; a source accessible for each item. Exclude administrative audit events from the accomplishment summary. Check whether Nathan can understand the day quickly without opening every task.
2. **Evidence and episodes.** Prospective capture by agents, explicit client capabilities, temporal precision, and duplicate reconciliation. Preserve legacy estimates with their provenance.
3. **Estimation in observation.** Per-episode proposals with a range and explanation. No accuracy promises or unsupported duration records. Regressions should cover pauses, long execution, human/automatic tests, delegation, two chats, and day boundaries.
4. **Personal pilot.** Roughly two weeks as an initial trial, without treating that duration as a statistically sufficient sample. Use spontaneous reports and, when necessary, at most one short confirmation per day as a hypothesis about user burden. Participation is optional; no response does not block the product.
5. **Evaluation and gradual release.** Separate days used to fit the method from days used to evaluate it. Compare with a simple reference method; measure absolute error, over/underestimation bias, range width and coverage, cross-chat reconciliation, unknown time, and question burden. User reports are an imperfect reference; distinguish cases with a declared timer. Continue collection/evaluation if evidence is insufficient to promote automatic inference.

The immediate criteria are traceability of every statement, no duration generated solely from event counts, no known duplication, and visible gaps. The proposed method's temporal accuracy still needs demonstration; the product's immediate value is summarizing work correctly and organizing the evidence needed to improve estimation.
