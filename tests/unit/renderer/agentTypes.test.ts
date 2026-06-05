/**
 * @license
 * Copyright 2026 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      getAvailableAgents: { invoke: vi.fn() },
    },
  },
}));

import { ipcBridge } from '@/common';
import { fetchDetectedAgents } from '@/renderer/utils/model/agentTypes';

const invokeGetAvailableAgents = vi.mocked(ipcBridge.acpConversation.getAvailableAgents.invoke);

describe('fetchDetectedAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presents the built-in aionrs agent as ByteTensor CLI without changing its runtime identity', async () => {
    invokeGetAvailableAgents.mockResolvedValue([
      {
        id: '632f31d2',
        name: 'Aion CLI',
        name_i18n: { 'en-US': 'Aion CLI', 'zh-CN': 'Aion CLI' },
        agent_type: 'aionrs',
        agent_source: 'internal',
        enabled: true,
        available: true,
      },
    ]);

    const agents = await fetchDetectedAgents();

    expect(agents).toEqual([
      expect.objectContaining({
        id: '632f31d2',
        name: 'ByteTensor CLI',
        name_i18n: expect.objectContaining({ 'en-US': 'ByteTensor CLI', 'zh-CN': 'ByteTensor CLI' }),
        agent_type: 'aionrs',
        agent_source: 'internal',
      }),
    ]);
  });

  it('preserves custom agent display names even when their backend is aionrs', async () => {
    invokeGetAvailableAgents.mockResolvedValue([
      {
        id: 'custom-aionrs',
        name: 'Team Runner',
        agent_type: 'aionrs',
        agent_source: 'custom',
        enabled: true,
        available: true,
      },
    ]);

    const agents = await fetchDetectedAgents();

    expect(agents[0]).toEqual(expect.objectContaining({ name: 'Team Runner', agent_type: 'aionrs' }));
  });

  it('returns an empty list when the backend response is not an array', async () => {
    invokeGetAvailableAgents.mockResolvedValue({ id: 'not-an-array' });

    await expect(fetchDetectedAgents()).resolves.toEqual([]);
  });
});
