# ByteTensorCore Runtime Artifact Rename Design

## Goal
Rename runtime-visible Aion/AionCore artifacts to ByteTensor/ByteTensorCore while preserving internal Rust crate/import compatibility and upstream dependency compatibility.

## Scope

### In scope
- AionCore binary name becomes `bytetensorcore` / `bytetensorcore.exe`.
- CLI help/about/version display uses `ByteTensorCore`.
- Server listening marker becomes `BYTETENSORCORE_LISTENING`, with AionUi temporarily accepting legacy `AIONCORE_LISTENING`.
- Backend database path becomes `bytetensor-backend.db`.
- Existing `aionui-backend.db` is copied to `bytetensor-backend.db` when the new database does not exist.
- Backend rolling log suffix becomes `.bytetensorcore.log`.
- AionUi bundled resource path becomes `resources/bundled-bytetensorcore/{platform}-{arch}/bytetensorcore[.exe]`.
- AionUi launcher logs/errors use `[ByteTensorCore]` and `ByteTensorCore`.
- Packaging/build scripts prepare/copy ByteTensorCore-named local artifacts, while still supporting upstream AionCore release asset downloads.
- Feedback log collection includes `.bytetensorcore.log` and keeps `.aioncore.log` compatibility.

### Out of scope
- Renaming Rust crate/package directories such as `crates/aionui-db`.
- Renaming Rust imports such as `aionui_db`.
- Renaming upstream `aionrs` crates/protocol identifiers.
- Modifying previously-applied migration files.
- Remote GitHub operations.

## Architecture
Keep compile-time/internal crate identities stable. Add runtime-facing constants and paths that use ByteTensorCore names. The AionUi launcher resolves the new bundled layout first and falls back to the legacy bundled layout to avoid breaking local checkouts during the transition.

## Compatibility
- Database migration: new database file name is `bytetensor-backend.db`; if absent, copy `aionui-backend.db`; if that is absent, existing legacy copy from `aionui.db` remains available.
- Listener marker: Core emits `BYTETENSORCORE_LISTENING`; launcher accepts both new and legacy markers.
- Bundled binary: resolver prefers `bundled-bytetensorcore/bytetensorcore.exe`; fallback remains `bundled-aioncore/aioncore.exe`.
- Logs: feedback collector includes new and old log suffixes.

## Verification
- AionCore targeted tests for CLI display, database copy behavior, log suffix, listener marker, and OMP metadata.
- AionUi targeted tests for binary resolver, backend launcher marker parsing/logging, startup failure diagnostics, and feedback log collection.
- Release build `cargo build --release -p aionui-app` produces `bytetensorcore.exe`.
- Copy built binary to AionUi bundled ByteTensorCore resource path.
- Start ByteTensor with the renamed binary and confirm `/api/agents` returns OMP with `args: ["acp"]`.
