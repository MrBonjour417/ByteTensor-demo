# ByteTensor Display-Layer Aion Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove remaining user-visible and project-owned `Aion` branding by presenting bundled tools as ByteTensor while preserving runtime identifiers required for startup and backend integration.

**Architecture:** This is a display-layer cleanup on top of the existing ByteTensor rebrand. User-facing strings, docs, and project-owned base component symbols move to ByteTensor names; backend/runtime identifiers such as `aioncore`, `aionrs`, `AION_CLI_*`, and `@office-ai/aioncli-core` remain unchanged. Component symbol changes use LSP rename or file rename so call sites update safely.

**Tech Stack:** Electron, React, TypeScript, Bun, Vitest, i18next locale JSON, Arco Design, Oxlint/Oxfmt.

---

## File Structure Map

### Project-owned base component rename surface

These are project-owned wrapper components. Rename symbols and files, but keep existing behavior and existing CSS class names unless a class is still old-brand (`.aion-select`).

- Rename: `packages/desktop/src/renderer/components/base/AionModal.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorModal.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionSelect.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorSelect.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionCollapse.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorCollapse.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionScrollArea.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorScrollArea.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionSteps.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorSteps.tsx`
- Modify: `packages/desktop/src/renderer/components/base/index.ts`
- Modify all imports/usages under `packages/desktop/src/renderer/` and `tests/` that reference these component symbols or file paths.

### Display text surface

These files contain visible strings or docs where `Aion CLI`, `AionCore`, `aionrs`, `Aion UI`, or app-brand `Aion` should become ByteTensor wording while preserving runtime identifiers.

- Modify locale JSON:
  - `packages/desktop/src/renderer/services/i18n/locales/en-US/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/en-US/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/zh-CN/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/zh-CN/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/zh-CN/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/zh-TW/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/zh-TW/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/zh-TW/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ja-JP/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ja-JP/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ja-JP/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ko-KR/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ko-KR/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ko-KR/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/tr-TR/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/tr-TR/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/tr-TR/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ru-RU/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ru-RU/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/ru-RU/settings.json`
  - `packages/desktop/src/renderer/services/i18n/locales/uk-UA/common.json`
  - `packages/desktop/src/renderer/services/i18n/locales/uk-UA/cron.json`
  - `packages/desktop/src/renderer/services/i18n/locales/uk-UA/settings.json`
- Modify channel fallback display names only, preserving `agent_type: 'aionrs'`:
  - `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/DingTalkConfigForm.tsx`
  - `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/LarkConfigForm.tsx`
  - `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/TelegramConfigForm.tsx`
  - `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/WecomConfigForm.tsx`
  - `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/WeixinConfigForm.tsx`
- Modify user-facing error/log text:
  - `packages/desktop/src/renderer/pages/conversation/utils/createConversationParams.ts`
  - `packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts`
  - `packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx`
- Modify docs/readmes:
  - `readme.md`
  - `docs/readme/readme_ch.md`
  - `docs/readme/readme_es.md`
  - `docs/readme/readme_jp.md`
  - `docs/readme/readme_ko.md`
  - `docs/readme/readme_pt.md`
  - `docs/readme/readme_ru.md`
  - `docs/readme/readme_tr.md`
  - `docs/readme/readme_tw.md`
  - `docs/readme/readme_uk.md`
  - `docs/contributing/file-structure.md`
  - `docs/prds/conversations/custom/custom-agent.md`
  - `docs/prds/conversations/remote/remote-agent.md`
  - `docs/prds/remote/channels/channels.md`
- Leave upstream link URLs in those docs untouched unless only the link label or surrounding display text contains old branding.

### Runtime identifiers to preserve

Do not rename these in implementation code:

- `aioncore`, `aioncoreVersion`, backend binary paths, and resolver diagnostics that need exact binary naming.
- `aionrs` enum values, backend kind values, event prefixes, config keys, storage keys, path segments, test IDs, and platform directory names.
- `AION_CLI_*` environment variables and protocol fields.
- `@office-ai/aioncli-core` dependency name.
- `[[AION_FILES]]` compatibility marker.
- `iOfficeAI/AionUi`, `iOfficeAI/AionCore`, `aionui.com`, `static.aionui.com`, `service@aionui.com` URLs/domains.

