/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ProcessConfig } from '@process/utils/initStorage';
import type {
  ConduitConfirmRunRequest,
  ConduitChangedFile,
  ConduitDeliveryBindSandboxRequest,
  ConduitDeliveryCloneSandboxRequest,
  ConduitDeliveryReplayRequest,
  ConduitSessionCommandResult,
  ConduitSessionInputRequest,
  ConduitSessionState,
  ConduitStageReplayRequest,
  ConduitDeliveryRunLookup,
  ConduitDeliveryRunState,
  ConduitDeliveryRunSummary,
  ConduitDeliveryStartRunRequest,
  ConduitSandboxBinding,
} from '@/common/types/conduitDelivery';
import { getDataPath } from '@process/utils';
import path from 'path';
import { ConduitEventStore, ConduitRepoService, ConduitSessionService, ConduitWorkflowService } from '@process/services/conduit';

type ConduitDeliveryBridgeService = {
  getState(runId?: string): ConduitDeliveryRunState | undefined;
  startRun(request: ConduitDeliveryStartRunRequest): Promise<ConduitDeliveryRunState>;
  bindSandbox(request: ConduitDeliveryBindSandboxRequest): Promise<ConduitSandboxBinding>;
  cloneSandbox(request: ConduitDeliveryCloneSandboxRequest): Promise<ConduitSandboxBinding>;
  listRuns(): ConduitDeliveryRunSummary[];
  replayRun(request: ConduitDeliveryReplayRequest): Promise<ConduitDeliveryRunState>;
  getChangedFiles(runId?: string): ConduitChangedFile[];
  getSessionState(conversationId: string): ConduitSessionState | undefined;
  handleSessionInput(request: ConduitSessionInputRequest): Promise<ConduitSessionCommandResult>;
  confirmSessionRun(request: ConduitConfirmRunRequest): Promise<ConduitSessionState>;
  replaySessionStage(request: ConduitStageReplayRequest): Promise<ConduitSessionState>;
};

let bridgeService: ConduitDeliveryBridgeService | undefined;

function createDefaultService(): ConduitDeliveryBridgeService {
  const eventStore = new ConduitEventStore({ directory: path.join(getDataPath(), 'conduit-delivery') });
  const repoService = new ConduitRepoService();
  const workflow = new ConduitWorkflowService({ eventStore, repoService });
  const sessionService = new ConduitSessionService({ workflow });
  const restoreDefaultSandboxPath = ProcessConfig.get('conduit.lastSandboxPath')
    .then((sandboxPath) => {
      if (typeof sandboxPath === 'string' && sandboxPath.length > 0) {
        workflow.setDefaultSandboxPath(sandboxPath);
      }
    })
    .catch((error) => {
      console.error('[ConduitDeliveryBridge] Failed to restore sandbox path:', error);
    });
  return {
    getState(runId) {
      return workflow.getState(runId);
    },
    async startRun(request) {
      await restoreDefaultSandboxPath;
      return workflow.startRun(request);
    },
    async bindSandbox(request) {
      await restoreDefaultSandboxPath;
      const binding = await repoService.bindSandbox(request.path);
      await ProcessConfig.set('conduit.lastSandboxPath', binding.path);
      workflow.setDefaultSandboxPath(binding.path);
      return binding;
    },
    async cloneSandbox(request) {
      await restoreDefaultSandboxPath;
      const binding = await repoService.cloneSandbox(request.targetPath);
      await ProcessConfig.set('conduit.lastSandboxPath', binding.path);
      workflow.setDefaultSandboxPath(binding.path);
      return binding;
    },
    listRuns() {
      return workflow.listRuns();
    },
    replayRun(request) {
      return workflow.replayRun(request);
    },
    getChangedFiles(runId) {
      return workflow.getChangedFiles(runId);
    },
    getSessionState(conversationId) {
      return sessionService.getSession(conversationId);
    },
    async handleSessionInput(request) {
      await restoreDefaultSandboxPath;
      return sessionService.handleInput(request);
    },
    async confirmSessionRun(request) {
      await restoreDefaultSandboxPath;
      return sessionService.confirmRun(request);
    },
    async replaySessionStage(request) {
      await restoreDefaultSandboxPath;
      return sessionService.replayStage(request);
    },
  };
}

export function initConduitDeliveryBridge(service: ConduitDeliveryBridgeService = createDefaultService()): void {
  bridgeService = service;

  ipcBridge.conduitDelivery.getState.provider(async (request) => bridgeService?.getState(request?.runId));
  ipcBridge.conduitDelivery.startRun.provider(async (request) => {
    const state = await service.startRun(request);
    ipcBridge.conduitDelivery.stateChanged.emit(state);
    return state;
  });
  ipcBridge.conduitDelivery.bindSandbox.provider(async (request) => {
    const binding = await service.bindSandbox(request);
    const state = service.getState();
    if (state) ipcBridge.conduitDelivery.stateChanged.emit(state);
    return binding;
  });
  ipcBridge.conduitDelivery.cloneSandbox.provider(async (request) => {
    const binding = await service.cloneSandbox(request);
    const state = service.getState();
    if (state) ipcBridge.conduitDelivery.stateChanged.emit(state);
    return binding;
  });
  ipcBridge.conduitDelivery.listRuns.provider(async () => service.listRuns());
  ipcBridge.conduitDelivery.replayRun.provider(async (request) => {
    const state = await service.replayRun(request);
    ipcBridge.conduitDelivery.stateChanged.emit(state);
    return state;
  });
  ipcBridge.conduitDelivery.getChangedFiles.provider(async (request) => service.getChangedFiles(request?.runId));
  ipcBridge.conduitDelivery.getSessionState.provider(async (request) => service.getSessionState(request.conversationId));
  ipcBridge.conduitDelivery.handleSessionInput.provider(async (request) => {
    const result = await service.handleSessionInput(request);
    if (result.session) ipcBridge.conduitDelivery.sessionChanged.emit(result.session);
    if (result.session?.runState) ipcBridge.conduitDelivery.stateChanged.emit(result.session.runState);
    return result;
  });
  ipcBridge.conduitDelivery.confirmSessionRun.provider(async (request) => {
    const session = await service.confirmSessionRun(request);
    ipcBridge.conduitDelivery.sessionChanged.emit(session);
    if (session.runState) ipcBridge.conduitDelivery.stateChanged.emit(session.runState);
    return session;
  });
  ipcBridge.conduitDelivery.replaySessionStage.provider(async (request) => {
    const session = await service.replaySessionStage(request);
    ipcBridge.conduitDelivery.sessionChanged.emit(session);
    if (session.runState) ipcBridge.conduitDelivery.stateChanged.emit(session.runState);
    return session;
  });
}
