/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  CONDUIT_DELIVERY_STAGE_ORDER,
  CONDUIT_OFFICIAL_REPOSITORY_URL,
  CONDUIT_READING_STATS_SKILL_ID,
  type ConduitDeliveryRunState,
  type ConduitConversationEntry,
  type ConduitSessionState,
} from '@/common/types/conduitDelivery';

describe('conduitDelivery shared contract', () => {
  it('keeps the workflow stages in delivery order', () => {
    expect(CONDUIT_DELIVERY_STAGE_ORDER).toEqual([
      'intake',
      'clarify',
      'plan',
      'locate',
      'patch',
      'verify',
      'summarize',
    ]);
  });

  it('uses the official Conduit repository and stable reading-stat Skill ID', () => {
    expect(CONDUIT_OFFICIAL_REPOSITORY_URL).toBe('https://github.com/TonyMckes/conduit-realworld-example-app');
    expect(CONDUIT_READING_STATS_SKILL_ID).toBe('conduit.article-reading-stats');
  });

  it('allows renderer and main process to share a run state shape', () => {
    const state: ConduitDeliveryRunState = {
      runId: 'run-1',
      status: 'running',
      requirement: 'show article reading time',
      createdAt: 1,
      updatedAt: 1,
      stages: [],
      events: [],
      changedFiles: [],
      verificationResults: [],
    };

    expect(state.status).toBe('running');
    expect(state.changedFiles).toEqual([]);
  });

  it('represents a conversation-scoped Conduit session with DSL and display entries', () => {
    const session = {
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      status: 'ready_to_run',
      createdAt: 1,
      updatedAt: 2,
      pmInputs: ['文章详情页展示字数和预计阅读时间'],
      clarificationQuestions: [],
      requirementDsl: {
        level: 'L1',
        title: 'Article reading statistics',
        userGoal: 'Show article word count and estimated reading time on article detail pages.',
        targetSurface: 'article_detail',
        acceptanceCriteria: [
          'Show word count when body exists.',
          'Show reading time rounded up to at least one minute.',
        ],
        requiresBackend: false,
        requiresDatabase: false,
        verification: ['Run article reading stats helper test.', 'Run root test command.'],
      },
      planSummary: {
        summary: 'Add a frontend helper and render the result on Article detail.',
        targetFiles: ['frontend/src/routes/Article/Article.jsx'],
        risks: ['Markdown counting must not include formatting syntax.'],
      },
    } satisfies ConduitSessionState;

    const entry = {
      id: 'entry-1',
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      role: 'conduit',
      kind: 'plan_summary',
      content: 'Ready to run.',
      createdAt: 3,
    } satisfies ConduitConversationEntry;

    expect(session.status).toBe('ready_to_run');
    expect(entry.kind).toBe('plan_summary');
  });
});