---

### Task 1: Rename project-owned base component symbols

**Files:**
- Rename: `packages/desktop/src/renderer/components/base/AionModal.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorModal.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionSelect.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorSelect.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionCollapse.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorCollapse.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionScrollArea.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorScrollArea.tsx`
- Rename: `packages/desktop/src/renderer/components/base/AionSteps.tsx` -> `packages/desktop/src/renderer/components/base/ByteTensorSteps.tsx`
- Modify: `packages/desktop/src/renderer/components/base/index.ts`
- Modify call sites found by LSP references under `packages/desktop/src/renderer/` and `tests/`
- Test: `bunx tsc --noEmit`

- [ ] **Step 1: Confirm the branch and clean worktree before editing**

Run:

```bash
git branch --show-current && git rev-parse --short HEAD && git status --short
```

Expected:

```text
JackMax417/refactor/bytetensor-rebrand
<current-local-commit>
```

`git status --short` should be empty before implementation begins. If it is not empty, inspect the listed files and do not overwrite unrelated user changes.

- [ ] **Step 2: Use LSP references for each exported component symbol**

Run LSP references before renaming these symbols:

- `AionModal` in `packages/desktop/src/renderer/components/base/AionModal.tsx`
- `AionSelect` in `packages/desktop/src/renderer/components/base/AionSelect.tsx`
- `AionCollapse` in `packages/desktop/src/renderer/components/base/AionCollapse.tsx`
- `AionCollapseItem` in `packages/desktop/src/renderer/components/base/AionCollapse.tsx`
- `AionScrollArea` in `packages/desktop/src/renderer/components/base/AionScrollArea.tsx`
- `AionSteps` in `packages/desktop/src/renderer/components/base/AionSteps.tsx`

Expected: references include imports and JSX usages under `packages/desktop/src/renderer/`; no references outside source/tests should be manually edited without reading the surrounding context.

- [ ] **Step 3: Rename component files**

Use LSP `rename_file` where available so import paths update; otherwise use filesystem rename and then update imports with LSP diagnostics/code actions:

```text
packages/desktop/src/renderer/components/base/AionModal.tsx -> packages/desktop/src/renderer/components/base/ByteTensorModal.tsx
packages/desktop/src/renderer/components/base/AionSelect.tsx -> packages/desktop/src/renderer/components/base/ByteTensorSelect.tsx
packages/desktop/src/renderer/components/base/AionCollapse.tsx -> packages/desktop/src/renderer/components/base/ByteTensorCollapse.tsx
packages/desktop/src/renderer/components/base/AionScrollArea.tsx -> packages/desktop/src/renderer/components/base/ByteTensorScrollArea.tsx
packages/desktop/src/renderer/components/base/AionSteps.tsx -> packages/desktop/src/renderer/components/base/ByteTensorSteps.tsx
```

Expected: imports such as `@/renderer/components/base/AionModal` become `@/renderer/components/base/ByteTensorModal`.

- [ ] **Step 4: Rename exported types and component constants**

In the renamed component files, change symbol names only. Preserve each file's existing render logic, props handling, imports, CSS class usage, and exported constants except where the symbol itself contains `Aion`.

Apply this exact rename table:

