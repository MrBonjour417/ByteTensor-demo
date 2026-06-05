# OMP ACP Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OMP as a ByteTensor-called ACP backend so ByteTensor can detect local `omp`, list it as `OMP`, and launch conversations through the existing ACP JSON-RPC flow.

**Architecture:** The built-in agent catalog is owned by the bundled AionCore backend, not by renderer TypeScript. AionCore seeds and hydrates `agent_metadata`, exposes visible rows through `/api/agents`, and ByteTensor consumes those rows without per-backend renderer branches. The AionUi side only needs compatibility tests plus a local smoke using a bundled AionCore binary that contains the new catalog row.

**Tech Stack:** AionCore Rust/SQLite migrations (`agent_metadata`), AionUi Electron/React/TypeScript renderer, Vitest 4, existing ACP JSON-RPC process client.

---

## Scope and source-of-truth boundary

The approved design says OMP belongs in the built-in ACP agent catalog. Repository research found that catalog in AionCore, not in this AionUi checkout:

- AionCore owns `agent_metadata` seed data in `crates/aionui-db/migrations/001_initial_schema.sql`.
- AionCore hydrates/probes rows in `crates/aionui-ai-agent/src/registry.rs`.
- AionUi calls `/api/agents` through `packages/desktop/src/common/adapter/ipcBridge.ts` and consumes `AgentMetadata` in renderer hooks.
- Renderer routing already treats any unknown `backend` as `type: 'acp'` through `packages/desktop/src/common/utils/buildAgentConversationParams.ts`.

Do not implement OMP by hardcoding a renderer-only fake row. That would display a chip without a backend row to spawn and would violate the design.

The implementation uses this exact built-in metadata:

```sql
id:                  '6f6d7001'
icon:                NULL
name:                'OMP'
backend:             'omp'
agent_type:          'acp'
agent_source:        'builtin'
agent_source_info:   '{"binary_name":"omp"}'
enabled:             1
command:             'omp'
args:                '[]'
env:                 '[]'
native_skills_dirs:  NULL
behavior_policy:     '{"supports_side_question":false}'
yolo_id:             NULL
sort_order:          3140
```

The plan uses `command = 'omp'` and `args = []` because the OMP documentation available in this session mentions ACP invocation but does not document an ACP CLI flag. Do not change those values during execution unless a source-verified OMP document or binary help output proves a different invocation and the user approves the changed design.

## File structure

### AionCore checkout

- Modify: `crates/aionui-db/migrations/001_initial_schema.sql`
  - Responsibility: fresh database seed rows; add OMP to the built-in ACP rows.
- Create: `crates/aionui-db/migrations/010_add_omp_acp_builtin_agent.sql`
  - Responsibility: existing user database migration; insert the OMP row without touching existing agents.
- Modify: `crates/aionui-ai-agent/src/registry.rs`
  - Responsibility: registry tests for seed counts and exact OMP metadata.

### AionUi checkout

- Modify: `tests/unit/common/utils.test.ts`
  - Responsibility: add a pure routing contract for built-in OMP metadata becoming an ACP conversation request without adding a new direct child under `tests/unit/common/`.
- Modify: `tests/unit/renderer/agentTypes.test.ts`
  - Responsibility: add a pure selector-key contract for built-in OMP rows without adding a new direct child under `tests/unit/renderer/`.
- No AionUi source file should change for OMP unless these pure contract tests fail.
- Local-only resource update for smoke: `resources/bundled-aioncore/<platform>-<arch>/aioncore[.exe]`
  - Responsibility: run ByteTensor against an AionCore binary that includes the OMP catalog row.
  - This path is ignored by git and is not committed.

---

### Task 1: Add OMP to AionCore built-in catalog

**Files:**
- Modify: `crates/aionui-db/migrations/001_initial_schema.sql`
- Create: `crates/aionui-db/migrations/010_add_omp_acp_builtin_agent.sql`
- Modify: `crates/aionui-ai-agent/src/registry.rs`

- [ ] **Step 1: Write the failing AionCore registry tests**

In `crates/aionui-ai-agent/src/registry.rs`, update the existing `#[cfg(test)] mod tests` block.

Change the expected seed row count in `hydrate_loads_seed_rows`:

