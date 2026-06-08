/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { isConduitCommand, parseConduitCommand } from '@/common/chat/conduitCommands';

describe('parseConduitCommand', () => {
  it('ignores normal chat text and non-Conduit command prefixes', () => {
    expect(parseConduitCommand('hello conduit')).toEqual({ kind: 'none' });
    expect(parseConduitCommand('/conduits')).toEqual({ kind: 'none' });
    expect(parseConduitCommand('/conduitish')).toEqual({ kind: 'none' });
  });

  it('parses bare Conduit commands as entering Conduit mode', () => {
    expect(parseConduitCommand('/conduit')).toEqual({ kind: 'enter' });
    expect(parseConduitCommand('  /conduit  ')).toEqual({ kind: 'enter' });
  });

  it('parses inline Conduit requirements with trimmed requirement text', () => {
    expect(parseConduitCommand('/conduit  文章详情页展示字数和预计阅读时间  ')).toEqual({
      kind: 'enter',
      requirement: '文章详情页展示字数和预计阅读时间',
    });
  });

  it('accepts single-word requirements after the Conduit prefix', () => {
    expect(parseConduitCommand('/conduit login')).toEqual({ kind: 'enter', requirement: 'login' });
  });

  it('parses lifecycle commands', () => {
    expect(parseConduitCommand('/conduit run')).toEqual({ kind: 'run' });
    expect(parseConduitCommand('/conduit status')).toEqual({ kind: 'status' });
    expect(parseConduitCommand('/conduit revise')).toEqual({ kind: 'revise' });
    expect(parseConduitCommand('/conduit exit')).toEqual({ kind: 'exit' });
    expect(parseConduitCommand('/conduit help')).toEqual({ kind: 'help' });
  });

  it('does not discard trailing arguments on lifecycle commands', () => {
    expect(parseConduitCommand('/conduit run tests')).toEqual({ kind: 'unknown', command: 'run tests' });
    expect(parseConduitCommand('/conduit exit later')).toEqual({ kind: 'unknown', command: 'exit later' });
  });

  it('parses supported replay stages', () => {
    expect(parseConduitCommand('/conduit replay plan')).toEqual({ kind: 'replay', stage: 'plan' });
    expect(parseConduitCommand('/conduit replay patch')).toEqual({ kind: 'replay', stage: 'patch' });
    expect(parseConduitCommand('/conduit replay verify')).toEqual({ kind: 'replay', stage: 'verify' });
    expect(parseConduitCommand('/conduit replay summary')).toEqual({ kind: 'replay', stage: 'summary' });
  });

  it('returns unknown for flag-like commands and invalid replay stages', () => {
    expect(parseConduitCommand('/conduit -x')).toEqual({ kind: 'unknown', command: '-x' });
    expect(parseConduitCommand('/conduit replay deploy')).toEqual({ kind: 'unknown', command: 'replay deploy' });
  });

  it('reports whether input is handled by the Conduit parser', () => {
    expect(isConduitCommand('/conduit')).toBe(true);
    expect(isConduitCommand('/conduit 文章详情页展示字数')).toBe(true);
    expect(isConduitCommand('hello conduit')).toBe(false);
  });
});