```text
AionModalProps -> ByteTensorModalProps
AionModal -> ByteTensorModal
AionModal.displayName = 'AionModal' -> ByteTensorModal.displayName = 'ByteTensorModal'

AionSelectSize -> ByteTensorSelectSize
AionSelectProps -> ByteTensorSelectProps
AionSelectComponent -> ByteTensorSelectComponent
AionSelect -> ByteTensorSelect
AionSelect.displayName = 'AionSelect' -> ByteTensorSelect.displayName = 'ByteTensorSelect'

AionCollapseProps -> ByteTensorCollapseProps
AionCollapseItemProps -> ByteTensorCollapseItemProps
AionCollapseItem -> ByteTensorCollapseItem
AionCollapseItem.displayName = 'AionCollapseItem' -> ByteTensorCollapseItem.displayName = 'ByteTensorCollapseItem'
AionCollapseComponent -> ByteTensorCollapseComponent
AionCollapse -> ByteTensorCollapse
AionCollapse.displayName = 'AionCollapse' -> ByteTensorCollapse.displayName = 'ByteTensorCollapse'

AionScrollAreaProps -> ByteTensorScrollAreaProps
AionScrollArea -> ByteTensorScrollArea
AionScrollArea.displayName = 'AionScrollArea' -> ByteTensorScrollArea.displayName = 'ByteTensorScrollArea'

AionStepsProps -> ByteTensorStepsProps
AionSteps -> ByteTensorSteps
AionSteps.displayName = 'AionSteps' -> ByteTensorSteps.displayName = 'ByteTensorSteps'
```

Update JSDoc examples in those files so JSX examples use the new component names, for example:

```tsx
<ByteTensorModal visible={true} onCancel={handleClose} header="标题">
  内容
</ByteTensorModal>

<ByteTensorSelect placeholder="请选择" style={{ width: 200 }}>
  <ByteTensorSelect.Option value="1">选项1</ByteTensorSelect.Option>
</ByteTensorSelect>

<ByteTensorCollapse defaultActiveKey={['1']}>
  <ByteTensorCollapse.Item name="1" header="面板1">内容1</ByteTensorCollapse.Item>
</ByteTensorCollapse>

<ByteTensorScrollArea className="h-400px">
  <div>Content...</div>
</ByteTensorScrollArea>

<ByteTensorSteps current={1}>
  <ByteTensorSteps.Step title="步骤1" description="这是描述" />
</ByteTensorSteps>
```

Do not introduce compatibility aliases such as `export { ByteTensorModal as AionModal }`; missed consumers should be updated to the ByteTensor names.

- [ ] **Step 5: Update barrel exports**

Update `packages/desktop/src/renderer/components/base/index.ts` to export ByteTensor names:

```ts
export { default as ByteTensorModal } from './ByteTensorModal';
export { default as ByteTensorCollapse } from './ByteTensorCollapse';
export { default as ByteTensorSelect } from './ByteTensorSelect';
export { default as ByteTensorScrollArea } from './ByteTensorScrollArea';
export { default as ByteTensorSteps } from './ByteTensorSteps';

export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  ByteTensorModalProps,
} from './ByteTensorModal';
export { MODAL_SIZES } from './ByteTensorModal';

export type { ByteTensorCollapseProps, ByteTensorCollapseItemProps } from './ByteTensorCollapse';
export type { ByteTensorSelectProps } from './ByteTensorSelect';
export type { ByteTensorStepsProps } from './ByteTensorSteps';
```

If existing exports for `AionCollapse`, `AionScrollArea`, or `AionSteps` are consumed internally, update consumers to the ByteTensor names instead of keeping aliases.

- [ ] **Step 6: Rename `.aion-select` CSS class to `.bytetensor-select`**

Update `ByteTensorSelect.tsx`:

```ts
const BASE_CLASS = classNames(
  'bytetensor-select',
  '[&_.arco-select-view]:rounded-[4px]',
  '[&_.arco-select-view]:border',
  '[&_.arco-select-view]:border-solid',
  '[&_.arco-select-view]:border-[var(--border-base)]',
  '[&_.arco-select-view]:bg-[var(--fill-1)]',
  '[&_.arco-select-view]:text-t-primary',
  '[&_.arco-select-view:hover]:border-[var(--border-base)]',
  '[&_.arco-select-view-focus]:border-[var(--primary-6)]',
);
```

Update JSDoc references from `.aion-select` to `.bytetensor-select`.

Update E2E selectors:

