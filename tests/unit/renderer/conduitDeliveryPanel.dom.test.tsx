/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConduitDeliveryRunState, ConduitSessionState } from '@/common/types/conduitDelivery';
import ConduitDeliveryPanel from '@/renderer/pages/conversation/components/ConduitDeliveryPanel';

const conduitMocks = vi.hoisted(() => ({
  bindSandbox: vi.fn(),
  startRun: vi.fn(),
  getSessionState: vi.fn(),
  confirmSessionRun: vi.fn(),
  stateHandlers: [] as Array<(state: ConduitDeliveryRunState) => void>,
  sessionHandlers: [] as Array<(session: ConduitSessionState) => void>,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conduitDelivery: {
      bindSandbox: { invoke: conduitMocks.bindSandbox },
      startRun: { invoke: conduitMocks.startRun },
      getSessionState: { invoke: conduitMocks.getSessionState },
      confirmSessionRun: { invoke: conduitMocks.confirmSessionRun },
      stateChanged: {
        on: vi.fn((handler: (state: ConduitDeliveryRunState) => void) => {
          conduitMocks.stateHandlers.push(handler);
          return vi.fn();
        }),
      },
      sessionChanged: {
        on: vi.fn((handler: (session: ConduitSessionState) => void) => {
          conduitMocks.sessionHandlers.push(handler);
          return vi.fn();
        }),
      },
    },
  },
}));

const translations: Record<string, string> = {
  'conversation.conduitDelivery.button': 'Conduit Delivery',
  'conversation.conduitDelivery.title': 'Conduit Delivery Workspace',
  'conversation.conduitDelivery.sandboxPathLabel': 'Sandbox path',
  'conversation.conduitDelivery.sandboxPathPlaceholder': 'Path to Conduit sandbox',
  'conversation.conduitDelivery.requirementLabel': 'PM requirement',
  'conversation.conduitDelivery.requirementPlaceholder': 'Describe the Conduit change',
  'conversation.conduitDelivery.bindSandbox': 'Bind sandbox',
  'conversation.conduitDelivery.startRun': 'Start L1 run',
  'conversation.conduitDelivery.verificationFailed': 'Verification failed',
  'conversation.conduitDelivery.stageTimeline': 'Stage timeline',
  'conversation.conduitDelivery.changedFiles': 'Changed files',
  'conversation.conduitDelivery.verificationResults': 'Verification results',
  'conversation.conduitDelivery.prSummary': 'PR summary',
  'conversation.conduitDelivery.requirementDsl': 'Requirement DSL',
  'conversation.conduitDelivery.planSummary': 'Plan summary',
};

const emitSessionChanged = (session: ConduitSessionState) => {
  const handler = conduitMocks.sessionHandlers.at(-1);
  if (!handler) throw new Error('sessionChanged handler was not registered');
  act(() => handler(session));
};

const emitStateChanged = (state: ConduitDeliveryRunState) => {
  const handler = conduitMocks.stateHandlers.at(-1);
  if (!handler) throw new Error('stateChanged handler was not registered');
  act(() => handler(state));
};

const createSession = (overrides: Partial<ConduitSessionState> = {}): ConduitSessionState => ({
  sessionId: 'session-1',
  conversationId: 'conversation-1',
  status: 'ready_to_run',
  createdAt: 1,
  updatedAt: 2,
  pmInputs: [],
  clarificationQuestions: [],
  ...overrides,
});

