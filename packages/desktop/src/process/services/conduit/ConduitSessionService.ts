/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseConduitCommand } from '@/common/chat/conduitCommands';
import type {
  ConduitConfirmRunRequest,
  ConduitConversationEntry,
  ConduitDeliveryReplayRequest,
  ConduitDeliveryRunState,
  ConduitDeliveryStartRunRequest,
  ConduitSessionCommandResult,
  ConduitSessionInputRequest,
  ConduitSessionState,
  ConduitSessionStatus,
  ConduitStageReplayRequest,
} from '@/common/types/conduitDelivery';
import { ConduitClarificationAgent } from './ConduitClarificationAgent';
import type { ConduitClarifierResult } from './ConduitClarifier';

type WorkflowLike = {
  startRun(request: ConduitDeliveryStartRunRequest): Promise<ConduitDeliveryRunState>;
  replayRun(request: ConduitDeliveryReplayRequest): Promise<ConduitDeliveryRunState>;
};

type ClarifierResultWithMetrics = ConduitClarifierResult & {
  modelMetrics?: ConduitSessionState['modelMetrics'];
};

type ClarifierLike = {
  analyze(pmInputs: string[]): ClarifierResultWithMetrics | Promise<ClarifierResultWithMetrics>;
};

type ConduitSessionServiceOptions = {
  workflow?: WorkflowLike;
  clarifier?: ClarifierLike;
  now?: () => number;
  sessionIdFactory?: () => string;
};

const HELP_TEXT =
  '/conduit, /conduit <requirement>, /conduit run, /conduit status, /conduit revise, /conduit replay <plan|patch|verify|summary>, /conduit exit';

const MIN_RECALL_SIMILARITY = 0.4;
const DEMAND_TOKEN_STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with']);

export class ConduitSessionService {
  readonly #workflow?: WorkflowLike;
  readonly #clarifier: ClarifierLike;
  readonly #now: () => number;
  readonly #sessionIdFactory: () => string;
  readonly #sessions = new Map<string, ConduitSessionState>();

  constructor(options: ConduitSessionServiceOptions = {}) {
    this.#workflow = options.workflow;
    this.#clarifier = options.clarifier ?? new ConduitClarificationAgent();
    this.#now = options.now ?? Date.now;
    this.#sessionIdFactory = options.sessionIdFactory ?? (() => `conduit-session-${this.#now().toString(36)}`);
  }

  getSession(conversationId: string): ConduitSessionState | undefined {
    return this.#sessions.get(conversationId);
  }