```ts
// tests/e2e/features/settings/system/preferences.e2e.ts
const selectTrigger = page.locator('.bytetensor-select .arco-select-view').first();

// tests/e2e/features/settings/system/preferences-extra.e2e.ts
const selectTrigger = page.locator('.bytetensor-select .arco-select-view').first();

// tests/e2e/features/settings/system/system-persist.e2e.ts
const selectTrigger = page.locator('.bytetensor-select .arco-select-view').first();
const reloadedSelect = page.locator('.bytetensor-select .arco-select-view').first();
```

- [ ] **Step 7: Run TypeScript after component rename**

Run:

```bash
bunx tsc --noEmit
```

Expected: exit 0. If errors mention old `Aion*` component imports or exported types, update those call sites to ByteTensor names and rerun.

- [ ] **Step 8: Commit component rename**

Run:

```bash
git add packages/desktop/src/renderer/components/base packages/desktop/src/renderer tests/e2e/features/settings/system

git commit -m "refactor(renderer): rename branded base components"
```

Expected: local commit succeeds. Do not push.

---

### Task 2: Update runtime UI display text while preserving internal identifiers

**Files:**
- Modify locale JSON listed in File Structure Map
- Modify: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/DingTalkConfigForm.tsx`
- Modify: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/LarkConfigForm.tsx`
- Modify: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/TelegramConfigForm.tsx`
- Modify: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/WecomConfigForm.tsx`
- Modify: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels/WeixinConfigForm.tsx`
- Modify: `packages/desktop/src/renderer/pages/conversation/utils/createConversationParams.ts`
- Modify: `packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts`
- Modify: `packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx`
- Generated: `packages/desktop/src/renderer/services/i18n/i18n-keys.d.ts` only if regenerated output changes
- Test: `bun run i18n:types`, `node scripts/check-i18n.js`, `bunx tsc --noEmit`

- [ ] **Step 1: Update locale visible strings**

Apply these value-only replacements in every locale JSON listed in the File Structure Map:

```text
AionCore -> ByteTensor Core
Aion CLI -> ByteTensor CLI
Aionrs -> ByteTensor CLI
aionrs -> ByteTensor CLI when it appears inside translated display text, not in JSON keys
```

Do not rename JSON keys such as `aionrsModelRequired` or `aionrsNoProvider`; those are runtime/i18n contract keys and must remain stable.

Examples of expected English results:

```json
{
  "description": "ByteTensor opened, but the local ByteTensor Core backend cannot run on this Linux version. Please upgrade to a supported Linux distribution and restart ByteTensor."
}
```

```json
{
  "aionrsModelRequired": "Please select a model for ByteTensor CLI"
}
```

```json
{
  "customModelSupportNote": "Note: Only ByteTensor CLI currently supports custom models."
}
```

```json
{
  "localAgentsDescription": "ByteTensor CLI is the built-in agent and ships with the app — no install needed. Other agents are detected only after their CLI is installed locally."
}
```

Translate only the product/tool tokens in non-English strings; keep each sentence otherwise unchanged.

- [ ] **Step 2: Update channel fallback display names**

In each channel config form, change only the fallback display name from `Aion CLI` to `ByteTensor CLI`, preserving `agent_type: 'aionrs'`:

```ts
const agentOptions: Array<{
  agent_type: string;
  backend?: string;
  name?: string;
  id?: string;
}> = availableAgents.length > 0 ? availableAgents : [{ agent_type: 'aionrs', name: 'ByteTensor CLI' }];
```

Apply this exact display-name change in:

- `DingTalkConfigForm.tsx`
- `LarkConfigForm.tsx`
- `TelegramConfigForm.tsx`
- `WecomConfigForm.tsx`
- `WeixinConfigForm.tsx`

Do not change `agent_type`, `backend`, model selector conditions, or saved config keys.

- [ ] **Step 3: Update visible error/log text**

Update `packages/desktop/src/renderer/pages/conversation/utils/createConversationParams.ts`:

```ts
throw new Error('No enabled model provider for ByteTensor CLI');
```

Update `packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts`:

```ts
console.error('Failed to create ByteTensor CLI conversation:', error);
```

Update the comment in `packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx`:

```ts
// ByteTensor CLI first among detected agents
```

Do not change the `aionrs` lookup logic:

```ts
const aionrsAgent = detectedAgents?.find((a) => a.agent_type === 'aionrs' || a.backend === 'aionrs');
const otherDetected = detectedAgents?.filter((a) => a.agent_type !== 'aionrs' && a.backend !== 'aionrs') ?? [];
```

- [ ] **Step 4: Regenerate and validate i18n**

Run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

Expected: both exit 0. Existing missing-key warnings may remain if the command exits 0; do not hide or suppress them.

- [ ] **Step 5: Run TypeScript after display text changes**

Run:

```bash
bunx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Commit runtime display text changes**

