/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONDUIT_OFFICIAL_REPOSITORY_URL, type ConduitPatchFile } from '@/common/types/conduitDelivery';
import { ConduitRepoService } from '@process/services/conduit/ConduitRepoService';

const makeSandbox = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'conduit-repo-'));
  await mkdir(path.join(root, 'frontend', 'src', 'helpers'), { recursive: true });
  await mkdir(path.join(root, 'frontend', 'src', 'routes', 'Article'), { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'conduit-realworld-example-app',
        repository: { type: 'git', url: 'git+https://github.com/TonyMckes/conduit-realworld-example-app.git' },
        scripts: { test: 'vitest' },
        workspaces: ['backend', 'frontend'],
      },
      null,
      2
    )
  );
  await writeFile(path.join(root, 'frontend', 'package.json'), JSON.stringify({ name: 'frontend' }, null, 2));
  await writeFile(path.join(root, 'backend', 'package.json'), JSON.stringify({ name: 'backend' }, null, 2)).catch(
    async () => {
      await mkdir(path.join(root, 'backend'), { recursive: true });
      await writeFile(path.join(root, 'backend', 'package.json'), JSON.stringify({ name: 'backend' }, null, 2));
    }
  );
  return root;
};

describe('ConduitRepoService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects the previous Tensor prototype path', async () => {
    const service = new ConduitRepoService();

    await expect(service.bindSandbox('D:/OmpProject/Tensor')).rejects.toThrow(/Tensor prototype/i);
  });

  it('rejects a sandbox link whose real path resolves to the previous Tensor prototype', async () => {
    const service = new ConduitRepoService({ realpath: async () => 'D:/OmpProject/Tensor' });
    const root = await makeSandbox();

    await expect(service.bindSandbox(root)).rejects.toThrow(/Tensor prototype/i);
  });

  it('rejects writes that escape the sandbox root', async () => {
    const service = new ConduitRepoService();
    const root = await makeSandbox();

    await expect(
      service.applyPatches(root, [{ path: '../escape.js', operation: 'create_or_replace', content: 'bad' }])
    ).rejects.toThrow(/outside/i);
  });

  it('requires the official Conduit package identity', async () => {
    const service = new ConduitRepoService();
    const root = await makeSandbox();
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'not-conduit', workspaces: ['backend', 'frontend'] })
    );

    await expect(service.bindSandbox(root)).rejects.toThrow(/official Conduit/i);
  });

  it('rejects a package that spoofs the name but does not point at the official repository', async () => {
    const service = new ConduitRepoService();
    const root = await makeSandbox();
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'conduit-realworld-example-app',
        repository: { type: 'git', url: 'https://github.com/example/fake-conduit.git' },
        workspaces: ['backend', 'frontend'],
      })
    );

    await expect(service.bindSandbox(root)).rejects.toThrow(/official Conduit/i);
  });

  it('accepts official repository metadata with git suffix before a trailing slash', async () => {
    const service = new ConduitRepoService({ now: () => 7 });
    const root = await makeSandbox();
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'conduit-realworld-example-app',
        repository: { type: 'git', url: 'git+https://github.com/TonyMckes/conduit-realworld-example-app.git/' },
        workspaces: ['backend', 'frontend'],
      })
    );

    await expect(service.bindSandbox(root)).resolves.toMatchObject({
      path: root,
      repositoryUrl: CONDUIT_OFFICIAL_REPOSITORY_URL,
    });
  });

  it('runs git clone without a shell so target paths are not interpreted as commands', async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string; shell: boolean }> = [];
    const service = new ConduitRepoService({
      commandRunner: async (command, args, cwd, options) => {
        calls.push({ command, args, cwd, shell: options.shell });
        return { exitCode: 1, stdout: '', stderr: 'stop after command capture' };
      },
    });

    await expect(service.cloneSandbox('D:/tmp/conduit && echo hacked')).rejects.toThrow(/clone/i);

    expect(calls[0]).toMatchObject({ command: 'git', shell: false });
    expect(calls[0].args).toEqual([
      'clone',
      CONDUIT_OFFICIAL_REPOSITORY_URL,
      path.resolve('D:/tmp/conduit && echo hacked'),
    ]);
  });

  it('validates an official Conduit sandbox shape', async () => {
    const service = new ConduitRepoService({ now: () => 7 });
    const root = await makeSandbox();

    const binding = await service.bindSandbox(root);

    expect(binding).toEqual({
      path: root,
      repositoryUrl: CONDUIT_OFFICIAL_REPOSITORY_URL,
      packageName: 'conduit-realworld-example-app',
      boundAt: 7,
    });
  });

  it('applies patches only inside the sandbox', async () => {
    const service = new ConduitRepoService();
    const root = await makeSandbox();
    const patches: ConduitPatchFile[] = [
      {
        path: 'frontend/src/helpers/articleReadingStats.js',
        operation: 'create_or_replace',
        content: 'export default function stats() { return 1; }\n',
      },
    ];

    await service.applyPatches(root, patches);

    await expect(readFile(path.join(root, patches[0].path), 'utf8')).resolves.toContain('return 1');
  });

  it('parses porcelain changed files', async () => {
    const service = new ConduitRepoService({
      commandRunner: async () => ({
        exitCode: 0,
        stdout: ' M frontend/src/routes/Article/Article.jsx\n?? frontend/src/helpers/articleReadingStats.js\n',
        stderr: '',
      }),
    });

    await expect(service.listChangedFiles('D:/safe/conduit')).resolves.toEqual([
      { path: 'frontend/src/routes/Article/Article.jsx', status: 'modified' },
      { path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' },
    ]);
  });
});
