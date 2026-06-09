/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CONDUIT_ARTICLE_COMMENT_COUNT_SKILL_ID,
  CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID,
  CONDUIT_DELIVERY_STAGE_ORDER,
  CONDUIT_READING_STATS_SKILL_ID,
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
import { createArticleCommentCountSkill } from './articleCommentCountSkill';
import { createArticlePreviewReadingStatsSkill } from './articlePreviewReadingStatsSkill';
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
    this.#registry =
      options.registry ??
      new ConduitSkillRegistry([
        createArticlePreviewReadingStatsSkill(),
        createArticleCommentCountSkill(),
        createArticleReadingStatsSkill(),
      ]);
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
    if (request.stage === 'plan') return this.#replayPlan(current);
    if (request.stage === 'patch') return this.#replayPatch(current);
    if (request.stage === 'verify') return this.#replayVerification(current);
    if (request.stage === 'summary') return this.#replaySummary(current);
    await this.#appendEvent(current, 'intake', 'running', 'Replay requested for stored Conduit run.');
    return this.#executeRun(
      request.runId,
      { requirement: current.requirement, sandboxPath: current.sandbox?.path, conversationId: current.conversationId },
      true
    );
  }

  async #replayPlan(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    state.status = 'running';
    state.error = undefined;
    state.summary = undefined;
    await this.#appendEvent(state, 'plan', 'running', 'Replay requested from plan stage.');

    let skill: ConduitDeliverySkill;
    try {
      skill = this.#selectReplaySkill(state);
      state.selectedSkill = skill;
      state.plan = skill.buildPlan();
      await this.#completeStage(state, 'plan', 'Generated deterministic L1 implementation plan.');
    } catch (error) {
      return this.#markReplayFailed(state, 'plan', error);
    }

    try {
      state.moduleLocations = this.#buildModuleLocations(skill);
      await this.#completeStage(state, 'locate', 'Located Conduit frontend article modules.');
    } catch (error) {
      return this.#markReplayFailed(state, 'locate', error);
    }

    return this.#rebuildSummaryFromExistingVerification(
      state,
      'Conduit verification results are required before plan replay.'
    );
  }

  async #replayPatch(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    state.status = 'running';
    state.error = undefined;
    state.changedFiles = [];
    state.verificationResults = [];
    state.summary = undefined;
    await this.#appendEvent(state, 'patch', 'running', 'Replay requested from patch stage.');

    let skill: ConduitDeliverySkill;
    try {
      if (!state.sandbox?.path) throw new Error('A Conduit sandbox path is required before starting a run.');
      skill = this.#selectReplaySkill(state);
      await this.#repoService.applyPatches(state.sandbox.path, skill.buildPatches());
      await this.#completeStage(state, 'patch', 'Applied deterministic Skill patch to the Conduit sandbox.');
    } catch (error) {
      return this.#markReplayFailed(state, 'patch', error);
    }

    try {
      state.verificationResults = await this.#verifier.run(state.sandbox.path, skill.verificationCommands);
    } catch (error) {
      return this.#markReplayFailed(state, 'verify', error);
    }

    return this.#completeVerificationAndSummary(state);
  }

  #selectReplaySkill(state: ConduitDeliveryRunState): ConduitDeliverySkill {
    if (this.#isExecutableSkill(state.selectedSkill)) return state.selectedSkill;
    const skill = this.#registry.selectSkill(state.requirement);
    if (!skill) throw new Error('No Conduit Skill matched the PM requirement.');
    return skill;
  }

  #isExecutableSkill(skill: ConduitDeliveryRunState['selectedSkill']): skill is ConduitDeliverySkill {
    return Boolean(
      skill &&
      'matches' in skill &&
      typeof skill.matches === 'function' &&
      'buildPatches' in skill &&
      typeof skill.buildPatches === 'function' &&
      'buildPlan' in skill &&
      typeof skill.buildPlan === 'function'
    );
  }

  async #completeVerificationAndSummary(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    if (!state.sandbox?.path) {
      return this.#markReplayFailed(state, 'summarize', 'A Conduit sandbox path is required before starting a run.');
    }

    const verificationPassed = state.verificationResults.every((result) => result.status === 'passed');
    await this.#completeStage(
      state,
      'verify',
      verificationPassed ? 'Conduit verification passed.' : 'Conduit verification failed.',
      verificationPassed ? 'succeeded' : 'failed'
    );

    try {
      state.changedFiles = await this.#repoService.listChangedFiles(state.sandbox.path);
      state.summary = this.#buildSummary(state.changedFiles, state.verificationResults, state.selectedSkill);
    } catch (error) {
      return this.#markReplayFailed(state, 'summarize', error);
    }

    state.status = verificationPassed ? 'succeeded' : 'failed';
    if (verificationPassed) state.error = undefined;
    else state.error = 'Conduit verification failed.';
    await this.#completeStage(state, 'summarize', 'Prepared PR-ready handoff summary.');
    state.updatedAt = this.#now();
    return state;
  }

  async #rebuildSummaryFromExistingVerification(
    state: ConduitDeliveryRunState,
    missingVerificationMessage: string
  ): Promise<ConduitDeliveryRunState> {
    state.summary = undefined;
    if (!state.sandbox?.path) {
      return this.#markReplayFailed(state, 'summarize', 'A Conduit sandbox path is required before starting a run.');
    }
    if (state.verificationResults.length === 0) {
      state.status = 'failed';
      state.error = missingVerificationMessage;
      state.updatedAt = this.#now();
      await this.#completeStage(state, 'summarize', state.error, 'failed');
      return state;
    }

    try {
      state.changedFiles = await this.#repoService.listChangedFiles(state.sandbox.path);
      state.summary = this.#buildSummary(state.changedFiles, state.verificationResults, state.selectedSkill);
    } catch (error) {
      return this.#markReplayFailed(state, 'summarize', error);
    }

    const verificationPassed = state.verificationResults.every((result) => result.status === 'passed');
    state.status = verificationPassed ? 'succeeded' : 'failed';
    if (verificationPassed) state.error = undefined;
    else state.error = 'Conduit verification failed.';
    await this.#completeStage(state, 'summarize', 'Prepared PR-ready handoff summary.');
    state.updatedAt = this.#now();
    return state;
  }

  async #markReplayFailed(
    state: ConduitDeliveryRunState,
    stage: ConduitDeliveryStage,
    error: unknown
  ): Promise<ConduitDeliveryRunState> {
    state.status = 'failed';
    state.error = error instanceof Error ? error.message : String(error);
    state.updatedAt = this.#now();
    await this.#completeStage(state, stage, state.error, 'failed');
    return state;
  }

  async #replayVerification(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    state.status = 'running';
    state.error = undefined;
    state.changedFiles = [];
    state.verificationResults = [];
    state.summary = undefined;
    await this.#appendEvent(state, 'verify', 'running', 'Replay requested from verify stage.');

    let skill: ConduitDeliverySkill | NonNullable<ConduitDeliveryRunState['selectedSkill']>;
    try {
      if (!state.sandbox?.path) throw new Error('A Conduit sandbox path is required before starting a run.');
      skill = state.selectedSkill ?? this.#selectReplaySkill(state);
      state.verificationResults = await this.#verifier.run(state.sandbox.path, skill.verificationCommands);
    } catch (error) {
      return this.#markReplayFailed(state, 'verify', error);
    }

    return this.#completeVerificationAndSummary(state);
  }

  async #replaySummary(state: ConduitDeliveryRunState): Promise<ConduitDeliveryRunState> {
    state.status = 'running';
    state.error = undefined;
    state.summary = undefined;
    await this.#appendEvent(state, 'summarize', 'running', 'Replay requested from summary stage.');
    return this.#rebuildSummaryFromExistingVerification(
      state,
      'Conduit verification results are required before summary replay.'
    );
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
      state.summary = this.#buildSummary(state.changedFiles, state.verificationResults, skill);
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
    verificationResults: ConduitVerificationResult[],
    skill?: ConduitDeliveryRunState['selectedSkill']
  ): ConduitPrReadySummary {
    const changedFileList = changedFiles.map((file) => `- ${file.path} (${file.status})`).join('\n');
    const verificationList = verificationResults
      .map((result) => `- ${result.command} ${result.args.join(' ')}: ${result.status} (exit ${result.exitCode})`)
      .join('\n');
    const descriptor = this.#summaryDescriptor(skill);
    const gitAddTargets = changedFiles.map((file) => file.path).join(' ');

    return {
      title: descriptor.title,
      body: [
        '## Summary',
        ...descriptor.summaryBullets,
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
        `git checkout -b ${descriptor.branch}`,
        `git add ${gitAddTargets}`,
        `git commit -m "${descriptor.title}"`,
        `git push -u origin ${descriptor.branch}`,
        `gh pr create --title "${descriptor.title}" --body-file PR_BODY.md`,
      ],
    };
  }

  #summaryDescriptor(skill?: ConduitDeliveryRunState['selectedSkill']): {
    title: string;
    branch: string;
    summaryBullets: string[];
  } {
    if (skill?.id === CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID) {
      return {
        title: 'feat: show article preview reading statistics',
        branch: 'feat/article-preview-reading-stats',
        summaryBullets: [
          '- Show word count and estimated reading time on Conduit article preview cards.',
          '- Preserve existing preview-card metadata, favorite behavior, routing state, tags, loading, and empty states.',
        ],
      };
    }
    if (skill?.id === CONDUIT_ARTICLE_COMMENT_COUNT_SKILL_ID) {
      return {
        title: 'feat: add article comments count',
        branch: 'feat/article-comments-count',
        summaryBullets: [
          '- Add backend commentsCount serialization for Conduit article API responses.',
          '- Render commentsCount on Conduit article detail pages with backend and frontend coverage.',
        ],
      };
    }
    if (skill?.id !== CONDUIT_READING_STATS_SKILL_ID) {
      return {
        title: 'feat: update conduit delivery workflow',
        branch: 'feat/conduit-delivery-update',
        summaryBullets: ['- Apply the selected Conduit delivery Skill and verification handoff.'],
      };
    }

    return {
      title: 'feat: show article reading statistics',
      branch: 'feat/article-reading-stats',
      summaryBullets: [
        '- Show word count and estimated reading time on Conduit article detail pages.',
        '- Add deterministic helper coverage for Markdown body counting.',
      ],
    };
  }

  #clarificationMessage(metrics: ConduitModelCallMetrics): string {
    if (metrics.status === 'missing_config') return `Model configuration missing: ${metrics.error}`;
    if (metrics.status === 'failed') return `Model configuration failed: ${metrics.error}`;
    return 'Model configuration available; deterministic L1 defaults confirmed.';
  }
}
