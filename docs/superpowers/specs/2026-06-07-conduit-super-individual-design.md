# Conduit Super Individual Design

## Goal

Build a competition-focused Conduit Delivery Workspace inside ByteTensor that can take a PM request, clarify it, generate an implementation plan, locate modules, patch a real Conduit sandbox repository, run verification, and present a PR-ready handoff summary. The first demo requirement is the L1 Conduit task: show article word count and estimated reading time on the article detail page.

## Scope

### In scope

- A new competition branch and documentation track that is unrelated to the previous rebrand/release work.
- A fresh Conduit sandbox cloned or bound from `https://github.com/TonyMckes/conduit-realworld-example-app`.
- A narrow `conduitDelivery` bridge namespace exposed through the existing IPC bridge pattern.
- Main-process services for repository safety, skill selection, workflow orchestration, event persistence, verification, and Doubao model configuration checks.
- Conversation-integrated renderer controls and workflow status display; no separate demo page.
- A first registered Skill for article reading statistics.
- Deterministic repository patching for the first L1 Skill, with actual writes to the Conduit sandbox.
- Verification results captured from commands that run inside the Conduit sandbox.
- PR-ready summary generation without automatically pushing or opening a PR.
- Focused ByteTensor unit tests and Conduit sandbox tests.

### Out of scope

- Using or copying `D:/OmpProject/Tensor`.
- Automatically creating a GitHub pull request.
- Implementing all L2/L3 practice tasks.
- Building a generic multi-repository automation platform before the Conduit MVP works.
- Storing Doubao endpoint or API keys in repository files.
- Faking successful model calls, repository writes, lint, tests, or PR creation.

## Competition Requirements Grounding

The competition requires an MVP chain from PM natural-language input through clarification, solution generation, module location, code generation, writes to a real Conduit repository, lint/unit tests, and PR handoff. It also requires three real layers: a frontend conversation page, a Node backend, and AI orchestration through Skill / Agent / Orchestrator boundaries.

This design implements those layers in ByteTensor:

- **Frontend:** Conversation header controls and workflow status/results in the existing conversation experience.
- **Node backend:** Main-process services and bridge handlers that own sandbox IO, patching, verification, and event state.
- **AI orchestration:** A Skill registry and workflow service that separate demand-pattern metadata from the orchestration trunk.

The first Skill is deterministic for the selected L1 task so the demo can run even when model credentials are absent. Missing Doubao configuration is still recorded as an explicit model-configuration error, not a fake AI success.

## Architecture

### Shared Contract

Create `packages/desktop/src/common/types/conduitDelivery.ts` as a pure shared contract. It defines:

- sandbox binding and clone requests,
- workflow run state,
- stages and persisted events,
- Skill metadata and selected Skill IDs,
- AI-call metrics and missing-configuration errors,
- verification command results,
- changed-file records,
- PR-ready summary shape.

This file must not import Node, DOM, or Electron APIs.

### Main-Process Services

Add focused services under `packages/desktop/src/process/services/conduit/`.

#### `ConduitRepoService`

Responsibilities:

- validate that a sandbox path is safe and points to a Conduit repository,
- clone the official Conduit repository when requested,
- bind an existing sandbox path after validation,
- resolve sandbox-relative paths without allowing traversal,
- apply deterministic text patches only inside the sandbox,
- list changed files.

A write path is valid only when the normalized target remains inside the normalized sandbox root. The service never writes to `D:/OmpProject/Tensor`.

#### `ConduitSkillRegistry`

Responsibilities:

- register the article reading-stat Skill through metadata,
- select a Skill from PM requirement text,
- expose Skill metadata for UI and summary display.

The orchestrator does not hardcode demand-specific file paths. The Skill metadata owns matching phrases, target modules, expected changed files, verification commands, and deterministic patch generation.

#### `ConduitWorkflowService`

Responsibilities:

- own the stage sequence: intake, clarify, plan, locate, patch, verify, summarize,
- persist every stage event,
- expose current state and historical runs,
- support replay from a persisted run by reusing stored request and sandbox information,
- preserve failure states instead of converting them into success.

For the first L1 task, clarification defaults are explicit:

- count words from rendered article body text,
- use a documented 200 words-per-minute constant,
- round nonzero minutes up to at least one minute,
- render the statistic below the article body and above tags,
- do not render the line when article body is absent.

#### `ConduitVerifier`

Responsibilities:

- run configured commands in the sandbox root,
- capture command, cwd, exit code, stdout, stderr, and duration,
- mark a command as passed only when its actual exit code is zero,
- return failure details to workflow state and PR summary.

Verification never suppresses a failure to keep the workflow green.

#### `DoubaoModelClient`

Responsibilities:

- read endpoint, API key, and model name from environment variables,
- report an explicit missing-configuration result when they are absent,
- make model calls only when configuration is complete,
- record latency, token counts, and cost fields when the API returns them.

Environment variable names are the only supported configuration surface. Secrets are not stored in config files, event logs, specs, or generated summaries.

#### `ConduitEventStore`

Use a focused event store service rather than putting workflow events into `ConfigStorage`. The first implementation uses an injectable JSONL store under app data or a test-supplied path because it is simple, append-only, and easy to replay without changing the existing database schema. The service API remains storage-backend agnostic so a SQLite implementation can replace it later without changing workflow or bridge callers.

`ConfigStorage` is used only for a lightweight preference: the last selected Conduit sandbox path.

### Bridge Contract

