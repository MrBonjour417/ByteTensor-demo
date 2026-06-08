# Conduit Conversation Mode Design

## Goal

Upgrade Conduit Delivery from a header-button workflow into a conversation-driven PM delivery mode. A user enters Conduit mode from the chat input, provides PM requirements and clarification answers in the conversation, confirms the generated requirement and plan, then triggers the existing end-to-end Conduit delivery workflow. The current Conduit Delivery panel remains in the conversation experience as a process cockpit for status, stages, requirement DSL, plan, changed files, verification results, PR-ready handoff, and model metrics.

The first implementation remains anchored on the L1 Conduit requirement: show article word count and estimated reading time on the article detail page. The design also covers the competition scoring requirements so later implementation phases can add deeper replay, memory, observability, and cross-stack consistency without replacing the P0 architecture.

## Scope

### In scope

- Conversation commands for entering, operating, and exiting Conduit mode.
- PM input and clarification inside the existing chat experience.
- A conversation-scoped Conduit session that prevents Conduit-mode input from being sent to the normal chat agent.
- A Conduit clarification flow that structures ambiguous PM input before execution.
- A requirement DSL and confirmation/plan summary before the workflow runs.
- Reuse of the existing Conduit Delivery panel as a process cockpit, not as the primary input surface.
- Local official Conduit sandbox support via `git clone` for repeatable local testing and debugging.
- Official/fork-based Conduit experiment support for real repository validation, without automatic push or PR creation.
- Event-sourced state for traceability and limited replay.
- L1 article reading-statistics Skill as the P0 executable path.
- Tests and i18n updates for all user-visible command, card, status, and error copy.

### Out of scope for P0

- Automatic push or automatic GitHub pull-request creation.
- Full L2 cross-stack field-change automation.
- A complete multi-Agent visual workbench.
- A complex monitoring dashboard.
- Arbitrary DAG replay from every internal step.
- Automatic demo-video generation.

These are preserved as P1/P2 capabilities where noted below.

## Approved Product Flow

### Entering Conduit mode

The chat input supports both command forms:

- `/conduit` enters Conduit mode and waits for the first PM requirement.
- `/conduit <requirement>` enters Conduit mode and immediately records `<requirement>` as the first PM input.

After entry, the current conversation owns one active Conduit session. Normal text input in that conversation is treated as PM input or a clarification answer, not as a normal message to the conversation agent.

### Clarification and confirmation

Conduit mode is intentionally not a one-shot command. The session asks clarifying questions when PM input is incomplete or ambiguous. Clarification focuses on:

- the user-visible behavior,
- data source and calculation rules,
- affected Conduit modules,
- whether the task is L1, L2, or L3,
- whether frontend, backend, or database changes are required,
- acceptance criteria,
- tests and verification commands,
- risks or contradictions.

When information is sufficient, the session shows a requirement-confirmation card in the conversation. The card includes the structured DSL, plan summary, target modules, verification strategy, and risks. Execution does not start until the user confirms by typing `/conduit run` or by using an equivalent confirm action in the UI.

### Execution and handoff

After confirmation, Conduit runs the delivery workflow:

1. select a Skill,
2. build minimal Conduit context,
3. locate modules,
4. generate a plan,
5. generate and apply patches,
6. run lint/unit verification,
7. generate a PR-ready handoff summary.

The app does not push or open a PR automatically. It produces changed files, verification results, PR title/body, and manual branch/commit/push/PR commands.

### Operational commands

P0 command set:

- `/conduit` — enter mode.
- `/conduit <requirement>` — enter mode and submit the first PM requirement.
- `/conduit run` — execute after the session is ready to run.
- `/conduit status` — show current session and run status.
- `/conduit revise` — return to clarification/plan revision.
- `/conduit replay <stage>` — replay from a supported stage.
- `/conduit exit` — exit Conduit mode and restore normal chat behavior.
- `/conduit help` — show supported commands.

P0 supports replay from `plan`, `patch`, `verify`, and `summary`. P1 can extend replay to finer-grained event DAGs.

## Repository Modes

### Local Sandbox Path

Local testing and debugging may use a fresh local clone of the official repository:

```text
git clone https://github.com/TonyMckes/conduit-realworld-example-app <local-sandbox-path>
```