Run:

```bash
git add packages/desktop/src/renderer/services/i18n packages/desktop/src/renderer/components/settings/SettingsModal/contents/channels packages/desktop/src/renderer/pages/conversation/utils/createConversationParams.ts packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx

git commit -m "refactor(rebrand): update ByteTensor CLI display text"
```

Expected: local commit succeeds. Do not push.

---

### Task 3: Update docs and PRD display wording

**Files:**
- Modify: `readme.md`
- Modify: `docs/readme/readme_ch.md`
- Modify: `docs/readme/readme_es.md`
- Modify: `docs/readme/readme_jp.md`
- Modify: `docs/readme/readme_ko.md`
- Modify: `docs/readme/readme_pt.md`
- Modify: `docs/readme/readme_ru.md`
- Modify: `docs/readme/readme_tr.md`
- Modify: `docs/readme/readme_tw.md`
- Modify: `docs/readme/readme_uk.md`
- Modify: `docs/contributing/file-structure.md`
- Modify: `docs/prds/conversations/custom/custom-agent.md`
- Modify: `docs/prds/conversations/remote/remote-agent.md`
- Modify: `docs/prds/remote/channels/channels.md`
- Test: final search classification

- [ ] **Step 1: Update README backend/tool display names**

In root and localized READMEs, update display text with these rules:

```text
Aion CLI (aionrs, the Rust-based backend service shipped with ByteTensor) -> ByteTensor CLI (the Rust-based backend service shipped with ByteTensor)
Aion CLI（aionrs，ByteTensor 随附的 Rust 后端服务） -> ByteTensor CLI（ByteTensor 随附的 Rust 后端服务）
Aion CLI(aionrs, ... ByteTensor ...) -> ByteTensor CLI (... ByteTensor ...)
Aionrs -> ByteTensor CLI
Aion UI is Insane -> ByteTensor is Insane
Hermes + Aion UI is Insane -> Hermes + ByteTensor is Insane
OpenClaw + Aion UI is Insane -> OpenClaw + ByteTensor is Insane
via Aion CLI (aionrs) -> via ByteTensor CLI
通过 Aion CLI（aionrs） -> 通过 ByteTensor CLI
```

Do not change URLs under `https://github.com/iOfficeAI/AionUi/...` or `https://www.aionui.com`.

- [ ] **Step 2: Update docs/contributing/file-structure.md**

Change old project-owned component examples:

```md
├── base/           # UI primitives — ByteTensorModal, ByteTensorSelect, FlexFullContainer, etc.
```

- [ ] **Step 3: Update PRD display wording**

In `docs/prds/conversations/custom/custom-agent.md`, change visible product/tool names while preserving code literals:

```md
5. 卡片排列顺序：ByteTensor CLI 置顶 → Gemini CLI 次之 → 其他按检测顺序排列。若 ByteTensor CLI / Gemini CLI 未检测到，对应位置跳过，其他 Agent 紧邻排列
6. ByteTensor CLI 和 Gemini CLI 的"设置"按钮可用，点击分别跳转 `/settings/aionrs` 和 `/settings/gemini`
```

```md
- [ ] ByteTensor CLI 和 Gemini CLI 排列在前，"设置"按钮可用
```

Keep code literals such as `` `aionrs` `` unchanged in technical classification paragraphs, but rewrite the explanatory phrase to make it clear that `aionrs` is the internal identifier for ByteTensor CLI:

