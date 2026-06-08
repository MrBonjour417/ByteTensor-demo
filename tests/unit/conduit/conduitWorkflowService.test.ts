/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { ConduitEventStore } from '@process/services/conduit/ConduitEventStore';
import { ConduitRepoService } from '@process/services/conduit/ConduitRepoService';
import { ConduitSkillRegistry } from '@process/services/conduit/ConduitSkillRegistry';
import { ConduitVerifier } from '@process/services/conduit/ConduitVerifier';
import { ConduitWorkflowService } from '@process/services/conduit/ConduitWorkflowService';
import { DoubaoModelClient } from '@process/services/conduit/DoubaoModelClient';
import { createArticleReadingStatsSkill } from '@process/services/conduit/articleReadingStatsSkill';

const createSandbox = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'conduit-workflow-'));
  await mkdir(path.join(root, 'frontend'), { recursive: true });
  await mkdir(path.join(root, 'backend'), { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'conduit-realworld-example-app',
      repository: { type: 'git', url: 'git+https://github.com/TonyMckes/conduit-realworld-example-app.git' },
      workspaces: ['backend', 'frontend'],
    })
  );
  await writeFile(path.join(root, 'frontend', 'package.json'), '{}');
  await writeFile(path.join(root, 'backend', 'package.json'), '{}');
  return root;
};

const createWorkflow = async (sandboxPath: string) => {
  const eventDir = await mkdtemp(path.join(tmpdir(), 'conduit-events-'));
  return new ConduitWorkflowService({
    repoService: new ConduitRepoService({
      now: () => 1,
      commandRunner: async () => ({
        exitCode: 0,
        stdout:
          ' M frontend/src/routes/Article/Article.jsx\n?? frontend/src/helpers/articleReadingStats.js\n?? frontend/src/helpers/articleReadingStats.test.js\n',
        stderr: '',
      }),
    }),
    registry: new ConduitSkillRegistry([createArticleReadingStatsSkill()]),
    verifier: new ConduitVerifier({
      now: () => 2,
      commandRunner: async () => ({ exitCode: 0, stdout: 'tests passed', stderr: '' }),
    }),
    modelClient: new DoubaoModelClient({ env: {} }),
    eventStore: new ConduitEventStore({ directory: eventDir }),
    now: () => 3,
    runIdFactory: () => 'run-1',
    defaultSandboxPath: sandboxPath,
  });
};

describe('ConduitWorkflowService', () => {
  it('runs every stage, writes patches, records missing model config, and builds a PR summary', async () => {
    const sandboxPath = await createSandbox();
    const workflow = await createWorkflow(sandboxPath);

    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    expect(state.status).toBe('succeeded');
    expect(state.stages.map((stage) => stage.stage)).toEqual([
      'intake',
      'clarify',
      'plan',
      'locate',
      'patch',
      'verify',
      'summarize',
    ]);
    expect(state.modelMetrics?.[0].status).toBe('missing_config');
    expect(state.verificationResults.every((result) => result.status === 'passed')).toBe(true);
    expect(state.summary?.title).toBe('feat: show article reading statistics');
    expect(state.summary?.manualCommands).toContain('git checkout -b feat/article-reading-stats');
    await expect(
      readFile(path.join(sandboxPath, 'frontend/src/helpers/articleReadingStats.js'), 'utf8')
    ).resolves.toContain('WORDS_PER_MINUTE');
  });

  it('propagates verification failure into the run state', async () => {
    const sandboxPath = await createSandbox();
    const workflow = new ConduitWorkflowService({
      repoService: new ConduitRepoService({ commandRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }) }),
      registry: new ConduitSkillRegistry([createArticleReadingStatsSkill()]),
      verifier: new ConduitVerifier({ commandRunner: async () => ({ exitCode: 1, stdout: '', stderr: 'broken' }) }),
      modelClient: new DoubaoModelClient({ env: {} }),
      eventStore: new ConduitEventStore({ directory: await mkdtemp(path.join(tmpdir(), 'conduit-events-')) }),
      runIdFactory: () => 'run-fail',
      defaultSandboxPath: sandboxPath,
    });

    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    expect(state.status).toBe('failed');
    expect(state.error).toBe('Conduit verification failed.');
    expect(state.verificationResults[0].stderr).toBe('broken');
    expect(state.stages.find((stage) => stage.stage === 'verify')?.status).toBe('failed');
    expect(state.events.find((event) => event.stage === 'verify')?.status).toBe('failed');
  });

  it('replays a stored run request downstream', async () => {
    const sandboxPath = await createSandbox();
    const workflow = await createWorkflow(sandboxPath);
    await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    const replayed = await workflow.replayRun({ runId: 'run-1' });

    expect(replayed.runId).toBe('run-1');
    expect(replayed.events.some((event) => event.message.includes('Replay'))).toBe(true);
  });

  it('fails explicitly for plan and patch replay stages instead of full replaying', async () => {
    const sandboxPath = await createSandbox();
    const workflow = await createWorkflow(sandboxPath);
    await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'plan' });

    expect(replayed.status).toBe('failed');
    expect(replayed.error).toBe('Conduit plan replay is not implemented yet.');
  });

  it('does not mark summary replay as succeeded without verification results', async () => {
    const sandboxPath = await createSandbox();
    const workflow = await createWorkflow(sandboxPath);
    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });
    state.verificationResults = [];

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'summary' });

    expect(replayed.status).toBe('failed');
    expect(replayed.error).toBe('Conduit verification results are required before summary replay.');
  });
});
