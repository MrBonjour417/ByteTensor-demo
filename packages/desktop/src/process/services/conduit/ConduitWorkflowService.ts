/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CONDUIT_DELIVERY_STAGE_ORDER,
  type ConduitChangedFile,
  type ConduitClarification,
  type ConduitDeliveryEvent,
  type ConduitDeliveryReplayRequest,
  type ConduitDeliveryRunState,
  type ConduitDeliveryRunSummary,
  type ConduitDeliveryStage,
  type ConduitDeliveryStageState,
  type ConduitDeliveryStartRunRequest,
  type ConduitModelCallMetrics,
  type ConduitModuleLocation,
  type ConduitPrReadySummary,
  type ConduitVerificationResult,
} from '@/common/types/conduitDelivery';
import { createArticleReadingStatsSkill } from './articleReadingStatsSkill';
import type { ConduitEventStore } from './ConduitEventStore';
import { ConduitRepoService } from './ConduitRepoService';
import { ConduitSkillRegistry, type ConduitDeliverySkill } from './ConduitSkillRegistry';
import { ConduitVerifier } from './ConduitVerifier';
import { DoubaoModelClient } from './DoubaoModelClient';

type ConduitWorkflowServiceOptions = {
  repoService?: ConduitRepoService;
  registry?: ConduitSkillRegistry;
  verifier?: ConduitVerifier;
  modelClient?: DoubaoModelClient;
  eventStore: ConduitEventStore;
  now?: () => number;
  runIdFactory?: () => string;
  defaultSandboxPath?: string;
};

const createStageState = (): ConduitDeliveryStageState[] =>
  CONDUIT_DELIVERY_STAGE_ORDER.map((stage) => ({ stage, status: 'pending' }));

export class ConduitWorkflowService {
  readonly #repoService: ConduitRepoService;
  readonly #registry: ConduitSkillRegistry;
  readonly #verifier: ConduitVerifier;
  readonly #modelClient: DoubaoModelClient;
  readonly #eventStore: ConduitEventStore;
  readonly #now: () => number;
  readonly #runIdFactory: () => string;
  readonly #runs = new Map<string, ConduitDeliveryRunState>();
  #defaultSandboxPath?: string;

  constructor(options: ConduitWorkflowServiceOptions) {
    this.#repoService = options.repoService ?? new ConduitRepoService();
    this.#registry = options.registry ?? new ConduitSkillRegistry([createArticleReadingStatsSkill()]);
    this.#verifier = options.verifier ?? new ConduitVerifier();
    this.#modelClient = options.modelClient ?? new DoubaoModelClient();
    this.#eventStore = options.eventStore;
    this.#now = options.now ?? Date.now;
    this.#runIdFactory = options.runIdFactory ?? (() => `conduit-${Date.now().toString(36)}`);
    this.#defaultSandboxPath = options.defaultSandboxPath;
  }

  setDefaultSandboxPath(sandboxPath: string): void {
    this.#defaultSandboxPath = sandboxPath;
  }

  getState(runId?: string): ConduitDeliveryRunState | undefined {
    if (runId) return this.#runs.get(runId);
    return Array.from(this.#runs.values()).at(-1);
  }

  listRuns(): ConduitDeliveryRunSummary[] {
    return Array.from(this.#runs.values()).map(
      ({ runId, status, requirement, createdAt, updatedAt, selectedSkill, summary, error }) => ({
        runId,
        status,
        requirement,
        createdAt,
        updatedAt,
        selectedSkill,
        summary,
        error,
      })
    );
  }

  getChangedFiles(runId?: string): ConduitChangedFile[] {
    return this.getState(runId)?.changedFiles ?? [];
  }

  async startRun(request: ConduitDeliveryStartRunRequest): Promise<ConduitDeliveryRunState> {
    const runId = this.#runIdFactory();
    return this.#executeRun(runId, request, false);
  }

  async replayRun(request: ConduitDeliveryReplayRequest): Promise<ConduitDeliveryRunState> {
    const current = this.#runs.get(request.runId);
    if (!current) throw new Error(`Cannot replay unknown Conduit run: ${request.runId}`);
    if (request.stage === 'verify') return this.#replayVerification(current);
    if (request.stage === 'plan' || request.stage === 'patch') {
      return this.#rejectUnsupportedReplayStage(current, request.stage);
    }
    if (request.stage === 'summary') return this.#replaySummary(current);
    await this.#appendEvent(current, 'intake', 'running', 'Replay requested for stored Conduit run.');
    return this.#executeRun(
      request.runId,
      { requirement: current.requirement, sandboxPath: current.sandbox?.path, conversationId: current.conversationId },
      true
    );
  }

