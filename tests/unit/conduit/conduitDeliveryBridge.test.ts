/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initConduitDeliveryBridge } from '@process/bridge/conduitDeliveryBridge';
import type { ConduitDeliveryRunState, ConduitSandboxBinding, ConduitSessionState } from '@/common/types/conduitDelivery';

type PromiseWithResolversValue<T> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
};

const providerMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  startRun: vi.fn(),
  bindSandbox: vi.fn(),
  cloneSandbox: vi.fn(),
  listRuns: vi.fn(),
  replayRun: vi.fn(),
  getChangedFiles: vi.fn(),
  getSessionState: vi.fn(),
  handleSessionInput: vi.fn(),
  confirmSessionRun: vi.fn(),
  replaySessionStage: vi.fn(),
  sessionChanged: vi.fn(),
  emit: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  configStorageSet: vi.fn(),
  processConfigSet: vi.fn(),
  processConfigGet: vi.fn(),
}));

const sandboxBinding = (): ConduitSandboxBinding => ({
  path: 'D:/conduit',
  repositoryUrl: 'repo',
  packageName: 'conduit-realworld-example-app',
  boundAt: 1,
});

const sessionState = (): ConduitSessionState => ({
  sessionId: 'session-1',
  conversationId: 'conversation-1',
  status: 'ready_to_run',
  createdAt: 1,
  updatedAt: 2,
  pmInputs: [],
  clarificationQuestions: [],
});

const sessionServiceMethods = () => ({
  getSessionState: () => undefined,
  handleSessionInput: vi.fn(async () => ({ handled: false, entries: [] })),
  confirmSessionRun: vi.fn(async () => sessionState()),
  replaySessionStage: vi.fn(async () => sessionState()),
});

const defaultServiceMocks = vi.hoisted(() => ({
  bindSandbox: vi.fn(),
  cloneSandbox: vi.fn(),
  setDefaultSandboxPath: vi.fn(),
  getState: vi.fn(),
  startRun: vi.fn(),
  listRuns: vi.fn(),
  replayRun: vi.fn(),
  getChangedFiles: vi.fn(),
  getSession: vi.fn(),
  handleInput: vi.fn(),
  confirmRun: vi.fn(),
  replayStage: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conduitDelivery: {
      getState: { provider: providerMocks.getState },
      startRun: { provider: providerMocks.startRun },
      bindSandbox: { provider: providerMocks.bindSandbox },
      cloneSandbox: { provider: providerMocks.cloneSandbox },
      listRuns: { provider: providerMocks.listRuns },
      replayRun: { provider: providerMocks.replayRun },
      getChangedFiles: { provider: providerMocks.getChangedFiles },
      getSessionState: { provider: providerMocks.getSessionState },
      handleSessionInput: { provider: providerMocks.handleSessionInput },
      confirmSessionRun: { provider: providerMocks.confirmSessionRun },
      replaySessionStage: { provider: providerMocks.replaySessionStage },
      sessionChanged: { emit: providerMocks.sessionChanged },
      stateChanged: { emit: providerMocks.emit },
    },
  },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    set: storageMocks.configStorageSet,
  },
}));

vi.mock('@process/utils', () => ({
  getDataPath: () => 'D:/data',
}));

vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: {
    get: storageMocks.processConfigGet,
    set: storageMocks.processConfigSet,
  },
}));

vi.mock('@process/services/conduit', () => ({
  ConduitEventStore: vi.fn(function ConduitEventStore() {}),
  ConduitRepoService: vi.fn(function ConduitRepoService() {
    return {
      bindSandbox: defaultServiceMocks.bindSandbox,
      cloneSandbox: defaultServiceMocks.cloneSandbox,
    };
  }),
  ConduitWorkflowService: vi.fn(function ConduitWorkflowService() {
    return {
      setDefaultSandboxPath: defaultServiceMocks.setDefaultSandboxPath,
      getState: defaultServiceMocks.getState,
      startRun: defaultServiceMocks.startRun,
      listRuns: defaultServiceMocks.listRuns,
      replayRun: defaultServiceMocks.replayRun,
      getChangedFiles: defaultServiceMocks.getChangedFiles,
    };
  }),
  ConduitSessionService: vi.fn(function ConduitSessionService() {
    return {
      getSession: defaultServiceMocks.getSession,
      handleInput: defaultServiceMocks.handleInput,
      confirmRun: defaultServiceMocks.confirmRun,
      replayStage: defaultServiceMocks.replayStage,
    };
  }),
}));