  async handleInput(request: ConduitSessionInputRequest): Promise<ConduitSessionCommandResult> {
    const command = parseConduitCommand(request.input);
    const existing = this.#sessions.get(request.conversationId);

    if (
      existing?.status === 'running' &&
      command.kind !== 'none' &&
      command.kind !== 'status' &&
      command.kind !== 'help'
    ) {
      existing.error = 'Conduit run is already in progress.';
      existing.updatedAt = this.#now();
      return {
        handled: true,
        session: existing,
        entries: [this.#entry(existing, 'conduit', 'status', 'Conduit run is already in progress.')],
      };
    }

    if (command.kind === 'none') {
      if (!existing) return { handled: false, entries: [] };
      if (existing.status === 'running') {
        existing.updatedAt = this.#now();
        const note = request.input.trim();
        existing.notes = note ? [...(existing.notes ?? []), note] : existing.notes;
        return {
          handled: true,
          session: existing,
          entries: [
            this.#entry(existing, 'conduit', 'status', 'Conduit delivery is running; input was recorded as a note.'),
          ],
        };
      }
      if (!this.#acceptsPmInput(existing.status)) return { handled: false, entries: [] };
      return { handled: true, session: existing, entries: await this.#recordPmInput(existing, request.input) };
    }

    if (command.kind === 'enter') {
      const session = this.#ensureActiveSession(request.conversationId);
      const entries = this.#modeEntryIfNeeded(session);
      if (command.requirement) entries.push(...(await this.#recordPmInput(session, command.requirement)));
      return { handled: true, session, entries };
    }

    const session =
      existing && existing.status !== 'exited' ? existing : this.#ensureActiveSession(request.conversationId);
    const entries = existing && existing.status !== 'exited' ? [] : this.#modeEntryIfNeeded(session);

    if (command.kind === 'status') {
      entries.push(this.#entry(session, 'conduit', 'status', this.#statusText(session)));
      return { handled: true, session, entries };
    }

    if (command.kind === 'help') {
      entries.push(this.#entry(session, 'conduit', 'status', HELP_TEXT));
      return { handled: true, session, entries };
    }

    if (command.kind === 'revise') {
      session.status = 'clarifying';
      session.requirementDsl = undefined;
      session.planSummary = undefined;
      session.error = undefined;
      session.updatedAt = this.#now();
      entries.push(this.#entry(session, 'conduit', 'status', 'Conduit session returned to clarification.'));
      return { handled: true, session, entries };
    }

    if (command.kind === 'exit') {
      session.status = 'exited';
      session.updatedAt = this.#now();
      entries.push(this.#entry(session, 'conduit', 'status', 'Conduit delivery mode exited.'));
      return { handled: true, session, entries };
    }

    if (command.kind === 'run') {
      const runSession = await this.confirmRun({
        conversationId: session.conversationId,
        sandboxPath: request.workspacePath,
      });
      entries.push(this.#entry(runSession, 'conduit', 'status', this.#statusText(runSession)));
      return { handled: true, session: runSession, entries };
    }

    if (command.kind === 'replay') {
      const replaySession = await this.replayStage({ conversationId: session.conversationId, stage: command.stage });
      entries.push(
        this.#entry(
          replaySession,
          'conduit',
          'status',
          `Replayed Conduit ${command.stage} stage; session status: ${replaySession.status}`
        )
      );
      return { handled: true, session: replaySession, entries };
    }

    const error = `Unsupported Conduit command: ${command.command}`;
    session.error = error;
    session.updatedAt = this.#now();
    entries.push(this.#entry(session, 'conduit', 'error', error));
    return { handled: true, session, entries };
  }

  async confirmRun(request: ConduitConfirmRunRequest): Promise<ConduitSessionState> {
    const session = this.#requireSession(request.conversationId);
    if (session.status === 'running') {
      session.error = 'Conduit run is already in progress.';
      session.updatedAt = this.#now();
      return session;
    }
    if (!session.requirementDsl || session.status !== 'ready_to_run') {
      session.status = 'clarifying';
      session.error = 'Conduit session is not ready to run.';
      session.updatedAt = this.#now();
      return session;
    }
    if (!this.#workflow) throw new Error('Conduit workflow service is required to run a session.');

    session.status = 'running';
    session.error = undefined;
    session.updatedAt = this.#now();
    try {
      const runState = await this.#workflow.startRun({
        requirement: session.requirementDsl.userGoal,
        sandboxPath: request.sandboxPath,
        conversationId: request.conversationId,
      });
      session.activeRunId = runState.runId;
      session.runState = runState;
      session.status = this.#sessionStatusForRun(runState.status);
      session.error = runState.error;
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : String(error);
    }
    session.updatedAt = this.#now();
    return session;
  }

  async replayStage(request: ConduitStageReplayRequest): Promise<ConduitSessionState> {
    const session = this.#requireSession(request.conversationId);
    if (!session.activeRunId) {
      session.error = `No Conduit run is available for ${request.stage} replay.`;
      session.updatedAt = this.#now();
      return session;
    }
    if (!this.#workflow) throw new Error('Conduit workflow service is required to replay a session.');

    session.status = 'running';
    session.error = undefined;
    session.updatedAt = this.#now();
    try {
      const runState = await this.#workflow.replayRun({ runId: session.activeRunId, stage: request.stage });
      session.runState = runState;
      session.status = this.#sessionStatusForRun(runState.status);
      session.error = runState.error;
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : String(error);
    }
    session.updatedAt = this.#now();
    return session;
  }

  #ensureActiveSession(conversationId: string): ConduitSessionState {
    const existing = this.#sessions.get(conversationId);
    if (existing && existing.status !== 'exited') return existing;

    const now = this.#now();
    const session: ConduitSessionState = {
      sessionId: this.#sessionIdFactory(),
      conversationId,
      status: 'active_collecting_pm_input',
      createdAt: now,
      updatedAt: now,
      pmInputs: [],
      clarificationQuestions: [],
      entries: [],
    };
    this.#sessions.set(conversationId, session);
    return session;
  }

  #requireSession(conversationId: string): ConduitSessionState {
    const session = this.#sessions.get(conversationId);
    if (!session) throw new Error(`No active Conduit session for conversation ${conversationId}.`);
    return session;
  }

  async #recordPmInput(session: ConduitSessionState, input: string): Promise<ConduitConversationEntry[]> {
    const pmInput = input.trim();
    session.pmInputs.push(pmInput);
    const entries = [this.#entry(session, 'user', 'pm_input', pmInput)];
    const analysis = await this.#clarifier.analyze(session.pmInputs);
    session.modelMetrics = analysis.modelMetrics ?? session.modelMetrics;
    if (analysis.status === 'needs_clarification') {
      session.status = 'clarifying';
      session.requirementDsl = undefined;
      session.planSummary = undefined;
      session.recalledDemands = undefined;
      session.clarificationQuestions = analysis.questions;
      entries.push(
        ...analysis.questions.map((question) => this.#entry(session, 'conduit', 'clarification_question', question))
      );
    } else {
      session.status = 'ready_to_run';
      session.clarificationQuestions = [];
      session.requirementDsl = analysis.dsl;
      session.planSummary = {
        summary: 'Add a frontend helper and render article reading statistics on the article detail page.',
        targetFiles: [
          'frontend/src/helpers/articleReadingStats.js',
          'frontend/src/helpers/articleReadingStats.test.js',
          'frontend/src/routes/Article/Article.jsx',
        ],
        risks: ['Markdown syntax must not inflate the word count.'],
      };
      session.recalledDemands = this.#recallDemands(session, session.pmInputs.join('\n'));
      session.error = undefined;
      entries.push(this.#entry(session, 'conduit', 'plan_summary', 'Requirement is ready. Confirm with /conduit run.'));
      entries.push(
        ...session.recalledDemands.map((demand) =>
          this.#entry(
            session,
            'conduit',
            'demand_recalled',
            `Recalled similar demand from ${demand.sessionId}: ${demand.summary}`
          )
        )
      );
    }

    session.updatedAt = this.#now();
    return entries;
  }

  #modeEntryIfNeeded(session: ConduitSessionState): ConduitConversationEntry[] {
    if ((session.entries?.length ?? 0) > 0) return [];
    return [this.#entry(session, 'conduit', 'mode_entered', 'Conduit delivery mode entered.')];
  }

  #recallDemands(
    session: ConduitSessionState,
    requirement: string
  ): NonNullable<ConduitSessionState['recalledDemands']> {
    const requirementTokens = tokenizeDemand(requirement);
    if (requirementTokens.size === 0) return [];

    return Array.from(this.#sessions.values())
      .filter((candidate) => candidate.sessionId !== session.sessionId && candidate.status === 'succeeded')
      .map((candidate) => {
        const candidateRequirement = candidate.runState?.requirement ?? candidate.requirementDsl?.userGoal ?? '';
        const similarity = demandSimilarity(
          requirementTokens,
          tokenizeDemand(candidate.pmInputs.join('\n') || candidateRequirement)
        );
        return {
          sessionId: candidate.sessionId,
          requirement: candidateRequirement,
          summary: candidate.runState?.summary?.title ?? candidate.planSummary?.summary ?? candidateRequirement,
          similarity,
        };
      })
      .filter((demand) => demand.requirement.length > 0 && demand.similarity >= MIN_RECALL_SIMILARITY)
      .sort((left, right) => right.similarity - left.similarity || left.sessionId.localeCompare(right.sessionId));
  }

  #entry(
    session: ConduitSessionState,
    role: ConduitConversationEntry['role'],
    kind: ConduitConversationEntry['kind'],
    content: string
  ): ConduitConversationEntry {
    const entry: ConduitConversationEntry = {
      id: `${session.sessionId}-entry-${(session.entries?.length ?? 0) + 1}`,
      sessionId: session.sessionId,
      conversationId: session.conversationId,
      role,
      kind,
      content,
      createdAt: this.#now(),
    };
    session.entries = [...(session.entries ?? []), entry];
    return entry;
  }

  #acceptsPmInput(status: ConduitSessionStatus): boolean {
    return (
      status === 'active_collecting_pm_input' ||
      status === 'clarifying' ||
      status === 'ready_to_confirm' ||
      status === 'ready_to_run' ||
      status === 'paused'
    );
  }

  #sessionStatusForRun(status: ConduitDeliveryRunState['status']): ConduitSessionStatus {
    if (status === 'succeeded') return 'succeeded';
    if (status === 'running') return 'running';
    if (status === 'idle') return 'ready_to_run';
    return 'failed';
  }

  #statusText(session: ConduitSessionState): string {
    return `Conduit session status: ${session.status}`;
  }
}

function tokenizeDemand(requirement: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of requirement.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const token = match[0];
    if (token.length > 1 && !DEMAND_TOKEN_STOP_WORDS.has(token)) tokens.add(token);
  }
  return tokens;
}

function demandSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / (left.size + right.size - overlap);
}