```rust
#[tokio::test]
async fn hydrate_loads_seed_rows() {
    // `list_all_including_hidden` bypasses the available/enabled
    // filter so this assertion keeps counting the seed rows even
    // when none of the CLIs are installed on the test host.
    let reg = registry().await;
    let all = reg.list_all_including_hidden().await;
    assert_eq!(all.len(), 21);
}
```

Add this test after `find_builtin_claude_uses_managed_acp_runtime_metadata`:

```rust
#[tokio::test]
async fn find_builtin_omp_uses_direct_cli_metadata() {
    let reg = registry().await;
    let omp = reg.find_builtin_by_backend("omp").await.unwrap();

    assert_eq!(omp.id, "6f6d7001");
    assert_eq!(omp.name, "OMP");
    assert_eq!(omp.backend.as_deref(), Some("omp"));
    assert_eq!(omp.agent_type, AgentType::Acp);
    assert_eq!(omp.agent_source, AgentSource::Builtin);
    assert_eq!(omp.agent_source_info.binary_name.as_deref(), Some("omp"));
    assert!(omp.agent_source_info.bridge_binary.is_none());
    assert_eq!(omp.command.as_deref(), Some("omp"));
    assert!(omp.args.is_empty());
    assert!(omp.env.is_empty());
    assert!(omp.native_skills_dirs.is_none());
    assert!(!omp.behavior_policy.supports_side_question);
    assert!(omp.yolo_id.is_none());
    assert_eq!(omp.sort_order, 3140);
}
```

Change the ACP count in `list_by_agent_type_counts_seed_rows`:

```rust
#[tokio::test]
async fn list_by_agent_type_counts_seed_rows() {
    // Seed counts — exercised against the unfiltered view because
    // on CI hosts the CLIs aren't installed, so `list_by_agent_type`
    // (which applies the visibility filter) would report zero.
    let reg = registry().await;
    let all = reg.list_all_including_hidden().await;
    let count = |t: AgentType| all.iter().filter(|m| m.agent_type == t).count();
    assert_eq!(count(AgentType::Acp), 18);
    assert_eq!(count(AgentType::Nanobot), 1);
    assert_eq!(count(AgentType::OpenclawGateway), 1);
    assert_eq!(count(AgentType::Aionrs), 1);
}
```

- [ ] **Step 2: Run the new AionCore registry test and verify it fails**

Run from the AionCore checkout root:

```bash
cargo test -p aionui-ai-agent find_builtin_omp_uses_direct_cli_metadata
```

Expected result before implementation: FAIL because `find_builtin_by_backend("omp")` returns `None` and the test unwrap panics.

- [ ] **Step 3: Add the OMP row to the fresh database seed**

In `crates/aionui-db/migrations/001_initial_schema.sql`, insert this row after the Snow ACP row and before the `-- Non-ACP builtins` comment:

```sql
    ('6f6d7001', NULL, 'OMP',
     'omp', 'acp', 'builtin', '{"binary_name":"omp"}',
     1, 'omp', '[]', '[]',
     NULL,
     '{"supports_side_question":false}',
     NULL, 3140,
     unixepoch('now','subsec')*1000, unixepoch('now','subsec')*1000),
```

The preceding Snow row must keep its trailing comma. The new OMP row also keeps a trailing comma because the following Nanobot row remains in the same `VALUES` list.

- [ ] **Step 4: Add the existing-database migration**

Create `crates/aionui-db/migrations/010_add_omp_acp_builtin_agent.sql` with this exact content:

```sql
-- Migration 010: Add OMP as a builtin ACP backend.
--
-- Existing installations need this row in addition to the fresh-database
-- seed in 001_initial_schema.sql. Keep this as INSERT OR IGNORE so a user
-- database that already has the row is left untouched.

INSERT OR IGNORE INTO agent_metadata
    (id, icon, name, backend, agent_type, agent_source, agent_source_info,
     enabled, command, args, env, native_skills_dirs, behavior_policy, yolo_id,
     sort_order, created_at, updated_at)
VALUES
    ('6f6d7001', NULL, 'OMP',
     'omp', 'acp', 'builtin', '{"binary_name":"omp"}',
     1, 'omp', '[]', '[]',
     NULL,
     '{"supports_side_question":false}',
     NULL, 3140,
     unixepoch('now','subsec')*1000, unixepoch('now','subsec')*1000);
```