Add a `conduitDelivery` namespace to `packages/desktop/src/common/adapter/ipcBridge.ts` and register handlers in `packages/desktop/src/process/bridge/conduitDeliveryBridge.ts`, wired from `packages/desktop/src/process/bridge/index.ts`.

Bridge methods:

- `getState({ runId })`
- `startRun(request)`
- `bindSandbox({ path })`
- `cloneSandbox({ targetPath })`
- `listRuns()`
- `replayRun({ runId })`
- `getChangedFiles({ runId })`

The bridge exposes product-level operations only. It does not expose arbitrary shell commands or arbitrary file writes.

### Renderer Integration

Use the existing Conversation shell.

- Add a compact Conduit Delivery control to `ChatConversation.tsx` via the existing `headerExtraNode` / `ChatLayout.headerExtra` seam.
- Use Arco `Button`, `Dropdown`, `Modal`, `Input`, `Alert`, `Timeline`, `Tag`, and `Typography` components for interactions and status.
- Show the current sandbox, selected Skill, stage timeline, verification status, changed files, model-configuration status, and PR-ready summary.
- Keep visible strings under `conversation.conduitDelivery.*` and mirror the keys in every configured locale.
- Do not add raw interactive HTML.

The first implementation can keep workflow results in the control panel rather than adding a new message wire type. This is sufficient for a PM-dialogue demo because the entry point and workflow status live inside the conversation experience, and it avoids destabilizing existing message streaming.

### First Skill: Article Reading Stats

The article reading-stat Skill writes these files in the Conduit sandbox:

- `frontend/src/helpers/articleReadingStats.js`
- `frontend/src/helpers/articleReadingStats.test.js`
- `frontend/src/routes/Article/Article.jsx`

Helper behavior:

- exports a 200 WPM constant,
- strips Markdown links, images, code fences, inline code, HTML tags, punctuation/control syntax, and collapses whitespace,
- returns `{ wordCount: 0, readingTimeMinutes: 0 }` for missing or empty bodies,
- rounds nonzero reading time up to at least one minute.

Article page behavior:

- imports the helper,
- computes stats from `body`,
- renders `This article has X words and takes about Y min to read.` below the Markdown body and above `ArticleTags`,
- does not render the statistic when `body` is missing.

### PR-Ready Summary

The workflow summary includes:

- PR title,
- PR body,
- changed file list,
- verification command results,
- exact manual commands for branch creation, commit, push, and PR creation.

The app does not run those git commands automatically.

## Data Flow

1. Renderer calls `bindSandbox` or `cloneSandbox`.
2. Bridge delegates to `ConduitRepoService` and stores the last sandbox preference.
3. Renderer calls `startRun` with a PM requirement and sandbox path.
4. `ConduitWorkflowService` creates a run and persists an intake event.
5. `DoubaoModelClient` validates model configuration and records either metrics or a missing-config event.
6. `ConduitSkillRegistry` selects the article reading-stat Skill.
7. Workflow persists clarification, plan, locate, patch, verify, and summarize events.
8. `ConduitRepoService` writes the Skill patch into the sandbox.
9. `ConduitVerifier` runs configured test commands in the sandbox and returns real exit codes.
10. Renderer fetches state and changed files, then displays status and handoff content.

## Error Handling

- Invalid sandbox path: return a structured `validation_failed` state with the rejected path omitted from logs when unsafe.
- Missing Conduit files: stop before patching and record the missing relative path.
- Patch mismatch: stop before partial writes when an expected anchor is absent.
- Verification failure: keep changed files and summary visible, but mark verification as failed.
- Missing Doubao configuration: continue deterministic L1 planning while showing an explicit missing-config model event.
- Clone failure: return command/output details without creating a run that claims success.

## Testing Strategy

### ByteTensor

- Unit-test Skill registry selection and metadata.
- Unit-test repository path safety and traversal rejection.
- Unit-test deterministic Conduit patch generation.
- Unit-test workflow stage transitions, failure paths, and replay.
- Unit-test verifier command status propagation.
- Unit-test PR summary generation.
- Unit-test missing Doubao environment handling.
- Add renderer DOM coverage for the Conversation Conduit control if it contains nontrivial conditional UI.

### Conduit sandbox

After the workflow writes the Skill patch, run the sandbox verification commands captured in workflow state. The required first command is a narrow Vitest invocation for `frontend/src/helpers/articleReadingStats.test.js`. If dependencies are available, run root `npm run test` or the narrowest reliable root Vitest command supported by the clone.

### Project gates

Run:

- `bun run lint -- --quiet`
- `bun run format:check`
- `bunx tsc --noEmit`
- targeted Conduit Delivery tests
- `bun run test`
- `bun run i18n:types` and `node scripts/check-i18n.js` when locale files change

## Security and Compliance

- No model secrets in code, docs, locale files, event logs, or tests.
- No arbitrary renderer-provided shell commands.
- No repository writes outside the validated Conduit sandbox.
- No use of the previous `D:/OmpProject/Tensor` prototype.
- No fake pass statuses.

## Acceptance Criteria

- A user can start from a Conversation-integrated Conduit Delivery control.
- A fresh or bound official Conduit sandbox is accepted only after validation.
- The L1 PM requirement triggers the registered reading-stat Skill.
- The workflow writes the expected Conduit files.
- Verification runs in the Conduit sandbox and reports actual exit codes.
- The UI shows stage timeline, changed files, verification results, model-config status, and PR-ready summary.
- ByteTensor tests and project gates listed in the implementation plan are run before completion.
