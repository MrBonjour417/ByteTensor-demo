/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TProviderWithModel } from '@/common/config/storage';
import { useGuidSend, type GuidSendDeps } from '@/renderer/pages/guid/hooks/useGuidSend';

const bridgeMocks = vi.hoisted(() => ({
  createConversation: vi.fn(),
  handleSessionInput: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      create: { invoke: bridgeMocks.createConversation },
    },
    conduitDelivery: {
      handleSessionInput: { invoke: bridgeMocks.handleSessionInput },
    },
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: { emit: vi.fn() },
}));

vi.mock('@/renderer/utils/workspace/workspaceHistory', () => ({
  updateWorkspaceTime: vi.fn(),
}));

const model = { id: 'model-1', provider: 'mock', use_model: 'mock-model' } as unknown as TProviderWithModel;

const createDeps = (overrides: Partial<GuidSendDeps> = {}): GuidSendDeps => ({
  input: '/conduit 文章详情页展示字数和预计阅读时间',
  setInput: vi.fn(),
  files: [],
  setFiles: vi.fn(),
  dir: 'D:/OmpProject/conduit-super-individual-sandbox',
  setDir: vi.fn(),
  setLoading: vi.fn(),
  loading: false,
  selectedAgent: 'aionrs',
  selectedAgentKey: 'aionrs',
  selectedAgentInfo: { id: 'aionrs', name: 'ByteTensor CLI', agent_type: 'aionrs' },
  is_presetAgent: false,
  selectedMode: 'default',
  selectedAcpModel: null,
  currentAcpCachedModelInfo: null,
  current_model: model,
  findAgentByKey: vi.fn(),
  getEffectiveAgentType: vi.fn(() => ({ agent_type: 'aionrs' })),
  resolvePresetRulesAndSkills: vi.fn(async () => ({})),
  resolveEnabledSkills: vi.fn(() => undefined),
  resolveDisabledBuiltinSkills: vi.fn(() => undefined),
  guidDisabledBuiltinSkills: undefined,
  guidEnabledSkills: undefined,
  availableMcpServers: [],
  selectedMcpServerIds: undefined,
  currentEffectiveAgentInfo: { agent_type: 'aionrs' },
  isGoogleAuth: false,
  setMentionOpen: vi.fn(),
  setMentionQuery: vi.fn(),
  setMentionSelectorOpen: vi.fn(),
  setMentionActiveIndex: vi.fn(),
  navigate: vi.fn(async () => undefined),
  t: ((key: string) => key) as GuidSendDeps['t'],
  ...overrides,
});

describe('useGuidSend Conduit handoff', () => {
  beforeEach(() => {
    bridgeMocks.createConversation.mockReset();
    bridgeMocks.handleSessionInput.mockReset();
    sessionStorage.clear();
    bridgeMocks.createConversation.mockResolvedValue({ id: 'conversation-1' });
    bridgeMocks.handleSessionInput.mockResolvedValue({ handled: true, entries: [] });
  });

  it('turns a Guid /conduit prompt into a Conduit session instead of a normal initial message', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useGuidSend(deps));

    await result.current.handleSend();

    expect(bridgeMocks.handleSessionInput).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
      workspacePath: 'D:/OmpProject/conduit-super-individual-sandbox',
    });
    expect(sessionStorage.getItem('aionrs_initial_message_conversation-1')).toBeNull();
    expect(deps.navigate).toHaveBeenCalledWith('/conversation/conversation-1');
  });

  it('keeps normal Guid prompts as normal initial messages', async () => {
    const deps = createDeps({ input: 'Explain this project' });
    const { result } = renderHook(() => useGuidSend(deps));

    await result.current.handleSend();

    expect(bridgeMocks.handleSessionInput).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('aionrs_initial_message_conversation-1')).toBe(
      JSON.stringify({ input: 'Explain this project', files: undefined })
    );
  });
});
