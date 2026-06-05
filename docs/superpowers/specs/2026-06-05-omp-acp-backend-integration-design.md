# OMP ACP Backend Integration Design

## Decision

Add OMP as a ByteTensor-called ACP backend. ByteTensor will detect a local OMP command, list it as a selectable agent, and use the existing ACP conversation flow to communicate with it.

This spec covers only the direction **ByteTensor calls OMP**. It does not make ByteTensor expose an ACP server for OMP to call.

## Goals

- Add OMP to the built-in ACP agent catalog.
- Show OMP in existing Agent settings and agent selectors when detected.
- Start OMP through the existing ACP process client and JSON-RPC flow.
- Preserve existing ACP behavior for all other agents.
- Keep the implementation local-only; do not push, create PRs, tags, releases, or perform GitHub mutations.

## Non-goals

- Building a bidirectional ACP bridge.
- Exposing ByteTensor as an ACP server.
- Adding OMP-specific conversation UI.
- Replacing or changing ByteTensor CLI / `aionrs` behavior.
- Implementing an OMP protocol shim in this pass.
- Adding OMP artwork or visual assets unless a valid OMP logo is provided later.

## Integration Boundary

OMP is modeled as a normal ACP backend in the existing agent architecture.

Proposed metadata:

```ts
{
  backend: 'omp',
  name: 'OMP',
  agent_type: 'acp',
  agent_source: 'builtin',
  command: 'omp',
  args: [],
}
```

The default command is `omp`. If later research shows the real command or ACP startup arguments differ, the implementation plan should update this metadata before coding. A likely future shape is `command: 'omp'` with explicit ACP mode args such as `['--acp']`, but this design does not assume those args without evidence.

## Architecture

### Backend detection layer

The existing AgentRegistry / ACP backend catalog should gain one built-in entry for OMP. Detection follows the same path as other CLI-backed ACP agents:

1. Resolve the configured spawn command on `PATH`.
2. Mark OMP available when the command resolves.
3. Mark OMP unavailable when the command is missing, with a diagnostic reason.
4. Preserve all other agent detection behavior.

No renderer-side hardcoding should be needed beyond normal icon/name fallback behavior.

### ACP startup layer

OMP conversations should reuse the existing ACP platform flow:

1. User selects OMP.
2. ByteTensor launches the configured OMP command through the existing process ACP client.
3. ByteTensor sends ACP `initialize`.
4. ByteTensor creates a session with `session/new`.
5. ByteTensor sends prompts with `session/prompt`.
6. Streaming chunks, permissions, tool calls, errors, and session lifecycle use existing ACP handling.

No new IPC bridge or dedicated OMP platform should be introduced.

### Renderer layer

Renderer components should consume OMP from existing agent APIs:

- Agent Settings local-agent list.
- Guide/chat agent selector.
- Team agent selector.
- Scheduled task agent selector.
- Channel agent selector if ACP backends are available there.

Display name is `OMP`. Icon uses the existing generic agent fallback unless a first-class OMP logo is provided.

### Configuration layer

OMP should initially have no special persisted settings beyond the normal backend key and existing ACP metadata. If OMP needs launch arguments, they belong in the backend catalog metadata, not in renderer-specific conditionals.

## Data Flow

```text
AgentRegistry catalog
  -> detect command `omp`
  -> /api/agents metadata row `{ backend: 'omp', name: 'OMP', agent_type: 'acp' }`
  -> renderer fetchDetectedAgents/useAgents
  -> existing selectors show OMP
  -> user starts conversation
  -> existing ACP conversation params use backend `omp`
  -> ProcessAcpClient spawns OMP command
  -> ACP initialize/session/new/session/prompt
```

## Error Handling

- Missing OMP command: mark unavailable; do not fail application startup.
- OMP command exists but ACP initialize fails: use the existing ACP initialization failure path.
- OMP starts but does not return expected model/capability data: use existing ACP fallback behavior for missing handshake fields.
- OMP is not actually ACP-compatible: do not force integration with hacks in this pass; design a separate `omp-acp-shim` if needed.

## Testing

### Unit tests

- Built-in agent catalog includes OMP metadata.
- Missing `omp` command marks OMP unavailable without affecting other agents.
- Available `omp` command marks OMP available.
- Agent metadata maps to renderer display name `OMP` and backend key `omp`.

### Integration tests

- Use `tests/fixtures/fake-acp-cli` as an OMP stand-in.
- Verify ACP handshake flow: `initialize`, `session/new`, `session/prompt`.
- Verify process cleanup after the session.

### Renderer tests

- Agent settings can render an OMP card from detected agent metadata.
- Agent selector can include/select OMP and persist backend key `omp`.
- Existing ByteTensor CLI / `aionrs` display normalization is unaffected.

### Smoke

- `bun start` still launches when OMP is not installed.
- No fatal startup error occurs due to missing OMP.

## Acceptance Criteria

- OMP is part of the built-in ACP backend catalog.
- OMP appears in existing agent UI when detected.
- OMP uses existing ACP conversation lifecycle; no OMP-specific chat platform is added.
- Missing OMP does not break startup or other agent detection.
- Existing agents continue to behave as before.
- Verification covers catalog detection, ACP fixture flow, renderer display/selection, typecheck, targeted tests, and launch smoke.
- No remote GitHub operation is performed.
