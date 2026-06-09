/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, readFile, realpath, stat, writeFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import {
  CONDUIT_OFFICIAL_REPOSITORY_URL,
  type ConduitChangedFile,
  type ConduitPatchFile,
  type ConduitSandboxBinding,
} from '@/common/types/conduitDelivery';

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (
  command: string,
  args: string[],
  cwd: string,
  options: { shell: boolean }
) => Promise<CommandResult>;

type RealpathResolver = (targetPath: string) => Promise<string>;

type ConduitRepoServiceOptions = {
  now?: () => number;
  commandRunner?: CommandRunner;
  realpath?: RealpathResolver;
};

const OFFICIAL_PACKAGE_NAME = 'conduit-realworld-example-app';
const FORBIDDEN_TENSOR_SUFFIX = `${path.sep}ompproject${path.sep}tensor`;

type PromiseWithResolversValue<T> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
};

const defaultCommandRunner: CommandRunner = async (command, args, cwd, options) => {
  const { promise, resolve } = (
    Promise as typeof Promise & {
      withResolvers<T>(): PromiseWithResolversValue<T>;
    }
  ).withResolvers<CommandResult>();
  const child = spawn(command, args, { cwd, shell: options.shell, windowsHide: true });
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

export class ConduitRepoService {
  readonly #now: () => number;
  readonly #commandRunner: CommandRunner;
  readonly #realpath: RealpathResolver;

  constructor(options: ConduitRepoServiceOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#realpath = options.realpath ?? realpath;
    this.#commandRunner = options.commandRunner ?? defaultCommandRunner;
  }

  async bindSandbox(sandboxPath: string): Promise<ConduitSandboxBinding> {
    const safeRoot = await this.#normalizeSandboxRoot(sandboxPath);
    const packageJson = await this.#readPackageJson(safeRoot);
    const packageName = typeof packageJson.name === 'string' ? packageJson.name : undefined;
    const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : [];
    if (packageName !== OFFICIAL_PACKAGE_NAME) {
      throw new Error('The selected folder is not the official Conduit repository package.');
    }
    if (!this.#isOfficialRepository(packageJson.repository)) {
      throw new Error('The selected folder does not point at the official Conduit repository.');
    }
    if (!workspaces.includes('backend') || !workspaces.includes('frontend')) {
      throw new Error('The selected folder is not the official Conduit workspace shape.');
    }

    return {
      path: safeRoot,
      repositoryUrl: CONDUIT_OFFICIAL_REPOSITORY_URL,
      packageName,
      boundAt: this.#now(),
    };
  }

  async cloneSandbox(targetPath: string): Promise<ConduitSandboxBinding> {
    const resolvedTarget = path.resolve(targetPath);
    this.#rejectForbiddenPath(resolvedTarget);
    const cloneResult = await this.#commandRunner(
      'git',
      ['clone', CONDUIT_OFFICIAL_REPOSITORY_URL, resolvedTarget],
      process.cwd(),
      { shell: false }
    );
    if (cloneResult.exitCode !== 0) {
      throw new Error(`Failed to clone Conduit sandbox: ${cloneResult.stderr || cloneResult.stdout}`);
    }
    return this.bindSandbox(resolvedTarget);
  }

  async applyPatches(sandboxPath: string, patches: ConduitPatchFile[]): Promise<void> {
    const safeRoot = await this.#normalizeSandboxRoot(sandboxPath);
    for (const patch of patches) {
      const targetPath = await this.resolveInsideSandbox(safeRoot, patch.path);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, patch.content, 'utf8');
    }
  }

  async readTextFile(sandboxPath: string, relativePath: string): Promise<string> {
    const safeRoot = await this.#normalizeSandboxRoot(sandboxPath);
    const targetPath = await this.resolveInsideSandbox(safeRoot, relativePath);
    return readFile(targetPath, 'utf8');
  }

  async listChangedFiles(sandboxPath: string): Promise<ConduitChangedFile[]> {
    const result = await this.#commandRunner('git', ['status', '--porcelain'], sandboxPath, { shell: false });
    if (result.exitCode !== 0) {
      throw new Error(`Failed to list Conduit changes: ${result.stderr || result.stdout}`);
    }

    const changedFiles: ConduitChangedFile[] = [];
    for (const line of result.stdout.split(/\r?\n/)) {
      if (line.length < 4) continue;
      const statusCode = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      if (!filePath) continue;
      changedFiles.push({ path: filePath, status: this.#mapPorcelainStatus(statusCode) });
    }
    return changedFiles;
  }

  async resolveInsideSandbox(sandboxPath: string, relativePath: string): Promise<string> {
    const safeRoot = await this.#normalizeSandboxRoot(sandboxPath);
    const targetPath = path.resolve(safeRoot, relativePath);
    const relative = path.relative(safeRoot, targetPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing to write outside the Conduit sandbox.');
    }
    return targetPath;
  }

  async #normalizeSandboxRoot(sandboxPath: string): Promise<string> {
    const resolved = path.resolve(sandboxPath);
    this.#rejectForbiddenPath(resolved);
    const stats = await stat(resolved);
    if (!stats.isDirectory()) {
      throw new Error('Conduit sandbox path must be a directory.');
    }
    const realRoot = await this.#realpath(resolved);
    this.#rejectForbiddenPath(realRoot);
    return realRoot;
  }

  #rejectForbiddenPath(resolvedPath: string): void {
    const normalized = resolvedPath.toLowerCase().replaceAll('/', path.sep);
    if (normalized.endsWith(FORBIDDEN_TENSOR_SUFFIX)) {
      throw new Error('Refusing to use the previous Tensor prototype as a Conduit sandbox.');
    }
  }

  async #readPackageJson(safeRoot: string): Promise<{ name?: unknown; repository?: unknown; workspaces?: unknown }> {
    const packageJsonPath = await this.resolveInsideSandbox(safeRoot, 'package.json');
    const content = await readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as { name?: unknown; repository?: unknown; workspaces?: unknown };
    return parsed;
  }

  #isOfficialRepository(repository: unknown): boolean {
    const value =
      typeof repository === 'string'
        ? repository
        : repository && typeof repository === 'object' && 'url' in repository && typeof repository.url === 'string'
          ? repository.url
          : undefined;
    if (!value) return false;

    const normalized = value
      .toLowerCase()
      .replace(/^git\+/, '')
      .replace(/\/+$/, '')
      .replace(/\.git$/, '');
    return normalized === CONDUIT_OFFICIAL_REPOSITORY_URL.toLowerCase();
  }

  #mapPorcelainStatus(statusCode: string): ConduitChangedFile['status'] {
    if (statusCode.includes('?') || statusCode.includes('A')) return 'added';
    if (statusCode.includes('D')) return 'deleted';
    if (statusCode.includes('R')) return 'renamed';
    if (statusCode.trim().length > 0) return 'modified';
    return 'unknown';
  }
}