```md
- 执行引擎层分类（`DetectedAgentKind`，`detectedAgent.ts:27`）：`gemini`、`acp`、`remote`、`aionrs`、`openclaw-gateway`、`nanobot`。其中 `aionrs` 是 ByteTensor CLI 的内部执行引擎标识；DetectedAgentKind 与 ACP 协议层分类 `AcpBackendAll`（18 种 ACP 后端）是不同维度——DetectedAgentKind 区分执行引擎/通信协议，AcpBackendAll 区分具体 ACP CLI 产品
```

In `docs/prds/conversations/remote/remote-agent.md`, replace component references in prose:

```md
弹出"添加远程 Agent"弹窗（ByteTensorModal + 遮罩层）
弹出"编辑远程 Agent"弹窗（ByteTensorModal）
RemoteAgentFormModal (ByteTensorModal)
创建/编辑使用 ByteTensorModal 封装，删除确认使用 Arco 原生 Modal.confirm
```

In `docs/prds/remote/channels/channels.md`, preserve code literal `` `'aionrs'` `` but update display prose:

```md
**前置条件**：当前 Agent 为 Gemini 兼容类型（`backend === 'gemini'` 或内部 ByteTensor CLI 标识 `'aionrs'`）
```

```md
- Agent 为 Gemini/ByteTensor CLI 类型：正常显示模型选择器
```

- [ ] **Step 4: Update test comments and local captions**

Update old component-name comments in E2E files without changing behavior:

```ts
// tests/e2e/cases/teams/team-create.e2e.ts
// Verify the leader ByteTensorSelect trigger exists (agent picker is a searchable dropdown)
// Open the leader select dropdown (ByteTensorSelect portals to document.body)
```

```ts
// tests/e2e/cases/teams/team-whitelist.e2e.ts
// Open the leader ByteTensorSelect dropdown (options portal to document.body)
```

```ts
// tests/e2e/specs/feedback-scenarios.e2e.ts
// button class — scoped to avoid matching the Agent editor's ByteTensorModal
/** Close any open ByteTensorModal (e.g. the Agent editor) so the next test starts clean. */
// Defensive: close any ByteTensorModal left over from a prior test so the
```

- [ ] **Step 5: Commit docs display changes**

Run:

```bash
git add readme.md docs/readme docs/contributing/file-structure.md docs/prds tests/e2e

git commit -m "docs(rebrand): update ByteTensor display wording"
```

Expected: local commit succeeds. Do not push.

---

### Task 4: Classify remaining Aion references and adjust ambiguous survivors

**Files:**
- Read-only search across `packages/desktop/src`, `tests`, `docs`, `readme.md`, `CHANGELOG.md`, `package.json`
- Modify only files with ambiguous display-layer survivors found by this task
- Test: search output classification

- [ ] **Step 1: Search remaining exact display-brand patterns**

Run searches with built-in search tool or equivalent exact repo search, excluding `node_modules`, binary assets, ignored build outputs, and `resources/bundled-aioncore`:

```text
Aion UI
AionUi
Aion CLI
AionCore
aionrs
\bAion\b
aion-select
AionModal
AionSelect
AionCollapse
AionScrollArea
AionSteps
```

Expected: no remaining `Aion*` component symbols, no `.aion-select`, no user-facing `Aion CLI`, no user-facing `AionCore`, and no user-facing standalone `aionrs` outside internal-identifier explanations.

- [ ] **Step 2: Classify allowed runtime/external survivors**

Allowed survivors include:

```text
aioncore
aioncoreVersion
@office-ai/aioncli-core
AION_CLI_*
[[AION_FILES]]
iOfficeAI/AionUi
iOfficeAI/AionCore
aionui.com
static.aionui.com
service@aionui.com
'aionrs'
"aionrs"
aionrs.config
aionrs.defaultModel
aionrs.selected.file
aionrs.workspace.refresh
data-testid values containing aionrs
packages/desktop/src/renderer/pages/conversation/platforms/aionrs/*
```