  async #replayVerification(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    if (!state.sandbox?.path) throw new Error('A Conduit sandbox path is required before starting a run.');
    const skill = state.selectedSkill ?? this.#registry.selectSkill(state.requirement);
    if (!skill) throw new Error('No Conduit Skill matched the PM requirement.');

    state.status = 'running';
    state.error = undefined;
    await this.#appendEvent(state, 'verify', 'running', 'Replay requested from verify stage.');
    state.verificationResults = await this.#verifier.run(state.sandbox.path, skill.verificationCommands);
    const verificationPassed = state.verificationResults.every((result) => result.status === 'passed');
    await this.#completeStage(
      state,
      'verify',
      verificationPassed ? 'Conduit verification passed.' : 'Conduit verification failed.',
      verificationPassed ? 'succeeded' : 'failed'
    );
    state.changedFiles = await this.#repoService.listChangedFiles(state.sandbox.path);
    state.summary = this.#buildSummary(state.changedFiles, state.verificationResults);
    state.status = verificationPassed ? 'succeeded' : 'failed';
    if (!verificationPassed) state.error = 'Conduit verification failed.';
    await this.#completeStage(state, 'summarize', 'Prepared PR-ready handoff summary.');
    state.updatedAt = this.#now();
    return state;
  }

  async #replaySummary(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    if (!state.sandbox?.path) throw new Error('A Conduit sandbox path is required before starting a run.');
    state.status = 'running';
    state.error = undefined;
    await this.#appendEvent(state, 'summarize', 'running', 'Replay requested from summary stage.');
    if (state.verificationResults.length === 0) {
      state.status = 'failed';
      state.error = 'Conduit verification results are required before summary replay.';
      state.updatedAt = this.#now();
      await this.#completeStage(state, 'summarize', state.error, 'failed');
      return state;
    }
    state.changedFiles = await this.#repoService.listChangedFiles(state.sandbox.path);
    state.summary = this.#buildSummary(state.changedFiles, state.verificationResults);
    const verificationPassed = state.verificationResults.every((result) => result.status === 'passed');
    state.status = verificationPassed ? 'succeeded' : 'failed';
    if (!verificationPassed) state.error = 'Conduit verification failed.';
    await this.#completeStage(state, 'summarize', 'Prepared PR-ready handoff summary.');
    state.updatedAt = this.#now();
    return state;
  }

  async #rejectUnsupportedReplayStage(
    state: ConduitDeliveryRunState,
    stage: 'plan' | 'patch'
  ): Promise<ConduitDeliveryRunState> {
    state.status = 'failed';
    state.error = `Conduit ${stage} replay is not implemented yet.`;
    state.updatedAt = this.#now();
    await this.#appendEvent(state, stage, 'failed', state.error);
    return state;
  }

  async #executeRun(
    runId: string,
    request: ConduitDeliveryStartRunRequest,
    isReplay: boolean
  ): Promise<ConduitDeliveryRunState> {
    const sandboxPath = request.sandboxPath ?? this.#defaultSandboxPath;
    if (!sandboxPath) throw new Error('A Conduit sandbox path is required before starting a run.');

    const createdAt = this.#now();
    const state: ConduitDeliveryRunState = {
      runId,
      status: 'running',
      requirement: request.requirement,
      conversationId: request.conversationId,
      createdAt,
      updatedAt: createdAt,
      stages: createStageState(),
      events: [],
      changedFiles: [],
      verificationResults: [],
      modelMetrics: [],
    };
    this.#runs.set(runId, state);

    try {
      await this.#completeStage(state, 'intake', isReplay ? 'Replay intake accepted.' : 'PM requirement accepted.');
      const sandbox = await this.#repoService.bindSandbox(sandboxPath);
      state.sandbox = sandbox;

      const modelMetrics = await this.#modelClient.checkConfiguration();
      state.modelMetrics = [modelMetrics];
      await this.#completeStage(state, 'clarify', this.#clarificationMessage(modelMetrics));
      state.clarification = this.#buildClarification(request.requirement);

      const skill = this.#registry.selectSkill(request.requirement);
      if (!skill) throw new Error('No Conduit Skill matched the PM requirement.');
      state.selectedSkill = skill;
      state.plan = skill.buildPlan();
      await this.#completeStage(state, 'plan', 'Generated deterministic L1 implementation plan.');

      state.moduleLocations = this.#buildModuleLocations(skill);
      await this.#completeStage(state, 'locate', 'Located Conduit frontend article modules.');

      await this.#repoService.applyPatches(sandbox.path, skill.buildPatches());
      await this.#completeStage(state, 'patch', 'Applied deterministic Skill patch to the Conduit sandbox.');

      state.verificationResults = await this.#verifier.run(sandbox.path, skill.verificationCommands);
      const verificationPassed = state.verificationResults.every((result) => result.status === 'passed');
      await this.#completeStage(
        state,
        'verify',
        verificationPassed ? 'Conduit verification passed.' : 'Conduit verification failed.',
        verificationPassed ? 'succeeded' : 'failed'
      );

      state.changedFiles = await this.#repoService.listChangedFiles(sandbox.path);
      state.summary = this.#buildSummary(state.changedFiles, state.verificationResults);
      state.status = verificationPassed ? 'succeeded' : 'failed';
      if (!verificationPassed) state.error = 'Conduit verification failed.';
      await this.#completeStage(state, 'summarize', 'Prepared PR-ready handoff summary.');
      state.updatedAt = this.#now();
      return state;
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      state.updatedAt = this.#now();
      return state;
    }
  }

  async #completeStage(
    state: ConduitDeliveryRunState,
    stage: ConduitDeliveryStage,
    message: string,
    status: ConduitDeliveryEvent['status'] = 'succeeded'
  ): Promise<void> {
    const stageState = state.stages.find((candidate) => candidate.stage === stage);
    if (stageState) {
      stageState.status = status;
      stageState.startedAt = stageState.startedAt ?? this.#now();
      stageState.finishedAt = this.#now();
      stageState.message = message;
    }
    await this.#appendEvent(state, stage, status, message);
    state.updatedAt = this.#now();
  }

  async #appendEvent(
    state: ConduitDeliveryRunState,
    stage: ConduitDeliveryStage,
    status: ConduitDeliveryEvent['status'],
    message: string,
    data?: unknown
  ): Promise<void> {
    const event: ConduitDeliveryEvent = {
      id: `${state.runId}-${state.events.length + 1}`,
      runId: state.runId,
      stage,
      status,
      message,
      createdAt: this.#now(),
      data,
    };
    state.events.push(event);
    await this.#eventStore.append(event);
  }

  #buildClarification(requirement: string): ConduitClarification {
    return {
      questions: [],
      defaults: [
        'Count words from rendered article body text.',
        'Use 200 words per minute.',
        'Render below the article body and above tags.',
        'Skip the statistic when the body is missing.',
      ],
      resolvedRequirement: requirement,
    };
  }

  #buildModuleLocations(skill: ConduitDeliverySkill): ConduitModuleLocation[] {
    return skill.targetFiles.map((file) => ({ path: file.path, reason: file.purpose }));
  }

  #buildSummary(
    changedFiles: ConduitChangedFile[],
    verificationResults: ConduitVerificationResult[]
  ): ConduitPrReadySummary {
    const changedFileList = changedFiles.map((file) => `- ${file.path} (${file.status})`).join('\n');
    const verificationList = verificationResults
      .map((result) => `- ${result.command} ${result.args.join(' ')}: ${result.status} (exit ${result.exitCode})`)
      .join('\n');

    return {
      title: 'feat: show article reading statistics',
      body: [
        '## Summary',
        '- Show word count and estimated reading time on Conduit article detail pages.',
        '- Add deterministic helper coverage for Markdown body counting.',
        '',
        '## Changed Files',
        changedFileList,
        '',
        '## Verification',
        verificationList,
      ].join('\n'),
      changedFiles,
      verificationResults,
      manualCommands: [
        'git checkout -b feat/article-reading-stats',
        'git add frontend/src/helpers/articleReadingStats.js frontend/src/helpers/articleReadingStats.test.js frontend/src/routes/Article/Article.jsx',
        'git commit -m "feat: show article reading statistics"',
        'git push -u origin feat/article-reading-stats',
        'gh pr create --title "feat: show article reading statistics" --body-file PR_BODY.md',
      ],
    };
  }

  #clarificationMessage(metrics: ConduitModelCallMetrics): string {
    if (metrics.status === 'missing_config') return `Model configuration missing: ${metrics.error}`;
    if (metrics.status === 'failed') return `Model configuration failed: ${metrics.error}`;
    return 'Model configuration available; deterministic L1 defaults confirmed.';
  }
}
