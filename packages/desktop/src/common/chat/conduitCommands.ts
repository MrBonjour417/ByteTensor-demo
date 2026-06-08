/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export const CONDUIT_COMMAND_PREFIX = '/conduit';

export type ConduitReplayStage = 'plan' | 'patch' | 'verify' | 'summary';

export type ParsedConduitCommand =
  | { kind: 'none' }
  | { kind: 'enter'; requirement?: string }
  | { kind: 'run' }
  | { kind: 'status' }
  | { kind: 'revise' }
  | { kind: 'exit' }
  | { kind: 'help' }
  | { kind: 'replay'; stage: ConduitReplayStage }
  | { kind: 'unknown'; command: string };

type ConduitLifecycleCommand = 'run' | 'status' | 'revise' | 'exit' | 'help';

const REPLAY_STAGES = new Set<ConduitReplayStage>(['plan', 'patch', 'verify', 'summary']);
const LIFECYCLE_COMMANDS = new Set<ConduitLifecycleCommand>(['run', 'status', 'revise', 'exit', 'help']);

function isConduitLifecycleCommand(value: string): value is ConduitLifecycleCommand {
  return LIFECYCLE_COMMANDS.has(value as ConduitLifecycleCommand);
}

function isConduitReplayStage(value: string): value is ConduitReplayStage {
  return REPLAY_STAGES.has(value as ConduitReplayStage);
}


export function parseConduitCommand(input: string): ParsedConduitCommand {
  const trimmed = input.trim();
  if (trimmed !== CONDUIT_COMMAND_PREFIX && !trimmed.startsWith(`${CONDUIT_COMMAND_PREFIX} `)) {
    return { kind: 'none' };
  }

  const tail = trimmed.slice(CONDUIT_COMMAND_PREFIX.length).trim();
  if (!tail) return { kind: 'enter' };

  const [first, ...rest] = tail.split(/\s+/);
  if (isConduitLifecycleCommand(first)) {
    return rest.length === 0 ? { kind: first } : { kind: 'unknown', command: tail };
  }

  if (first === 'replay') {
    const stage = rest[0];
    if (rest.length === 1 && stage && isConduitReplayStage(stage)) {
      return { kind: 'replay', stage };
    }
    return { kind: 'unknown', command: tail };
  }

  if (first.startsWith('-')) {
    return { kind: 'unknown', command: tail };
  }

  return { kind: 'enter', requirement: tail };
}

export function isConduitCommand(input: string): boolean {
  return parseConduitCommand(input).kind !== 'none';
}