The local sandbox path is the default P0 execution target because it is repeatable, resettable, and safe for iterative debugging. The system validates that the local repository is official Conduit-derived before writing. It may store the last selected local sandbox path as a user preference.

### Official Experiment Path

The system may also run a real experiment against the official Conduit repository or a clearly identified fork. This mode is allowed for authentic competition validation, but it remains conservative:

- validate repository identity before writing,
- write changes only inside the selected Conduit repository,
- record events, metrics, and verification results,
- leave git branch, commit, push, and PR creation to the user unless a later explicit workflow allows them,
- never treat a non-Conduit mock repository as a valid target.

This satisfies the requirement to run on a real Conduit repository while preserving user control over public repository writes.

## Architecture

### Renderer layer

#### `SendBox` and platform sendboxes

The conversation input layer becomes the command entry point. It must intercept Conduit commands before normal `conversation.sendMessage` or platform-specific send APIs run.

Responsibilities:

- parse `/conduit` commands,
- activate/deactivate Conduit mode for the current conversation,
- route PM text and clarification answers to Conduit session IPC,
- prevent Conduit-mode input from reaching the normal agent,
- preserve visible conversation history for PM inputs and Conduit cards,
- restore normal sending after `/conduit exit`.

The implementation should follow the existing `/btw` precedent for pre-send command interception because existing slash-command menu matching only handles bare `/name` tokens and is not sufficient for `/conduit <requirement>`.

#### Conversation messages

The conversation should retain natural PM traceability:

- user commands and PM/clarification inputs appear as user-visible conversation entries,
- Conduit questions, requirement confirmation, plan, status, and results appear as Conduit-specific cards,
- these Conduit entries do not become normal agent prompts.

#### `ConduitDeliveryPanel`

The existing panel remains but changes product role:

- from primary input form,
- to process cockpit.

It displays current session/run state for the active conversation:

- session status,
- stage timeline,
- clarifying questions,
- requirement DSL,
- plan summary,
- module locations,
- changed files,
- verification commands and results,
- PR-ready summary,
- model metrics,
- replay controls.

The panel must filter state by conversation/run to avoid global state bleeding across conversations.

### Common contract

Extend the shared Conduit contract with serializable types only. Candidate types:

- `ConduitSessionState`,
- `ConduitSessionCommand`,
- `ConduitRequirementDsl`,
- `ConduitClarificationQuestion`,
- `ConduitPlanSummary`,
- `ConduitStage`,
- `ConduitReplayRequest`,
- `ConduitModelMetrics`.

Renderer code must not import main-process services. Main-process code must not import React or DOM APIs. All cross-process communication goes through the IPC bridge.

### Main process layer

#### `ConduitSessionService`

Owns the conversation-scoped PM session:

- create or resume a session for a conversation,
- record PM input,
- store clarification answers,
- manage session status,
- map `conversationId` to active `sessionId` and `runId`,
- expose current state to renderer callers.

#### `ConduitClarifier`

Turns ambiguous PM input into either clarification questions or a structured requirement DSL. It must not hardcode success from incomplete input. When the request remains underspecified after bounded clarification, it returns explicit unresolved points.

#### `ConduitOrchestrator`

Coordinates the delivery stages after the DSL is confirmed:

- Skill matching,
- context selection,
- plan generation,
- module location,
- patch generation,
- repository write,
- verification,
- summary generation,
- replay from supported stages.

The existing `ConduitWorkflowService` can remain the P0 execution engine, with the session/orchestrator layer above it. Later phases can split individual agents more aggressively.

#### `ConduitEventStore`

The event store is the source of traceability and replay. Events include:

- session started,
- PM input received,
- clarification asked,
- clarification answered,
- DSL finalized,
- plan approved,
- stage started/succeeded/failed,
- replay requested,
- model metrics recorded,
- summary generated.

P0 can keep JSONL persistence. The API should remain storage-backend agnostic so a database-backed store can replace it later.

#### Existing Conduit services

Reuse and extend existing services instead of replacing them:

- `ConduitRepoService` for sandbox binding, clone, validation, path safety, and patch application,
- `ConduitSkillRegistry` for demand-pattern registration,
- `ConduitVerifier` for real command execution,
- `DoubaoModelClient` for model calls and metrics,
- `ConduitWorkflowService` for the existing L1 workflow execution path.

## Skill Abstraction

New demand modes should be registered through Skill files rather than mainline orchestration edits.