- [ ] **Step 5: Run targeted AionCore registry tests and verify they pass**

Run from the AionCore checkout root:

```bash
cargo test -p aionui-ai-agent hydrate_loads_seed_rows
cargo test -p aionui-ai-agent find_builtin_omp_uses_direct_cli_metadata
cargo test -p aionui-ai-agent list_by_agent_type_counts_seed_rows
```

Expected result for each command: PASS.

- [ ] **Step 6: Run the AionCore database/agent package tests**

Run from the AionCore checkout root:

```bash
cargo test -p aionui-db -p aionui-ai-agent
```

Expected result: PASS.

- [ ] **Step 7: Commit the AionCore catalog change locally**

Run from the AionCore checkout root:

```bash
git add crates/aionui-db/migrations/001_initial_schema.sql crates/aionui-db/migrations/010_add_omp_acp_builtin_agent.sql crates/aionui-ai-agent/src/registry.rs
git commit -m "feat(agent): add OMP ACP backend"
```

Expected result: a local commit is created. Do not push.

---

### Task 2: Verify AionUi consumes OMP as a normal ACP backend

**Files:**
- Modify: `tests/unit/common/utils.test.ts`
- Modify: `tests/unit/renderer/agentTypes.test.ts`

- [ ] **Step 1: Add the pure conversation-routing test**

In `tests/unit/common/utils.test.ts`, add these imports after the existing imports:

```ts
import { buildAgentConversationParams, getConversationTypeForBackend } from '@/common/utils/buildAgentConversationParams';
import type { TProviderWithModel } from '@/common/config/storage';
```

Append this describe block after the existing `describe('utils', () => { ... })` block:

```ts
const agentModel = { provider: 'test-provider', model: 'test-model' } as TProviderWithModel;

describe('buildAgentConversationParams', () => {
  it('routes OMP as an ACP backend without changing its backend key', () => {
    const params = buildAgentConversationParams({
      backend: 'omp',
      name: 'OMP',
      agent_id: '6f6d7001',
      workspace: '/tmp/workspace',
      model: agentModel,
    });

    expect(getConversationTypeForBackend('omp')).toBe('acp');
    expect(params).toEqual({
      type: 'acp',
      model: agentModel,
      name: 'OMP',
      extra: {
        workspace: '/tmp/workspace',
        custom_workspace: true,
        backend: 'omp',
        agent_name: 'OMP',
        agent_id: '6f6d7001',
      },
    });
  });

  it('continues to route non-ACP internal engines away from the ACP path', () => {
    expect(getConversationTypeForBackend('aionrs')).toBe('aionrs');
    expect(getConversationTypeForBackend('openclaw-gateway')).toBe('openclaw-gateway');
    expect(getConversationTypeForBackend('nanobot')).toBe('nanobot');
    expect(getConversationTypeForBackend('remote')).toBe('remote');
  });
});
```

- [ ] **Step 2: Add the pure selector-key test**

In `tests/unit/renderer/agentTypes.test.ts`, add this import after the existing imports:

```ts
import { getAgentKey } from '@/renderer/pages/guid/hooks/agentSelectionUtils';
```

Append this describe block after the existing `describe('fetchDetectedAgents', () => { ... })` block:

```ts
describe('getAgentKey', () => {
  it('uses the OMP backend key for the built-in OMP ACP row', () => {
    expect(
      getAgentKey({
        id: '6f6d7001',
        backend: 'omp',
        agent_type: 'acp',
        agent_source: 'builtin',
      })
    ).toBe('omp');
  });

  it('keeps row-scoped custom ACP agents keyed by id', () => {
    expect(
      getAgentKey({
        id: 'custom-omp-wrapper',
        backend: 'omp',
        agent_type: 'acp',
        agent_source: 'custom',
      })
    ).toBe('custom-omp-wrapper');
  });
});
```

- [ ] **Step 3: Run the AionUi contract tests**

Run from the AionUi checkout root:

```bash
bun run test -- tests/unit/common/utils.test.ts tests/unit/renderer/agentTypes.test.ts
```

