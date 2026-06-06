# ByteTensorCore Runtime Artifact Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename runtime-visible AionCore artifacts to ByteTensorCore while preserving internal Rust crate compatibility.

**Architecture:** AionCore changes the runtime artifact names it emits and persists. AionUi resolves and packages the new ByteTensorCore bundle first, with legacy fallback for local transition safety. Rust crate/import names remain unchanged.

**Tech Stack:** Rust 1.95, SQLx SQLite migrations, Node/Bun/Electron, Vitest.

---

### Task 1: AionCore runtime-visible names

**Files:**
- Modify: `D:/OmpProject/AionCore/crates/aionui-app/Cargo.toml`
- Modify: `D:/OmpProject/AionCore/crates/aionui-app/src/cli.rs`
- Modify: `D:/OmpProject/AionCore/crates/aionui-app/src/commands/server.rs`
- Modify: `D:/OmpProject/AionCore/crates/aionui-app/src/commands/doctor.rs`
- Modify: `D:/OmpProject/AionCore/crates/aionui-app/src/bootstrap/tracing_init.rs`
- Modify: `D:/OmpProject/AionCore/crates/aionui-app/src/config.rs`
- Modify: `D:/OmpProject/AionCore/crates/aionui-db/src/database.rs`
- Modify: `D:/OmpProject/AionCore/crates/aionui-db/tests/db_lifecycle.rs`

- [ ] Write failing Rust tests expecting `bytetensorcore`, `BYTETENSORCORE_LISTENING`, `bytetensor-backend.db`, and `.bytetensorcore.log`.
- [ ] Run targeted tests and confirm expected failures.
- [ ] Rename the binary target to `bytetensorcore`.
- [ ] Change CLI display/about/doctor text to ByteTensorCore.
- [ ] Change server listening event to `BYTETENSORCORE_LISTENING`.
- [ ] Change database path to `bytetensor-backend.db` and make legacy copy search `aionui-backend.db` before `aionui.db`.
- [ ] Change backend rolling log suffix to `bytetensorcore.log`.
- [ ] Run `cargo fmt --check`, targeted tests, and `cargo build --release -p aionui-app`.

### Task 2: AionUi launcher and resource names

**Files:**
- Modify: `packages/desktop/src/process/backend/binaryResolver.ts`
- Modify: `packages/desktop/src/process/backend/binaryResolver.test.ts`
- Modify: `packages/web-host/src/backend-launcher.ts`
- Modify: `packages/web-host/src/backend-launcher.test.ts`
- Modify: `packages/desktop/src/process/startup/backendInstallDiagnostics.ts`
- Modify: `packages/desktop/src/process/startup/backendStartupFailure.ts`
- Modify: `packages/desktop/src/process/startup/backendStartup.ts`
- Modify: `packages/desktop/src/process/utils/configureConsoleLog.ts`
- Modify: `packages/desktop/src/process/feedback/logs.ts`
- Modify: `packages/desktop/electron-builder.yml`

- [ ] Write failing Vitest expectations for ByteTensorCore bundled path, binary name, log prefix, and marker parsing.
- [ ] Run targeted Vitest tests and confirm expected failures.
- [ ] Update resolver to prefer `bundled-bytetensorcore/{platform}-{arch}/bytetensorcore[.exe]` with legacy fallback.
- [ ] Update launcher to log `[ByteTensorCore]`, parse `BYTETENSORCORE_LISTENING`, and accept `AIONCORE_LISTENING` as fallback.
- [ ] Update startup diagnostics/failure messages to ByteTensorCore and new resource paths.
- [ ] Update feedback logs to include `.bytetensorcore.log`.
- [ ] Run targeted Vitest tests.

### Task 3: Packaging scripts and local binary copy

**Files:**
- Modify: `packages/shared-scripts/src/prepare-aioncore.js`
- Modify: `packages/shared-scripts/package.json`
- Modify: `scripts/prepareAioncore.js`
- Modify: `scripts/build-with-builder.js`
- Modify: `scripts/pack-web-cli.js`
- Modify: `scripts/afterPack.js`
- Modify: `packages/web-cli/src/index.ts`
- Modify: `.gitignore`

- [ ] Write/update script tests where present for ByteTensorCore output paths.
- [ ] Keep upstream AionCore release download compatibility; rename extracted/downloaded binary only at local bundle output.
- [ ] Add `resources/bundled-bytetensorcore` to `.gitignore`.
- [ ] Copy `D:/OmpProject/AionCore/target/release/bytetensorcore.exe` to `D:/OmpProject/AionUi/resources/bundled-bytetensorcore/win32-x64/bytetensorcore.exe`.
- [ ] Keep existing `resources/bundled-aioncore` ignored as fallback only.

### Task 4: End-to-end verification

**Files:**
- No source changes expected beyond Tasks 1-3.

- [ ] Run AionCore targeted tests: DB lifecycle, CLI/server tests, OMP registry tests.
- [ ] Run AionUi targeted tests: binary resolver, backend launcher, startup failure, feedback logs, OMP routing contracts.
- [ ] Run `bun run format:check` and `bunx tsc --noEmit`.
- [ ] Start `bun start` and confirm the terminal shows `[ByteTensorCore]` and `bytetensorcore.exe` rather than `[aioncore]` and `aioncore.exe`.
- [ ] Query `/api/agents` and confirm OMP remains available with `args: ["acp"]`.
- [ ] Commit local AionCore and AionUi changes; do not push.