A Conduit Skill should own:

- metadata,
- DSL matcher,
- context needs,
- module location rules,
- plan generation,
- patch generation,
- verification commands,
- summary contribution.

P0 keeps the article reading-statistics Skill. P1 adds more L1/L2 frontend patterns. P2 adds cross-stack skills where backend schema/API changes drive frontend types, mocks, and callsites.

## State Machine

Core session statuses:

```text
idle
active_collecting_pm_input
clarifying
ready_to_confirm
ready_to_run
running
succeeded
failed
paused
exited
```

Rules:

- A conversation has at most one active Conduit session.
- `running` input is recorded as a note and does not start a new run.
- `failed` sessions can replay from supported stages.
- `exited` restores normal chat behavior.
- Historical runs remain discoverable for the same conversation.

## Data Flow

### Enter mode

```text
User input `/conduit` or `/conduit <requirement>`
→ SendBox intercepts before normal send
→ bridge: conduitDelivery.sessionCommand
→ ConduitSessionService creates/resumes session
→ EventStore appends session and PM-input events
→ Renderer shows Conduit mode/card
→ Panel highlights current session
```

### Clarify

```text
PM input
→ SendBox sees active Conduit session
→ bridge: conduitDelivery.appendPmInput
→ Clarifier analyzes ambiguity
→ returns clarification question or finalized DSL
→ conversation shows Conduit card
→ Panel shows DSL/status
```

### Run

```text
User confirms with `/conduit run`
→ session must be ready_to_run
→ Orchestrator reads DSL
→ SkillRegistry selects Skill
→ Context Builder locates files
→ Skill generates plan/patch
→ RepoService writes sandbox
→ Verifier runs commands
→ Summary Builder creates PR-ready handoff
→ EventStore persists every stage
→ Panel streams status/results
```

### Revise and replay

```text
/conduit revise
→ return to clarification or plan revision

/conduit replay verify
→ rerun verify and summary

/conduit replay patch
→ rerun patch, verify, and summary
```

## Error Handling

Errors should be understandable from a PM perspective and actionable for a developer.

- **Sandbox missing:** ask user to bind or clone the official Conduit repo; offer current workspace path if safe.
- **Non-official repository:** reject execution and show the official repository URL.
- **Ambiguous PM input:** ask clarification questions instead of generating code.
- **Clarification still incomplete:** show unresolved points and block `/conduit run`.
- **Doubao config missing:** record explicit missing-model-config metrics; deterministic L1 fallback may continue for demo, but the UI must not claim a real model call happened.
- **Patch failure:** stop before claiming success and show missing anchor/path details.
- **Verification failure:** mark the stage failed, show command/exit code/output, and suggest replay.
- **Unknown command:** show `/conduit help`; do not send unknown Conduit commands to the normal agent.
- **Conversation switch:** panel and session state must be conversation/run scoped.

## Testing Strategy

P0 tests should cover behavior, not implementation details.

### Command parsing and send interception

- `/conduit` enters mode.
- `/conduit <requirement>` enters mode and records requirement.
- `/conduit run/status/revise/replay/exit/help` routes correctly.
- Unknown Conduit commands do not reach normal chat send.
- Conduit-mode normal input calls Conduit session IPC and not `conversation.sendMessage`.
- After `/conduit exit`, normal sending resumes.

### Session service

- Creates and resumes a conversation-scoped session.
- Records PM input and clarification answers.
- Transitions through clarification, confirmation, run, success/failure, and exit.
- Blocks run when DSL is incomplete.
- Supports failed-to-replay transitions.

### Clarifier

- Produces clarification questions for vague input.
- Produces DSL when the L1 requirement is sufficiently specified.
- Includes acceptance criteria and verification expectations.
- Does not silently invent missing requirements.

### Orchestrator/workflow

- The article reading-statistics L1 flow still writes the expected sandbox files.
- Verification failures mark the correct stage failed.
- PR-ready summary is generated only from observed patch and verification results.
- Repository validation rejects non-Conduit and unsafe paths.

### Panel DOM

- Renders as a process cockpit.
- Displays session status, DSL, plan, stages, changed files, verification results, PR summary, and metrics.
- Filters by conversation/run.
- Shows errors and replay options.

### i18n