Expected result: both test files PASS.

- [ ] **Step 4: Do not modify AionUi source if the tests pass**

No AionUi source change is required when Task 2 Step 3 passes. Existing code already routes `backend: 'omp'` as ACP through `buildAgentConversationParams` and keeps built-in selection keyed by `backend` through `getAgentKey`.

If either test fails, fix only the smallest source branch that broke the contract:

```ts
// packages/desktop/src/common/utils/buildAgentConversationParams.ts
// Unknown backend keys must keep falling through to ACP.
default:
  return 'acp';
```

```ts
// packages/desktop/src/renderer/pages/guid/hooks/agentSelectionUtils.ts
// Builtin ACP rows must keep using backend/agent_type; only custom and remote rows are row-scoped.
const rowScoped = agent.agent_type === 'remote' || agent.agent_source === 'custom';
```

Then rerun:

```bash
bun run test -- tests/unit/common/utils.test.ts tests/unit/renderer/agentTypes.test.ts
```

Expected result after any minimal fix: PASS.

- [ ] **Step 5: Commit the AionUi contract tests locally**

Run from the AionUi checkout root:

```bash
git add tests/unit/common/utils.test.ts tests/unit/renderer/agentTypes.test.ts
git commit -m "test(agent): cover OMP ACP routing contracts"
```

Expected result: a local commit is created. Do not push.

---

### Task 3: Run ByteTensor against an AionCore binary that contains OMP

**Files:**
- Local-only ignored resource update: `resources/bundled-aioncore/<platform>-<arch>/aioncore[.exe]`
- Read-only verification: `package.json`
- Read-only verification: `packages/desktop/src/process/backend/binaryResolver.ts`

- [ ] **Step 1: Build the local AionCore binary from Task 1**

Run from the AionCore checkout root:

```bash
cargo build --release -p aionui-app
```

Expected output binary:

```text
target/release/aioncore.exe
```

On non-Windows platforms the expected binary is:

```text
target/release/aioncore
```

Do not change AionUi committed source in this step. The output binary is a local test artifact.

- [ ] **Step 2: Replace the ignored bundled backend binary for local smoke**

Copy the Task 1 AionCore executable into the matching AionUi ignored resource directory:

```text
resources/bundled-aioncore/win32-x64/aioncore.exe
```

On a non-Windows platform, use the matching runtime directory already used by `packages/desktop/src/process/backend/binaryResolver.ts`:

```text
resources/bundled-aioncore/<process.platform>-<process.arch>/aioncore
```

Do not commit `resources/bundled-aioncore`; it is ignored by git.

- [ ] **Step 3: Verify the renderer sees an OMP row when `omp` is on PATH**

Run ByteTensor from the AionUi checkout root with the new local backend binary and `omp` available on PATH:

```bash
BYTETENSOR_DISABLE_AUTO_UPDATE=1 bun start
```

Expected result in the running app:

- App launches without fatal backend errors.
- Agent settings or the guide agent selector includes `OMP` when the `omp` command resolves.
- Selecting `OMP` creates an ACP conversation with `extra.backend = 'omp'`.

Expected result when `omp` is not on PATH:

- App launches without fatal backend errors.
- `OMP` is absent from visible `/api/agents` results because AionCore filters unavailable rows from the public list.
- Other agents still appear according to their existing availability.

- [ ] **Step 4: Verify no renderer fallback row was added**

Inspect the AionUi source touched by this plan. The only committed AionUi changes should be the contract-test additions from Task 2.

Expected committed AionUi files for OMP:

```text
tests/unit/common/utils.test.ts
tests/unit/renderer/agentTypes.test.ts
```

There must be no hardcoded OMP row in:

```text
packages/desktop/src/renderer/hooks/agent/useAgents.ts
packages/desktop/src/renderer/utils/model/agentTypes.ts
packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx
packages/desktop/src/renderer/pages/guid/hooks/agentSelectionUtils.ts
packages/desktop/src/common/utils/buildAgentConversationParams.ts
```

---

### Task 4: Verify ACP conversation behavior with an OMP stand-in

**Files:**
- Use existing fixture: `tests/fixtures/fake-acp-cli/index.js`
- No committed file change required for this task.