If a survivor is visible prose, rewrite it to ByteTensor wording. If a survivor is code/config/runtime identity, leave it.

- [ ] **Step 3: Fix ambiguous survivors**

Use this decision table:

```text
Survivor is in string shown to user -> change to ByteTensor CLI/Core
Survivor is in console.error text shown only in developer logs but not an exact backend contract -> change to ByteTensor CLI/Core
Survivor is in URL -> preserve
Survivor is in dependency/package/binary/path/import/enum/config key/event/test id -> preserve
Survivor is in PRD prose explaining internal identifiers -> keep code literal and add ByteTensor explanation
Survivor is in third-party video title alt/caption -> rewrite local alt/caption to ByteTensor wording, preserve URL
```

- [ ] **Step 4: Commit survivor cleanup if files changed**

If Step 3 changed files, run:

```bash
git add packages/desktop/src tests docs readme.md CHANGELOG.md package.json

git commit -m "refactor(rebrand): classify remaining aion references"
```

Expected: local commit succeeds if changes exist. If no changes exist, do not create an empty commit.

---

### Task 5: Verification and local checkpoint

**Files:**
- Read-only verification, except generated i18n type file if `bun run i18n:types` updates it
- Test: specific verification commands below

- [ ] **Step 1: Run format**

Run:

```bash
bun run format
bun run format:check
```

Expected: `format:check` exits 0 and reports all matched files use the correct format.

- [ ] **Step 2: Run i18n validation**

Run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

Expected: both exit 0. Existing missing-key warnings may remain if exit code is 0.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
bunx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
bun run test -- tests/unit/bootstrap/binaryResolver.test.ts tests/unit/messageFiles.test.ts tests/unit/updateBridgeCdnRewrite.test.ts tests/unit/web-cli/browser.test.ts tests/unit/web-cli/ensureAdminPassword.test.ts tests/unit/feedback/FeedbackReportModal.dom.test.tsx tests/unit/feedback/MessageTipsFeedback.dom.test.tsx tests/unit/settings/SystemSettings.dom.test.tsx tests/unit/renderer/buildSendFailureError.test.ts tests/unit/renderer/normalizeDbMessage.test.ts
```

Expected: exit 0. If a listed test path is not present in this checkout, use `find` to locate the nearest existing test for the same component/behavior and rerun the adjusted targeted suite.

- [ ] **Step 5: Run final remaining-reference search**

Run searches for:

```text
Aion UI
AionUi
Aion CLI
AionCore
aionrs
\bAion\b
aion-select
AionModal
AionSelect
AionCollapse
AionScrollArea
AionSteps
```

Expected:

- no project-owned `Aion*` component names remain;
- no `.aion-select` remains;
- remaining `aionrs` entries are runtime/internal identifiers or explicitly documented internal identifier explanations;
- remaining `AionCore` entries are upstream/backend exact identifiers or URLs, not normal display copy;
- remaining `iOfficeAI/AionUi` and `aionui.com` entries are preserved external URLs/domains.

- [ ] **Step 6: Run local launch smoke**

Ensure backend resources exist if this machine has not prepared them:

```bash
node scripts/prepareAioncore.js
```

Then run a launch smoke with updates disabled:

```bash
BYTETENSOR_DISABLE_AUTO_UPDATE=1 bun start
```

Expected: main/preload/renderer build completes, Electron window loads, and backend health reaches ready. Stop the dev process after startup is verified.

- [ ] **Step 7: Create final local commit if verification changed generated files**

If verification generated or formatted files after the last commit, run:

```bash
git add -A

git commit -m "chore(rebrand): finalize ByteTensor display cleanup"
```

If there are no changes, do not create an empty commit.

- [ ] **Step 8: Confirm final local state without remote operations**

Run:

```bash
git branch --show-current && git rev-parse --short HEAD && git status --short
```

Expected: current branch is `JackMax417/refactor/bytetensor-rebrand`, `git status --short` is empty, and no `git push`, PR creation, tag, release, or GitHub mutation has been performed.