- All new user-facing text uses i18n keys.
- Keys are added to every language configured in `packages/desktop/src/common/config/i18n-config.json`.
- `bun run i18n:types` and `node scripts/check-i18n.js` are required after locale changes.

## Phase Plan

### P0: Conversation-driven L1 delivery

- Command entry and exit.
- Conversation-scoped session state.
- PM input and clarification cards.
- Requirement confirmation and `/conduit run`.
- Existing panel retained as process cockpit.
- Official local Conduit sandbox validation and writes.
- L1 article reading-statistics workflow.
- Basic event persistence and model metrics.
- Focused tests and i18n coverage.

### P1: Competition differentiators

- Stronger replay from plan/patch/verify/summary.
- Historical demand recall for similar requirements.
- More Skill files for additional L1/L2 patterns.
- Improved context builder beyond simple file targeting.
- Materials support for demo/README/architecture flow.

### P2: Cross-stack and observability depth

- L2 cross-stack field-change workflows.
- Backend schema/API changes driving frontend types, mocks, and callsites.
- Richer metrics panel for tokens, latency, cost, and success rates.
- Multi-Agent internal split where it improves maintainability.

## Competition Requirements Mapping

### Section 2.1 MVP

- PM natural-language input: Conduit mode accepts PM text in the chat.
- Clarification Agent: Clarifier asks questions before DSL finalization.
- Solution: confirmation card includes plan summary.
- Module location: Orchestrator/Skill reports files and reasons.
- Code generation: Skill generates patches.
- Conduit repository write: RepoService writes to a validated official-derived sandbox.
- Lint/unit tests: Verifier records command outcomes.
- PR handoff: Summary contains PR-ready title/body and manual commands.
- Three layers: renderer conversation UX, main-process Node services, AI orchestration through Clarifier/Skill/Orchestrator.
- Live demo: P0 runs the L1 article reading-statistics task.

### Section 2.2 judging highlights

- Skill abstraction: new modes can be added through Skill files.
- Breakpoint replay: event store and replay commands provide controlled downstream reruns.
- Cross-stack consistency: P2 adds backend-to-frontend propagation.
- Observability: model metrics are part of session/run state.
- Business-context feedback: P1 adds historical demand recall.
- Clarification depth: Clarifier blocks execution until key ambiguities are resolved.

### Section 4 core challenges

- Context engineering: Context Builder reads only necessary Conduit files.
- Requirement clarification: PM ambiguity is converted into questions and DSL.
- Abstraction: Skill Registry separates demand patterns from the trunk.
- Orchestration: Session + Orchestrator + EventStore make stages interruptible.
- Verifiability: real commands and observed exit codes drive status.
- Full-stack collaboration: P2 covers schema/API/frontend synchronization.
- Engineering delivery: real Conduit repo, tests, and PR-ready output are required.

### Section 6 scoring

- Technical depth and innovation: conversation session, DSL, Skill/Orchestrator split, replay, and observability.
- Engineering completeness: data → Agent → backend → frontend → tests → handoff.
- Business value: PM-style natural flow with confirmation and intervention.
- Code quality and docs: typed contracts, tests, i18n, and this design spec.
- Data and compliance: no secret persistence; model usage is explicit and auditable.
- Materials completeness: event logs and summaries support README, architecture diagrams, and demo scripts.

## P0 Acceptance Criteria

P0 is complete only when all of the following are true:

1. Typing `/conduit` enters Conduit mode.
2. Typing `/conduit 文章详情页展示字数和预计阅读时间` enters mode and records the requirement.
3. Conduit-mode normal input does not call normal chat send.
4. Ambiguous requirements produce clarification questions.
5. Sufficient requirements produce a DSL and plan confirmation card.
6. `/conduit run` executes only after the session is ready.
7. The L1 workflow writes the expected files in an official-derived Conduit sandbox:
   - `frontend/src/routes/Article/Article.jsx`,
   - `frontend/src/helpers/articleReadingStats.js`,
   - `frontend/src/helpers/articleReadingStats.test.js`.
8. Verification commands run and their real exit codes determine success/failure.
9. The panel displays session/run status, DSL, plan, stages, changed files, verification results, PR-ready summary, and metrics.
10. `/conduit exit` restores normal chat behavior.
11. Tests cover command routing, send interception, session state, panel rendering, and workflow execution.
12. All new user-visible strings are localized across configured languages.
13. The app does not automatically push or create a PR.
