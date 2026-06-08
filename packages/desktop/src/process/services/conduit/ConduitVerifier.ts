/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import path from 'path';
import type { ConduitVerificationCommand, ConduitVerificationResult } from '@/common/types/conduitDelivery';

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[], cwd: string) => Promise<CommandResult>;

type ConduitVerifierOptions = {
  now?: () => number;
  commandRunner?: CommandRunner;
};

type PromiseWithResolversValue<T> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
};

const defaultCommandRunner: CommandRunner = async (command, args, cwd) => {
  const { promise, resolve } = (
    Promise as typeof Promise & {
      withResolvers<T>(): PromiseWithResolversValue<T>;
    }
  ).withResolvers<CommandResult>();
  const child = spawn(command, args, { cwd, shell: process.platform === 'win32', windowsHide: true });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
  child.on('error', (error) => {
    resolve({ exitCode: 1, stdout: Buffer.concat(stdout).toString('utf8'), stderr: error.message });
  });
  child.on('close', (code) => {
    resolve({
      exitCode: code ?? 1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    });
  });

  return promise;
};

export class ConduitVerifier {
  readonly #now: () => number;
  readonly #commandRunner: CommandRunner;

  constructor(options: ConduitVerifierOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#commandRunner = options.commandRunner ?? defaultCommandRunner;
  }

  async run(sandboxPath: string, commands: ConduitVerificationCommand[]): Promise<ConduitVerificationResult[]> {
    const results: ConduitVerificationResult[] = [];
    for (const command of commands) {
      const startedAt = this.#now();
      const cwd = command.cwd ? path.resolve(sandboxPath, command.cwd) : sandboxPath;
      const result = await this.#commandRunner(command.command, command.args, cwd);
      const finishedAt = this.#now();
      results.push({
        ...command,
        status: result.exitCode === 0 ? 'passed' : 'failed',
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - startedAt),
      });
    }
    return results;
  }
}