const createRunState = (overrides: Partial<ConduitDeliveryRunState> = {}): ConduitDeliveryRunState => ({
  runId: 'run-1',
  status: 'running',
  requirement: 'show article word count',
  createdAt: 1,
  updatedAt: 1,
  conversationId: 'conversation-1',
  stages: [],
  events: [],
  changedFiles: [],
  verificationResults: [],
  ...overrides,
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe('ConduitDeliveryPanel', () => {
  beforeEach(() => {
    conduitMocks.bindSandbox.mockReset();
    conduitMocks.startRun.mockReset();
    conduitMocks.getSessionState.mockReset();
    conduitMocks.confirmSessionRun.mockReset();
    conduitMocks.getSessionState.mockResolvedValue(undefined);
    conduitMocks.stateHandlers.length = 0;
    conduitMocks.sessionHandlers.length = 0;
  });

  it('opens as a process cockpit when the conversation session changes', async () => {
    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitSessionChanged(
      createSession({
        requirementDsl: {
          level: 'L1',
          title: 'Article reading statistics',
          userGoal: 'Show article word count and estimated reading time on Conduit article detail pages.',
          targetSurface: 'article_detail',
          acceptanceCriteria: ['Show word count when body exists.'],
          requiresBackend: false,
          requiresDatabase: false,
          verification: ['Run helper tests.'],
        },
        planSummary: {
          summary: 'Add helper and render reading stats.',
          targetFiles: ['frontend/src/routes/Article/Article.jsx'],
          risks: ['Markdown syntax must not inflate counts.'],
        },
      })
    );

    expect(await screen.findByText('Article reading statistics')).toBeInTheDocument();
    expect(screen.getByText('- Show word count when body exists.')).toBeInTheDocument();
    expect(screen.getByText('Add helper and render reading stats.')).toBeInTheDocument();
    expect(screen.getByText('frontend/src/routes/Article/Article.jsx')).toBeInTheDocument();
  });

  it('hydrates an existing active session on mount', async () => {
    conduitMocks.getSessionState.mockResolvedValue(
      createSession({
        requirementDsl: {
          level: 'L1',
          title: 'Hydrated article reading statistics',
          userGoal: 'Show article word count and estimated reading time on Conduit article detail pages.',
          targetSurface: 'article_detail',
          acceptanceCriteria: ['Show word count when body exists.'],
          requiresBackend: false,
          requiresDatabase: false,
          verification: ['Run helper tests.'],
        },
      })
    );

    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    expect(await screen.findByText('Hydrated article reading statistics')).toBeInTheDocument();
    expect(conduitMocks.getSessionState).toHaveBeenCalledWith({ conversationId: 'conversation-1' });
  });

  it('renders fresh run-state events over embedded session run state', async () => {
    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitSessionChanged(
      createSession({
        activeRunId: 'run-1',
        runState: createRunState({
          runId: 'run-1',
          changedFiles: [{ path: 'frontend/src/helpers/oldReadingStats.js', status: 'added' }],
        }),
      })
    );
    expect(await screen.findByText('frontend/src/helpers/oldReadingStats.js')).toBeInTheDocument();

    emitStateChanged(
      createRunState({
        runId: 'run-1',
        changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
      })
    );

    expect(await screen.findByText('frontend/src/helpers/articleReadingStats.js')).toBeInTheDocument();
    expect(screen.queryByText('frontend/src/helpers/oldReadingStats.js')).not.toBeInTheDocument();
  });

  it('clears cockpit state when the conversation changes', async () => {
    const { rerender } = render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitSessionChanged(
      createSession({
        requirementDsl: {
          level: 'L1',
          title: 'Article reading statistics',
          userGoal: 'Show article word count and estimated reading time on Conduit article detail pages.',
          targetSurface: 'article_detail',
          acceptanceCriteria: ['Show word count when body exists.'],
          requiresBackend: false,
          requiresDatabase: false,
          verification: ['Run helper tests.'],
        },
      })
    );

    expect(await screen.findByText('Article reading statistics')).toBeInTheDocument();

    rerender(<ConduitDeliveryPanel conversationId='conversation-2' />);

    await waitFor(() => expect(screen.queryByText('Article reading statistics')).not.toBeInTheDocument());
  });

  it('ignores run-state events from other conversations', () => {
    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitStateChanged(
      createRunState({
        conversationId: 'conversation-2',
        changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
      })
    );

    expect(screen.queryByText('frontend/src/helpers/articleReadingStats.js')).not.toBeInTheDocument();
  });

  it('ignores run-state events when no conversation is selected', () => {
    render(<ConduitDeliveryPanel />);

    emitStateChanged(
      createRunState({
        conversationId: 'conversation-1',
        changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
      })
    );

    expect(screen.queryByText('frontend/src/helpers/articleReadingStats.js')).not.toBeInTheDocument();
  });

  it('keeps the active session visible when only workspace changes', async () => {
    const { rerender } = render(
      <ConduitDeliveryPanel conversationId='conversation-1' workspacePath='D:/workspace-a' />
    );

    emitSessionChanged(
      createSession({
        requirementDsl: {
          level: 'L1',
          title: 'Article reading statistics',
          userGoal: 'Show article word count and estimated reading time on Conduit article detail pages.',
          targetSurface: 'article_detail',
          acceptanceCriteria: ['Show word count when body exists.'],
          requiresBackend: false,
          requiresDatabase: false,
          verification: ['Run helper tests.'],
        },
      })
    );

    expect(await screen.findByText('Article reading statistics')).toBeInTheDocument();

    rerender(<ConduitDeliveryPanel conversationId='conversation-1' workspacePath='D:/workspace-b' />);

    expect(await screen.findByText('Article reading statistics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('D:/workspace-b')).toBeInTheDocument();
  });

  it('resets sandbox path when switching conversations', async () => {
    const { rerender } = render(
      <ConduitDeliveryPanel conversationId='conversation-1' workspacePath='D:/workspace-a' />
    );
    emitSessionChanged(createSession());

    expect(await screen.findByDisplayValue('D:/workspace-a')).toBeInTheDocument();

    rerender(<ConduitDeliveryPanel conversationId='conversation-2' workspacePath='D:/workspace-b' />);
    emitSessionChanged(createSession({ conversationId: 'conversation-2' }));

    expect(await screen.findByDisplayValue('D:/workspace-b')).toBeInTheDocument();
  });

  it('does not reopen from run-state events after the session exits', async () => {
    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitSessionChanged(
      createSession({
        runState: createRunState({
          changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
        }),
      })
    );

    expect(await screen.findByText('frontend/src/helpers/articleReadingStats.js')).toBeInTheDocument();

    emitSessionChanged(createSession({ status: 'exited' }));
    emitStateChanged(
      createRunState({
        changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
      })
    );

    await waitFor(() =>
      expect(screen.queryByText('frontend/src/helpers/articleReadingStats.js')).not.toBeInTheDocument()
    );
  });

  it('binds a sandbox and confirms the session run from the process cockpit', async () => {
    conduitMocks.bindSandbox.mockResolvedValue({
      path: 'D:/conduit',
      repositoryUrl: 'repo',
      packageName: 'conduit',
      boundAt: 1,
    });
    conduitMocks.confirmSessionRun.mockResolvedValue(
      createSession({ runState: createRunState({ status: 'running' }) })
    );

    render(<ConduitDeliveryPanel conversationId='conversation-1' workspacePath='D:/conduit' />);

    emitSessionChanged(createSession());

    fireEvent.change(await screen.findByPlaceholderText('Path to Conduit sandbox'), {
      target: { value: 'D:/conduit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bind sandbox' }));

    await waitFor(() => expect(conduitMocks.bindSandbox).toHaveBeenCalledWith({ path: 'D:/conduit' }));

    fireEvent.click(screen.getByRole('button', { name: 'Start L1 run' }));

    await waitFor(() =>
      expect(conduitMocks.confirmSessionRun).toHaveBeenCalledWith({
        sandboxPath: 'D:/conduit',
        conversationId: 'conversation-1',
      })
    );
    expect(conduitMocks.startRun).not.toHaveBeenCalled();
  });

  it('shows verification failure from same-conversation bridge state updates', async () => {
    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitStateChanged(
      createRunState({
        status: 'failed',
        stages: [{ stage: 'verify', status: 'succeeded', message: 'Conduit verification failed.' }],
        verificationResults: [
          {
            id: 'test',
            command: 'npm',
            args: ['run', 'test'],
            description: 'tests',
            status: 'failed',
            exitCode: 1,
            stdout: '',
            stderr: 'broken',
            startedAt: 1,
            finishedAt: 2,
            durationMs: 1,
          },
        ],
        error: 'Conduit verification failed.',
      })
    );

    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('broken')).toBeInTheDocument();
  });

  it('shows changed files, verification results, and PR-ready summary from session run state', async () => {
    render(<ConduitDeliveryPanel conversationId='conversation-1' />);

    emitSessionChanged(
      createSession({
        status: 'succeeded',
        runState: createRunState({
          status: 'succeeded',
          changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
          verificationResults: [
            {
              id: 'test',
              command: 'npm',
              args: ['run', 'test'],
              description: 'tests',
              status: 'passed',
              exitCode: 0,
              stdout: 'passed',
              stderr: '',
              startedAt: 1,
              finishedAt: 2,
              durationMs: 1,
            },
          ],
          summary: {
            title: 'feat: show article reading statistics',
            body: 'PR body',
            changedFiles: [{ path: 'frontend/src/helpers/articleReadingStats.js', status: 'added' }],
            verificationResults: [],
            manualCommands: ['git checkout -b feat/article-reading-stats'],
          },
        }),
      })
    );

    expect(await screen.findByText('Changed files')).toBeInTheDocument();
    expect(screen.getByText('frontend/src/helpers/articleReadingStats.js')).toBeInTheDocument();
    expect(screen.getByText('Verification results')).toBeInTheDocument();
    expect(screen.getByText('npm run test: passed')).toBeInTheDocument();
    expect(screen.getByText('PR summary')).toBeInTheDocument();
    expect(screen.getByText('feat: show article reading statistics')).toBeInTheDocument();
    expect(screen.getByText('git checkout -b feat/article-reading-stats')).toBeInTheDocument();
  });
});
