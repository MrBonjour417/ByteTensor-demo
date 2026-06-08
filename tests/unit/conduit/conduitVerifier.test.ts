/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { ConduitVerifier } from '@process/services/conduit/ConduitVerifier';

describe('ConduitVerifier', () => {
  it('marks a zero-exit command as passed and captures output', async () => {
    const verifier = new ConduitVerifier({
      now: () => 10,
      commandRunner: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
    });

    const [result] = await verifier.run('/sandbox', [
      { id: 'unit', command: 'npm', args: ['test'], description: 'unit tests' },
    ]);

    expect(result.status).toBe('passed');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('ok');
    expect(result.durationMs).toBe(0);
  });

  it('marks a nonzero command as failed without suppressing stderr', async () => {
    const verifier = new ConduitVerifier({
      now: () => 20,
      commandRunner: async () => ({ exitCode: 1, stdout: '', stderr: 'failed test' }),
    });

    const [result] = await verifier.run('/sandbox', [
      { id: 'unit', command: 'npm', args: ['test'], description: 'unit tests' },
    ]);

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('failed test');
  });
});