- [ ] **Step 1: Create a local Windows PATH wrapper named `omp` that delegates to the ACP fixture**

Run in PowerShell:

```powershell
New-Item -ItemType Directory -Force D:\OmpProject\omp-acp-test-bin
Set-Content -Path D:\OmpProject\omp-acp-test-bin\omp.cmd -Value '@echo off`r`nnode D:\OmpProject\AionUi\tests\fixtures\fake-acp-cli\index.js %*`r`n' -Encoding ASCII
```

Expected result: `D:\OmpProject\omp-acp-test-bin\omp.cmd` exists and invokes the existing ACP fixture.

- [ ] **Step 2: Start ByteTensor with the wrapper first on PATH**

Run from the AionUi checkout root with the Task 3 backend binary:

```powershell
$env:PATH = "D:\OmpProject\omp-acp-test-bin;$env:PATH"
$env:BYTETENSOR_DISABLE_AUTO_UPDATE = "1"
bun start
```

Expected result: `OMP` appears in the local agents list because AionCore resolves the wrapper command.

- [ ] **Step 3: Send a message through OMP**

In the running app:

1. Select `OMP` in the guide/chat agent selector.
2. Send `hello omp`.

Expected result: the conversation receives a streamed response from the fake ACP CLI containing:

```text
Fake response to: hello omp
```

Expected protocol path:

```text
ByteTensor selector
  -> create conversation with extra.backend = 'omp'
  -> AionCore ACP manager spawns command `omp`
  -> fake ACP CLI handles initialize
  -> fake ACP CLI handles session/new
  -> fake ACP CLI handles session/prompt
```

- [ ] **Step 4: Stop the app and remove the temporary wrapper**

Stop the running Electron app. Delete the temporary `omp` wrapper directory. Do not commit any temporary wrapper file.

---

### Task 5: Final AionUi verification

**Files:**
- Contract-test additions from Task 2.
- Ignored local backend resource from Task 3.

- [ ] **Step 1: Run format check**

Run from the AionUi checkout root:

```bash
bun run format:check
```

Expected result: PASS with `All matched files use the correct format.`

- [ ] **Step 2: Run TypeScript typecheck**

Run from the AionUi checkout root:

```bash
bunx tsc --noEmit
```

Expected result: exit code 0.

- [ ] **Step 3: Run targeted unit tests**

Run from the AionUi checkout root:

```bash
bun run test -- tests/unit/common/utils.test.ts tests/unit/renderer/agentTypes.test.ts tests/unit/renderer/buildSendFailureError.test.ts tests/unit/renderer/normalizeDbMessage.test.ts
```

Expected result: all listed test files PASS.

- [ ] **Step 4: Run backend smoke without OMP on PATH**

Run from the AionUi checkout root with the Task 3 backend binary and without the temporary OMP wrapper on PATH:

```bash
BYTETENSOR_DISABLE_AUTO_UPDATE=1 bun start
```

Expected result:

- Electron main/preload/renderer bundles build.
- Backend starts and reports health ready.
- App does not crash because `omp` is absent.
- Existing available agents still load.

- [ ] **Step 5: Commit any final AionUi verification-only changes locally**

If Task 2 already committed the only AionUi file changes, skip this step.

If formatting changed either contract-test file, run from the AionUi checkout root:

```bash
git add tests/unit/common/utils.test.ts tests/unit/renderer/agentTypes.test.ts
git commit -m "style(agent): format OMP contract tests"
```

Expected result: a local commit is created only when a file changed. Do not push.

---

## Acceptance checklist

- [ ] AionCore fresh database seed contains the OMP built-in ACP row.
- [ ] AionCore migration `010_add_omp_acp_builtin_agent.sql` adds OMP for existing user databases.
- [ ] AionCore registry tests prove OMP metadata is exact and seed counts are updated.
- [ ] AionUi contract tests prove OMP keeps `backend: 'omp'`, routes as ACP, and uses the built-in selector key.
- [ ] Missing `omp` does not break ByteTensor startup.
- [ ] `omp` present on PATH makes OMP appear through `/api/agents`.
- [ ] A fake ACP CLI reached through an `omp` wrapper can initialize, create a session, and answer a prompt.
- [ ] No remote GitHub operation is performed.
