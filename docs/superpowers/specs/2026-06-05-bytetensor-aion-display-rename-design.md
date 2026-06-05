# ByteTensor Display-Layer Aion Rename Design

## Decision

Continue the ByteTensor rebrand by removing remaining project-owned and user-visible `Aion`/`aion` branding, while preserving runtime identifiers that are required for the app to start and for bundled backend/tool integrations to resolve correctly.

The approved boundary is: **display layer is aggressive; runtime layer is conservative**.

## Goals

- Make user-facing copy consistently present the product and bundled tools as ByteTensor.
- Rename project-owned symbols that still carry old app branding, such as `AionModal` or `AionSelect`, when they are not external/runtime protocol names.
- Keep core behavior unchanged: no backend replacement, no dependency rename, no data migration, no protocol rewiring beyond already completed app-brand changes.
- Preserve local-only workflow: no `push`, pull request, tag, release, or GitHub mutation.

## Non-goals

- Replacing the actual backend binary or upstream package names.
- Renaming dependencies published by third parties or upstream projects.
- Reworking application features, IPC behavior, database schema, agent runtime behavior, model provider behavior, or update logic.
- Creating replacement artwork or editing binary asset contents.
- Introducing compatibility aliases or migration from old AionUi data/config.

## Rename Scope

### User-visible and project-owned names to change

These references should become ByteTensor terminology:

- `Aion UI`, `AionUi`, and app-brand uses of `Aion` -> `ByteTensor`.
- User-facing `Aion CLI` -> `ByteTensor CLI`.
- User-facing `AionCore` -> `ByteTensor Core`.
- User-facing `aionrs` -> `ByteTensor CLI`, except where the text is explicitly documenting the internal backend identifier.
- Project-owned component names such as `AionModal` and `AionSelect` -> `ByteTensorModal` and `ByteTensorSelect`.
- Local alt text, captions, and doc descriptions that use third-party titles only to describe the app brand may be rewritten to ByteTensor wording, while preserving the external URL.

### Runtime and external identifiers to preserve

These references must remain unless a separate backend/dependency migration is designed:

- `aioncore` binary names, paths, release artifact names, and backend resolver logic.
- `aioncoreVersion`.
- `AionCore` when it is part of an upstream repository URL, package/release identity, diagnostic label, or exact backend implementation name.
- `aionrs` when it is an enum value, backend kind, adapter identifier, path segment, diagnostic detail, or implementation contract.
- `Aion CLI` when it is part of an exact upstream package/protocol identifier rather than display copy.
- `AION_CLI_*` environment variables and protocol fields.
- `@office-ai/aioncli-core` and other upstream package names.
- `[[AION_FILES]]` compatibility marker.
- `iOfficeAI/AionUi`, `iOfficeAI/AionCore`, `aionui.com`, `static.aionui.com`, and `service@aionui.com` until replacement ByteTensor endpoints exist.

## Architecture Impact

No runtime architecture changes are intended. The app remains the same Electron/Vite/React/Bun application with the same process split:

- main process stays under `packages/desktop/src/process/` and keeps backend startup behavior unchanged;
- preload bridge stays under `packages/desktop/src/preload/`;
- renderer stays under `packages/desktop/src/renderer/`;
- WebUI/web-host behavior remains unchanged except for display copy and already-renamed app-owned identifiers.

Project-owned symbol renames must use LSP reference discovery before editing exported symbols, so call sites are updated atomically and shadowed identifiers are not accidentally touched.

## Data Flow and Behavior

The rename does not change data flow:

- backend binary resolution still locates and launches the existing `aioncore` binary;
- agent/backend selection still uses the existing internal backend identifiers;
- IPC channels, database records, and settings keys are changed only if they are project-owned app-brand names and already part of the ByteTensor rebrand surface;
- compatibility marker parsing still recognizes `[[AION_FILES]]` exactly.

Old app-brand display names should not appear in normal UI or docs after implementation, but internal diagnostics may still show exact backend names when that precision is required for debugging.

## Error Handling

No new error paths are introduced. The main risk is over-renaming implementation identifiers that are required by dependencies, backend binaries, or environment contracts. The implementation must therefore classify every remaining `aion` match before changing it:

1. If it is display copy or project-owned branding, rename it.
2. If it is an exact runtime/dependency/backend identifier, preserve it.
3. If it is an upstream URL or old domain with no ByteTensor replacement, preserve it.
4. If it is ambiguous, inspect its call sites or surrounding docs before editing.

## Testing and Verification

Required verification after implementation:

1. Search remaining `aion`, `Aion`, `AionUi`, and `Aion UI` references and classify all survivors.
2. Run i18n generation and validation:
   ```bash
   bun run i18n:types
   node scripts/check-i18n.js
   ```
3. Run TypeScript validation:
   ```bash
   bunx tsc --noEmit
   ```
4. Run targeted tests for changed symbols/docs-adjacent code paths, including component rename tests if affected, backend resolver tests, update CDN tests, Web CLI tests, and marker parsing tests.
5. Run `bun start` smoke to verify main/preload/renderer build and backend startup still succeed.

## Acceptance Criteria

- User-visible docs and UI no longer present old app/tool branding as `Aion`, `Aion UI`, `AionUi`, `Aion CLI`, `AionCore`, or `aionrs`; they use `ByteTensor`, `ByteTensor CLI`, or `ByteTensor Core` as appropriate.
- Project-owned old-brand component names are renamed or explicitly justified if left unchanged.
- Runtime identifiers required for startup and backend integration remain intact.
- Remaining `aion` references are intentional and classified as runtime identifiers, upstream links, old-domain links, compatibility markers, or exact third-party identifiers.
- Existing core behavior remains unchanged and the app still launches locally.
- No remote GitHub operation is performed.