describe('conduitDeliveryBridge', () => {
  beforeEach(() => {
    providerMocks.getState.mockClear();
    providerMocks.startRun.mockClear();
    providerMocks.bindSandbox.mockClear();
    providerMocks.cloneSandbox.mockClear();
    providerMocks.listRuns.mockClear();
    providerMocks.replayRun.mockClear();
    providerMocks.getChangedFiles.mockClear();
    providerMocks.getSessionState.mockClear();
    providerMocks.handleSessionInput.mockClear();
    providerMocks.confirmSessionRun.mockClear();
    providerMocks.replaySessionStage.mockClear();
    providerMocks.sessionChanged.mockClear();
    providerMocks.emit.mockClear();

    storageMocks.configStorageSet.mockReset();
    storageMocks.processConfigSet.mockReset();
    storageMocks.processConfigGet.mockReset();
    storageMocks.processConfigGet.mockResolvedValue('D:/persisted-conduit');

    defaultServiceMocks.bindSandbox.mockReset();
    defaultServiceMocks.bindSandbox.mockResolvedValue(sandboxBinding());
    defaultServiceMocks.cloneSandbox.mockReset();
    defaultServiceMocks.cloneSandbox.mockResolvedValue(sandboxBinding());
    defaultServiceMocks.setDefaultSandboxPath.mockClear();
    defaultServiceMocks.getState.mockReset();
    defaultServiceMocks.getState.mockReturnValue(undefined);
    defaultServiceMocks.startRun.mockReset();
    defaultServiceMocks.listRuns.mockReset();
    defaultServiceMocks.listRuns.mockReturnValue([]);
    defaultServiceMocks.replayRun.mockReset();
    defaultServiceMocks.getChangedFiles.mockReset();
    defaultServiceMocks.getChangedFiles.mockReturnValue([]);
    defaultServiceMocks.getSession.mockReset();
    defaultServiceMocks.getSession.mockReturnValue(undefined);
    defaultServiceMocks.handleInput.mockReset();
    defaultServiceMocks.handleInput.mockResolvedValue({ handled: false, entries: [] });
    defaultServiceMocks.confirmRun.mockReset();
    defaultServiceMocks.confirmRun.mockResolvedValue(sessionState());
    defaultServiceMocks.replayStage.mockReset();
    defaultServiceMocks.replayStage.mockResolvedValue(sessionState());
  });

  it('registers every product-level Conduit Delivery provider', () => {
    initConduitDeliveryBridge({
      getState: () => undefined,
      startRun: vi.fn(),
      bindSandbox: vi.fn(),
      cloneSandbox: vi.fn(),
      listRuns: () => [],
      replayRun: vi.fn(),
      getChangedFiles: () => [],
      ...sessionServiceMethods(),
    });

    expect(providerMocks.getState).toHaveBeenCalledTimes(1);
    expect(providerMocks.startRun).toHaveBeenCalledTimes(1);
    expect(providerMocks.bindSandbox).toHaveBeenCalledTimes(1);
    expect(providerMocks.cloneSandbox).toHaveBeenCalledTimes(1);
    expect(providerMocks.listRuns).toHaveBeenCalledTimes(1);
    expect(providerMocks.replayRun).toHaveBeenCalledTimes(1);
    expect(providerMocks.getChangedFiles).toHaveBeenCalledTimes(1);
  });

  it('registers Conduit conversation session providers and emits session state changes', async () => {
    const session = sessionState();

    initConduitDeliveryBridge({
      getState: () => undefined,
      startRun: vi.fn(),
      bindSandbox: vi.fn(),
      cloneSandbox: vi.fn(),
      listRuns: () => [],
      replayRun: vi.fn(),
      getChangedFiles: () => [],
      getSessionState: () => session,
      handleSessionInput: async () => ({ handled: true, session: { ...session, runState: { runId: 'run-1', status: 'succeeded', requirement: 'x', createdAt: 1, updatedAt: 1, stages: [], events: [], changedFiles: [], verificationResults: [] } }, entries: [] }),
      confirmSessionRun: async () => session,
      replaySessionStage: async () => session,
    });

    expect(providerMocks.getSessionState).toHaveBeenCalledTimes(1);
    expect(providerMocks.handleSessionInput).toHaveBeenCalledTimes(1);
    expect(providerMocks.confirmSessionRun).toHaveBeenCalledTimes(1);
    expect(providerMocks.replaySessionStage).toHaveBeenCalledTimes(1);

    const handler = providerMocks.handleSessionInput.mock.calls.at(-1)?.[0];
    await handler({ conversationId: 'conversation-1', input: '/conduit' });

    expect(providerMocks.sessionChanged).toHaveBeenCalledWith(expect.objectContaining({ sessionId: session.sessionId }));
    expect(providerMocks.emit).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-1' }));
  });

  it('emits state changes after starting a run', async () => {
    const state: ConduitDeliveryRunState = {
      runId: 'run-1',
      status: 'succeeded',
      requirement: 'show article word count',
      createdAt: 1,
      updatedAt: 1,
      stages: [],
      events: [],
      changedFiles: [],
      verificationResults: [],
    };

    initConduitDeliveryBridge({
      getState: () => undefined,
      startRun: async () => state,
      bindSandbox: vi.fn(),
      cloneSandbox: vi.fn(),
      listRuns: () => [],
      replayRun: vi.fn(),
      getChangedFiles: () => [],
      ...sessionServiceMethods(),
    });

    const handler = providerMocks.startRun.mock.calls.at(-1)?.[0];
    await handler({ requirement: 'show article word count' });

    expect(providerMocks.emit).toHaveBeenCalledWith(state);
  });

  it('persists sandbox binding through initialized process storage in the default service', async () => {
    initConduitDeliveryBridge();

    const handler = providerMocks.bindSandbox.mock.calls.at(-1)?.[0];
    await handler({ path: 'D:/conduit' });

    expect(storageMocks.processConfigSet).toHaveBeenCalledWith('conduit.lastSandboxPath', 'D:/conduit');
    expect(storageMocks.configStorageSet).not.toHaveBeenCalled();
  });

  it('does not switch sandbox default when persistence fails', async () => {
    storageMocks.processConfigSet.mockRejectedValueOnce(new Error('write failed'));
    initConduitDeliveryBridge();

    const handler = providerMocks.bindSandbox.mock.calls.at(-1)?.[0];
    await expect(handler({ path: 'D:/conduit' })).rejects.toThrow('write failed');

    expect(defaultServiceMocks.setDefaultSandboxPath).not.toHaveBeenCalledWith('D:/conduit');
  });

  it('restores the persisted sandbox path when the default service is registered', async () => {
    initConduitDeliveryBridge();

    await Promise.resolve();

    expect(storageMocks.processConfigGet).toHaveBeenCalledWith('conduit.lastSandboxPath');
    expect(defaultServiceMocks.setDefaultSandboxPath).toHaveBeenCalledWith('D:/persisted-conduit');
  });

  it('orders persisted restore before applying a newly bound default sandbox', async () => {
    const restore = (
      Promise as typeof Promise & {
        withResolvers<T>(): PromiseWithResolversValue<T>;
      }
    ).withResolvers<string | undefined>();
    storageMocks.processConfigGet.mockReturnValueOnce(restore.promise);
    initConduitDeliveryBridge();

    const handler = providerMocks.bindSandbox.mock.calls.at(-1)?.[0];
    const bind = handler({ path: 'D:/conduit' });
    await Promise.resolve();

    expect(defaultServiceMocks.bindSandbox).not.toHaveBeenCalled();

    restore.resolve('D:/old-conduit');
    await bind;

    expect(defaultServiceMocks.setDefaultSandboxPath.mock.calls).toEqual([['D:/old-conduit'], ['D:/conduit']]);
  });

  it('orders persisted restore before handling default session input', async () => {
    const restore = (
      Promise as typeof Promise & {
        withResolvers<T>(): PromiseWithResolversValue<T>;
      }
    ).withResolvers<string | undefined>();
    storageMocks.processConfigGet.mockReturnValueOnce(restore.promise);
    initConduitDeliveryBridge();

    const handler = providerMocks.handleSessionInput.mock.calls.at(-1)?.[0];
    const handled = handler({ conversationId: 'conversation-1', input: '/conduit run' });
    await Promise.resolve();

    expect(defaultServiceMocks.handleInput).not.toHaveBeenCalled();

    restore.resolve('D:/old-conduit');
    await handled;

    expect(defaultServiceMocks.setDefaultSandboxPath).toHaveBeenCalledWith('D:/old-conduit');
    expect(defaultServiceMocks.handleInput).toHaveBeenCalledWith({ conversationId: 'conversation-1', input: '/conduit run' });
  });
});
