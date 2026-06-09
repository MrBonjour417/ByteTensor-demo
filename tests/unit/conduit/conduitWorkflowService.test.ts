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
import { ConduitSkillRegistry, type ConduitDeliverySkill } from '@process/services/conduit/ConduitSkillRegistry';
import { ConduitVerifier } from '@process/services/conduit/ConduitVerifier';
import { ConduitWorkflowService } from '@process/services/conduit/ConduitWorkflowService';
import { DoubaoModelClient } from '@process/services/conduit/DoubaoModelClient';
import { createArticleCommentCountSkill } from '@process/services/conduit/articleCommentCountSkill';
import { createArticlePreviewReadingStatsSkill } from '@process/services/conduit/articlePreviewReadingStatsSkill';
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

const createWorkflow = async (
  sandboxPath: string,
  options: { verifier?: ConduitVerifier; registry?: ConduitSkillRegistry } = {}
) => {
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
    registry: options.registry ?? new ConduitSkillRegistry([createArticleReadingStatsSkill()]),
    verifier:
      options.verifier ??
      new ConduitVerifier({
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

const createDecoySkill = (): ConduitDeliverySkill => ({
  id: 'conduit.decoy',
  name: 'Decoy skill',
  level: 'L1',
  description: 'Matches a replay-only decoy requirement.',
  matcherPhrases: ['decoy replay'],
  targetFiles: [{ path: 'frontend/src/helpers/decoy.js', purpose: 'create_or_replace' }],
  verificationCommands: [
    {
      id: 'decoy-test',
      command: 'npm',
      args: ['run', 'test', '--', 'frontend/src/helpers/decoy.test.js'],
      description: 'Run decoy verification.',
    },
  ],
  matches(requirement) {
    return requirement.includes('decoy replay');
  },
  buildPatches() {
    return [
      {
        path: 'frontend/src/helpers/decoy.js',
        operation: 'create_or_replace',
        content: 'export const DECOY = true;\n',
      },
    ];
  },
  buildPlan() {
    return ['Decoy replay plan'];
  },
});

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

  it('cuts repository context to selected Skill target files before patching', async () => {
    const sandboxPath = await createSandbox();
    await mkdir(path.join(sandboxPath, 'frontend/src/routes/Article'), { recursive: true });
    await mkdir(path.join(sandboxPath, 'frontend/src/routes/Profile'), { recursive: true });
    await writeFile(
      path.join(sandboxPath, 'frontend/src/routes/Article/Article.jsx'),
      'export default function Article() { return null; }\n'
    );
    await writeFile(
      path.join(sandboxPath, 'frontend/src/routes/Profile/Profile.jsx'),
      'export default function Profile() { return null; }\n'
    );
    const workflow = await createWorkflow(sandboxPath);

    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    expect(state.contextSlices?.map((slice) => slice.path)).toEqual([
      'frontend/src/helpers/articleReadingStats.js',
      'frontend/src/helpers/articleReadingStats.test.js',
      'frontend/src/routes/Article/Article.jsx',
    ]);
    expect(state.contextSlices?.find((slice) => slice.path.endsWith('Article.jsx'))).toMatchObject({
      reason: 'replace',
      lineStart: 1,
      lineEnd: 1,
      tokenEstimate: 13,
    });
    expect(state.contextSlices?.some((slice) => slice.path.includes('Profile'))).toBe(false);
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

  it('replays the plan path by rebuilding plan, module locations, and summary without writing patches', async () => {
    const sandboxPath = await createSandbox();
    const workflow = await createWorkflow(sandboxPath);
    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });
    const skill = createArticleReadingStatsSkill();
    const patchFiles = skill.buildPatches().map((patch) => ({
      path: path.join(sandboxPath, patch.path),
      sentinel: `corrupted ${patch.path}`,
    }));
    for (const file of patchFiles) await writeFile(file.path, file.sentinel, 'utf8');
    state.plan = ['stale plan'];
    state.moduleLocations = [{ path: 'stale', reason: 'stale' }];
    state.summary = undefined;
    const eventCount = state.events.length;

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'plan' });

    expect(replayed.status).toBe('succeeded');
    expect(replayed.plan).toEqual(skill.buildPlan());
    expect(replayed.moduleLocations).toEqual(
      skill.targetFiles.map((file) => ({ path: file.path, reason: file.purpose }))
    );
    expect(replayed.summary?.body).toContain('frontend/src/helpers/articleReadingStats.js');
    for (const file of patchFiles) await expect(readFile(file.path, 'utf8')).resolves.toBe(file.sentinel);
    expect(replayed.events.slice(eventCount).map((event) => event.stage)).toEqual([
      'plan',
      'plan',
      'locate',
      'summarize',
    ]);
  });

  it('replays the plan path from the run selected skill instead of reselecting by requirement', async () => {
    const sandboxPath = await createSandbox();
    const selectedSkill = createArticleReadingStatsSkill();
    const workflow = await createWorkflow(sandboxPath, {
      registry: new ConduitSkillRegistry([selectedSkill, createDecoySkill()]),
    });
    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });
    state.requirement = 'decoy replay';

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'plan' });

    expect(replayed.status).toBe('succeeded');
    expect(replayed.selectedSkill?.id).toBe(selectedSkill.id);
    expect(replayed.plan).toEqual(selectedSkill.buildPlan());
    expect(replayed.moduleLocations).toEqual(
      selectedSkill.targetFiles.map((file) => ({ path: file.path, reason: file.purpose }))
    );
  });

  it('replays the patch path by reapplying deterministic patches, rerunning verify, and rebuilding summary', async () => {
    const sandboxPath = await createSandbox();
    const workflow = await createWorkflow(sandboxPath);
    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });
    const skill = createArticleReadingStatsSkill();
    const patchFiles = skill.buildPatches();
    for (const patch of patchFiles) {
      await writeFile(path.join(sandboxPath, patch.path), `corrupted ${patch.path}`, 'utf8');
    }
    state.verificationResults = [];
    state.summary = undefined;
    const eventCount = state.events.length;

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'patch' });

    expect(replayed.status).toBe('succeeded');
    expect(replayed.verificationResults.every((result) => result.status === 'passed')).toBe(true);
    expect(replayed.summary?.verificationResults).toHaveLength(2);
    for (const patch of patchFiles)
      await expect(readFile(path.join(sandboxPath, patch.path), 'utf8')).resolves.toBe(patch.content);
    expect(replayed.events.slice(eventCount).map((event) => event.stage)).toEqual([
      'patch',
      'patch',
      'verify',
      'summarize',
    ]);
  });

  it('replays the patch path from the run selected skill instead of reselecting by requirement', async () => {
    const sandboxPath = await createSandbox();
    const selectedSkill = createArticleReadingStatsSkill();
    const workflow = await createWorkflow(sandboxPath, {
      registry: new ConduitSkillRegistry([selectedSkill, createDecoySkill()]),
    });
    const state = await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });
    state.requirement = 'decoy replay';
    const patchFiles = selectedSkill.buildPatches();
    for (const patch of patchFiles) {
      await writeFile(path.join(sandboxPath, patch.path), `corrupted ${patch.path}`, 'utf8');
    }

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'patch' });

    expect(replayed.status).toBe('succeeded');
    expect(replayed.verificationResults.map((result) => result.id)).toEqual([
      'article-reading-stats-test',
      'root-test',
    ]);
    for (const patch of patchFiles)
      await expect(readFile(path.join(sandboxPath, patch.path), 'utf8')).resolves.toBe(patch.content);
  });

  it('selects the preview Skill before generic detail reading stats in the default workflow registry', async () => {
    const sandboxPath = await createSandbox();
    const eventDir = await mkdtemp(path.join(tmpdir(), 'conduit-events-'));
    const workflow = new ConduitWorkflowService({
      repoService: new ConduitRepoService({
        now: () => 1,
        commandRunner: async () => ({
          exitCode: 0,
          stdout: '?? frontend/src/components/ArticlesPreview/ArticlesPreview.jsx\n',
          stderr: '',
        }),
      }),
      verifier: new ConduitVerifier({
        now: () => 2,
        commandRunner: async () => ({ exitCode: 0, stdout: 'tests passed', stderr: '' }),
      }),
      modelClient: new DoubaoModelClient({ env: {} }),
      eventStore: new ConduitEventStore({ directory: eventDir }),
      now: () => 3,
      runIdFactory: () => 'run-preview',
      defaultSandboxPath: sandboxPath,
    });

    const state = await workflow.startRun({
      requirement: 'show word count and estimated reading time on article preview cards',
    });

    expect(state.selectedSkill?.id).toBe('conduit.article-preview-reading-stats');
    await expect(
      readFile(path.join(sandboxPath, 'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx'), 'utf8')
    ).resolves.toContain('FavButton');
  });

  it('routes Chinese article favorite filter requirements to the generic add_filter Skill', async () => {
    const sandboxPath = await createSandbox();
    const workflow = new ConduitWorkflowService({
      repoService: new ConduitRepoService({
        now: () => 1,
        commandRunner: async () => ({
          exitCode: 0,
          stdout:
            ' M frontend/src/context/FeedContext.jsx\n M frontend/src/components/FeedToggler/FeedToggler.jsx\n M frontend/src/routes/HomeArticles.jsx\n?? frontend/src/services/getArticles.test.js\n',
          stderr: '',
        }),
      }),
      verifier: new ConduitVerifier({
        now: () => 2,
        commandRunner: async () => ({ exitCode: 0, stdout: 'tests passed', stderr: '' }),
      }),
      modelClient: new DoubaoModelClient({ env: {} }),
      eventStore: new ConduitEventStore({ directory: await mkdtemp(path.join(tmpdir(), 'conduit-events-')) }),
      now: () => 3,
      runIdFactory: () => 'run-filter',
      defaultSandboxPath: sandboxPath,
    });

    const state = await workflow.startRun({ requirement: '新增文章收藏筛选器' });

    expect(state.selectedSkill?.id).toBe('conduit.article-favorite-filter');
    expect(state.summary?.title).toBe('feat: add article favorite filter');
    await expect(
      readFile(path.join(sandboxPath, 'frontend/src/components/FeedToggler/FeedToggler.jsx'), 'utf8')
    ).resolves.toContain('Favorited Articles');
  });

  it('builds a PR summary and manual commands from preview Skill changed files', async () => {
    const sandboxPath = await createSandbox();
    const workflow = new ConduitWorkflowService({
      repoService: new ConduitRepoService({
        now: () => 1,
        commandRunner: async () => ({
          exitCode: 0,
          stdout:
            ' M frontend/src/components/ArticlesPreview/ArticlesPreview.jsx\n?? frontend/src/helpers/articleReadingStats.js\n?? frontend/src/components/ArticlesPreview/ArticlesPreview.test.jsx\n',
          stderr: '',
        }),
      }),
      registry: new ConduitSkillRegistry([createArticlePreviewReadingStatsSkill(), createArticleReadingStatsSkill()]),
      verifier: new ConduitVerifier({
        now: () => 2,
        commandRunner: async () => ({ exitCode: 0, stdout: 'tests passed', stderr: '' }),
      }),
      modelClient: new DoubaoModelClient({ env: {} }),
      eventStore: new ConduitEventStore({ directory: await mkdtemp(path.join(tmpdir(), 'conduit-events-')) }),
      runIdFactory: () => 'run-preview',
      defaultSandboxPath: sandboxPath,
    });

    const state = await workflow.startRun({
      requirement: 'Show word count and estimated reading time on Conduit article preview cards.',
    });

    expect(state.summary?.title).toBe('feat: show article preview reading statistics');
    expect(state.summary?.manualCommands).toContain(
      'git add frontend/src/components/ArticlesPreview/ArticlesPreview.jsx frontend/src/helpers/articleReadingStats.js frontend/src/components/ArticlesPreview/ArticlesPreview.test.jsx'
    );
  });

  it('builds a PR summary and manual commands from L2 comment-count changed files', async () => {
    const sandboxPath = await createSandbox();
    const workflow = new ConduitWorkflowService({
      repoService: new ConduitRepoService({
        now: () => 1,
        commandRunner: async () => ({
          exitCode: 0,
          stdout:
            ' M backend/helper/helpers.js\n M backend/controllers/articles.js\n M frontend/src/routes/Article/Article.jsx\n?? backend/helper/helpers.test.js\n?? frontend/src/routes/Article/Article.test.jsx\n',
          stderr: '',
        }),
      }),
      registry: new ConduitSkillRegistry([createArticleCommentCountSkill(), createArticleReadingStatsSkill()]),
      verifier: new ConduitVerifier({
        now: () => 2,
        commandRunner: async () => ({ exitCode: 0, stdout: 'tests passed', stderr: '' }),
      }),
      modelClient: new DoubaoModelClient({ env: {} }),
      eventStore: new ConduitEventStore({ directory: await mkdtemp(path.join(tmpdir(), 'conduit-events-')) }),
      runIdFactory: () => 'run-comments',
      defaultSandboxPath: sandboxPath,
    });

    const state = await workflow.startRun({
      requirement: 'Add commentsCount from the backend API to Conduit article detail pages.',
    });

    expect(state.summary?.title).toBe('feat: add article comments count');
    expect(state.summary?.manualCommands).toContain(
      'git add backend/helper/helpers.js backend/controllers/articles.js frontend/src/routes/Article/Article.jsx backend/helper/helpers.test.js frontend/src/routes/Article/Article.test.jsx'
    );
  });

  it('marks patch replay as failed when rerun verification fails', async () => {
    const sandboxPath = await createSandbox();
    let verificationCommandCount = 0;
    const workflow = await createWorkflow(sandboxPath, {
      verifier: new ConduitVerifier({
        commandRunner: async () => {
          verificationCommandCount += 1;
          return verificationCommandCount <= 2
            ? { exitCode: 0, stdout: 'initial pass', stderr: '' }
            : { exitCode: 1, stdout: '', stderr: 'replay broken' };
        },
      }),
    });
    await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'patch' });

    expect(replayed.status).toBe('failed');
    expect(replayed.error).toBe('Conduit verification failed.');
    expect(replayed.verificationResults.every((result) => result.status === 'failed')).toBe(true);
    expect(replayed.stages.find((stage) => stage.stage === 'verify')?.status).toBe('failed');
    expect(replayed.stages.find((stage) => stage.stage === 'summarize')?.status).toBe('succeeded');
    expect(replayed.summary?.verificationResults[0].stderr).toBe('replay broken');
  });

  it('marks patch replay verifier exceptions as verify failures', async () => {
    const sandboxPath = await createSandbox();
    let verificationCommandCount = 0;
    const workflow = await createWorkflow(sandboxPath, {
      verifier: new ConduitVerifier({
        commandRunner: async () => {
          verificationCommandCount += 1;
          if (verificationCommandCount <= 2) return { exitCode: 0, stdout: 'initial pass', stderr: '' };
          throw new Error('verifier crashed');
        },
      }),
    });
    await workflow.startRun({
      requirement: 'show article word count and estimated reading time on the article detail page',
    });

    const replayed = await workflow.replayRun({ runId: 'run-1', stage: 'patch' });

    expect(replayed.status).toBe('failed');
    expect(replayed.error).toBe('verifier crashed');
    expect(replayed.stages.find((stage) => stage.stage === 'patch')?.status).toBe('succeeded');
    expect(replayed.stages.find((stage) => stage.stage === 'verify')?.status).toBe('failed');
    expect(replayed.events.at(-1)).toMatchObject({ stage: 'verify', status: 'failed', message: 'verifier crashed' });
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
    expect(replayed.summary).toBeUndefined();
  });
});
