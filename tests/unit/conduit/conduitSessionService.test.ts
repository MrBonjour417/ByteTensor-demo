/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { ConduitDeliveryRunState } from '@/common/types/conduitDelivery';
import { ConduitSessionService } from '@process/services/conduit/ConduitSessionService';

const createRunState = (status: ConduitDeliveryRunState['status'] = 'succeeded'): ConduitDeliveryRunState => ({
  runId: 'run-1',
  status,
  requirement: 'Show article word count and estimated reading time on Conduit article detail pages.',
  createdAt: 1,
  updatedAt: 2,
  conversationId: 'conversation-1',
  stages: [],
  events: [],
  changedFiles: [],
  verificationResults: [],
});

describe('ConduitSessionService', () => {
  it('enters mode and records an inline PM requirement from /conduit <requirement>', async () => {
    const service = new ConduitSessionService({ now: () => 10, sessionIdFactory: () => 'session-1' });

    const result = await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
      workspacePath: 'D:/conduit',
    });

    expect(result.handled).toBe(true);
    expect(result.session?.status).toBe('ready_to_run');
    expect(result.session?.pmInputs).toEqual(['文章详情页展示字数和预计阅读时间']);
    expect(result.entries.map((entry) => entry.kind)).toEqual(['mode_entered', 'pm_input', 'plan_summary']);
  });

  it('routes normal input to Conduit while the session is active', async () => {
    const service = new ConduitSessionService({ now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({ conversationId: 'conversation-1', input: '/conduit' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '加一个统计信息' });

    expect(result.handled).toBe(true);
    expect(result.session?.status).toBe('clarifying');
    expect(result.entries.map((entry) => entry.kind)).toContain('clarification_question');
    expect(result.entries.map((entry) => entry.content)).toContain('这个统计信息要展示在哪个 Conduit 页面或组件上？');
  });

  it('blocks run for incomplete requirements while staying in clarification mode', async () => {
    const workflow = { startRun: vi.fn(async () => createRunState()), replayRun: vi.fn(async () => createRunState()) };
    const service = new ConduitSessionService({ workflow, now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({ conversationId: 'conversation-1', input: '/conduit' });
    await service.handleInput({ conversationId: 'conversation-1', input: '加一个统计信息' });

    const run = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit run' });
    const followUp = await service.handleInput({ conversationId: 'conversation-1', input: '展示在文章详情页' });

    expect(workflow.startRun).not.toHaveBeenCalled();
    expect(run.session?.status).toBe('clarifying');
    expect(run.session?.error).toBe('Conduit session is not ready to run.');
    expect(followUp.handled).toBe(true);
  });

  it('exits mode and no longer handles normal chat input', async () => {
    const service = new ConduitSessionService({ now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({ conversationId: 'conversation-1', input: '/conduit' });
    await service.handleInput({ conversationId: 'conversation-1', input: '/conduit exit' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: 'normal message' });

    expect(result.handled).toBe(false);
    expect(result.entries).toEqual([]);
  });

  it('runs the existing workflow after the session is ready', async () => {
    const workflow = { startRun: vi.fn(async () => createRunState()), replayRun: vi.fn(async () => createRunState()) };
    const service = new ConduitSessionService({
      workflow,
      now: () => 10,
      sessionIdFactory: () => 'session-1',
    });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
      workspacePath: 'D:/conduit',
    });

    const session = await service.confirmRun({ conversationId: 'conversation-1', sandboxPath: 'D:/conduit' });

    expect(workflow.startRun).toHaveBeenCalledWith({
      requirement: 'Show article word count and estimated reading time on Conduit article detail pages.',
      sandboxPath: 'D:/conduit',
      conversationId: 'conversation-1',
    });
    expect(session.status).toBe('succeeded');
    expect(session.activeRunId).toBe('run-1');
    expect(session.runState?.runId).toBe('run-1');
  });

  it('reports status deterministically for an active session', async () => {
    const service = new ConduitSessionService({ now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({ conversationId: 'conversation-1', input: '/conduit' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit status' });

    expect(result.handled).toBe(true);
    expect(result.entries.map((entry) => entry.kind)).toEqual(['status']);
    expect(result.entries[0]?.content).toBe('Conduit session status: active_collecting_pm_input');
  });

  it('records workflow rejections without leaving the session running', async () => {
    const workflow = {
      startRun: vi.fn(async () => {
        throw new Error('A Conduit sandbox path is required before starting a run.');
      }),
      replayRun: vi.fn(async () => createRunState()),
    };
    const service = new ConduitSessionService({ workflow, now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
    });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit run' });

    expect(result.handled).toBe(true);
    expect(result.session?.status).toBe('failed');
    expect(result.session?.error).toBe('A Conduit sandbox path is required before starting a run.');
  });

  it('handles normal input while a run is in progress so it cannot leak to normal chat', async () => {
    const runningRun = (
      Promise as typeof Promise & {
        withResolvers<T>(): {
          promise: Promise<T>;
          resolve(value: T | PromiseLike<T>): void;
          reject(reason?: unknown): void;
        };
      }
    ).withResolvers<ConduitDeliveryRunState>();
    const workflow = {
      startRun: vi.fn(() => runningRun.promise),
      replayRun: vi.fn(async () => createRunState()),
    };
    const service = new ConduitSessionService({ workflow, now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
    });

    const run = service.handleInput({ conversationId: 'conversation-1', input: '/conduit run' });
    await Promise.resolve();
    const note = await service.handleInput({ conversationId: 'conversation-1', input: '补充一个运行中的备注' });
    runningRun.resolve(createRunState());
    await run;

    expect(note.handled).toBe(true);
    expect(note.session?.notes).toEqual(['补充一个运行中的备注']);
    expect(note.entries.map((entry) => entry.kind)).toEqual(['status']);
    expect(note.entries[0]?.content).toBe('Conduit delivery is running; input was recorded as a note.');
  });

  it('preserves running sessions when run is requested again', async () => {
    const runningRun = (
      Promise as typeof Promise & {
        withResolvers<T>(): {
          promise: Promise<T>;
          resolve(value: T | PromiseLike<T>): void;
          reject(reason?: unknown): void;
        };
      }
    ).withResolvers<ConduitDeliveryRunState>();
    const workflow = {
      startRun: vi.fn(() => runningRun.promise),
      replayRun: vi.fn(async () => createRunState()),
    };
    const service = new ConduitSessionService({ workflow, now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
    });

    const run = service.handleInput({ conversationId: 'conversation-1', input: '/conduit run' });
    await Promise.resolve();
    const duplicate = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit run' });
    const duplicateStatus = duplicate.session?.status;
    const duplicateError = duplicate.session?.error;
    const note = await service.handleInput({ conversationId: 'conversation-1', input: '运行中补充' });
    runningRun.resolve(createRunState());
    await run;

    expect(workflow.startRun).toHaveBeenCalledTimes(1);
    expect(duplicateStatus).toBe('running');
    expect(duplicateError).toBe('Conduit run is already in progress.');
    expect(note.handled).toBe(true);
    expect(note.session?.notes).toEqual(['运行中补充']);
  });

  it('blocks state-changing commands while a run is in progress', async () => {
    const runningRun = (
      Promise as typeof Promise & {
        withResolvers<T>(): {
          promise: Promise<T>;
          resolve(value: T | PromiseLike<T>): void;
          reject(reason?: unknown): void;
        };
      }
    ).withResolvers<ConduitDeliveryRunState>();
    const workflow = {
      startRun: vi.fn(() => runningRun.promise),
      replayRun: vi.fn(async () => createRunState()),
    };
    const service = new ConduitSessionService({ workflow, now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
    });
    const beforeRunInputs = [...(service.getSession('conversation-1')?.pmInputs ?? [])];

    const run = service.handleInput({ conversationId: 'conversation-1', input: '/conduit run' });
    await Promise.resolve();
    const change = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit 新需求' });
    const changeStatus = change.session?.status;
    const changeInputs = [...(change.session?.pmInputs ?? [])];
    runningRun.resolve(createRunState());
    await run;

    expect(changeStatus).toBe('running');
    expect(changeInputs).toEqual(beforeRunInputs);
    expect(change.entries[0]?.content).toBe('Conduit run is already in progress.');
  });

  it('returns deterministic help text', async () => {
    const service = new ConduitSessionService({ now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({ conversationId: 'conversation-1', input: '/conduit' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit help' });

    expect(result.handled).toBe(true);
    expect(result.entries.map((entry) => entry.kind)).toEqual(['status']);
    expect(result.entries[0]?.content).toBe(
      '/conduit, /conduit <requirement>, /conduit run, /conduit status, /conduit revise, /conduit replay <plan|patch|verify|summary>, /conduit exit'
    );
  });

  it('returns deterministic errors for unknown commands', async () => {
    const service = new ConduitSessionService({ now: () => 10, sessionIdFactory: () => 'session-1' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit -x' });

    expect(result.handled).toBe(true);
    expect(result.session?.status).toBe('active_collecting_pm_input');
    expect(result.entries.map((entry) => entry.kind)).toEqual(['mode_entered', 'error']);
    expect(result.entries[1]?.content).toBe('Unsupported Conduit command: -x');
  });

  it('replays a deterministic workflow stage command against the active run', async () => {
    const workflow = { startRun: vi.fn(async () => createRunState()), replayRun: vi.fn(async () => createRunState()) };
    const service = new ConduitSessionService({
      workflow,
      now: () => 10,
      sessionIdFactory: () => 'session-1',
    });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
      workspacePath: 'D:/conduit',
    });
    await service.confirmRun({ conversationId: 'conversation-1', sandboxPath: 'D:/conduit' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit replay verify' });

    expect(workflow.replayRun).toHaveBeenCalledWith({ runId: 'run-1', stage: 'verify' });
    expect(result.handled).toBe(true);
    expect(result.entries.map((entry) => entry.kind)).toEqual(['status']);
    expect(result.entries[0]?.content).toBe('Replayed Conduit verify stage; session status: succeeded');
  });

  it('records replay workflow rejections without leaving the session running', async () => {
    const workflow = {
      startRun: vi.fn(async () => createRunState()),
      replayRun: vi.fn(async () => {
        throw new Error('replay store failed');
      }),
    };
    const service = new ConduitSessionService({ workflow, now: () => 10, sessionIdFactory: () => 'session-1' });
    await service.handleInput({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
      workspacePath: 'D:/conduit',
    });
    await service.confirmRun({ conversationId: 'conversation-1', sandboxPath: 'D:/conduit' });

    const result = await service.handleInput({ conversationId: 'conversation-1', input: '/conduit replay verify' });

    expect(result.handled).toBe(true);
    expect(result.session?.status).toBe('failed');
    expect(result.session?.error).toBe('replay store failed');
  });
});
