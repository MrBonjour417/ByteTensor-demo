/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { ConduitClarificationAgent } from '@process/services/conduit/ConduitClarificationAgent';
import { ConduitClarifier } from '@process/services/conduit/ConduitClarifier';

describe('ConduitClarificationAgent', () => {
  it('uses model JSON to ask clarification questions before falling back', async () => {
    const fallback = new ConduitClarifier();
    const modelClient = {
      completeJson: vi.fn(async () => ({
        metrics: {
          provider: 'doubao' as const,
          status: 'configured' as const,
          endpointConfigured: true,
          apiKeyConfigured: true,
          model: 'doubao-seed-2.0-lite',
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          latencyMs: 12,
        },
        content: JSON.stringify({
          status: 'needs_clarification',
          questions: ['请确认要展示在文章详情页还是列表页？'],
        }),
      })),
    };
    const agent = new ConduitClarificationAgent({ fallback, modelClient });

    const result = await agent.analyze(['展示字数和阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toEqual(['请确认要展示在文章详情页还是列表页？']);
    expect(result.modelMetrics?.[0]?.totalTokens).toBe(30);
    expect(modelClient.completeJson).toHaveBeenCalledWith(expect.stringContaining('展示字数和阅读时间'));
  });

  it('records clarification subagent invocation details when using a dispatcher', async () => {
    const dispatcher = {
      run: vi.fn(async () => ({
        content: JSON.stringify({
          status: 'ready',
          dsl: {
            level: 'L1',
            title: 'Article preview reading statistics',
            userGoal: 'Show word count and estimated reading time on Conduit article preview cards.',
            targetSurface: 'article_list',
            acceptanceCriteria: ['Preview cards show reading stats.'],
            requiresBackend: false,
            requiresDatabase: false,
            verification: ['Run preview test.'],
          },
        }),
        metrics: {
          provider: 'doubao' as const,
          status: 'configured' as const,
          endpointConfigured: true,
          apiKeyConfigured: true,
          totalTokens: 64,
          latencyMs: 9,
        },
        invocation: {
          id: 'clarify-1',
          agentName: 'clarification_subagent',
          purpose: '需求澄清',
          status: 'succeeded' as const,
          startedAt: 1,
          finishedAt: 2,
          inputTokens: 30,
          outputTokens: 34,
        },
      })),
    };
    const agent = new ConduitClarificationAgent({ dispatcher });

    const result = await agent.analyze(['preview cards show reading stats']);

    expect(result.status).toBe('ready');
    expect(dispatcher.run).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: 'clarification_subagent', input: expect.stringContaining('preview cards') })
    );
    expect(result.agentInvocations).toEqual([
      expect.objectContaining({ agentName: 'clarification_subagent', status: 'succeeded', inputTokens: 30 }),
    ]);
    expect(result.modelMetrics?.[0]?.totalTokens).toBe(64);
  });

  it('falls back to deterministic clarification when model configuration is missing', async () => {
    const fallback = new ConduitClarifier();
    const modelClient = {
      completeJson: vi.fn(async () => ({
        metrics: {
          provider: 'doubao' as const,
          status: 'missing_config' as const,
          endpointConfigured: false,
          apiKeyConfigured: false,
          error: 'DOUBAO_ENDPOINT and DOUBAO_API_KEY must be set in the environment.',
        },
      })),
    };
    const agent = new ConduitClarificationAgent({ fallback, modelClient });

    const result = await agent.analyze(['加一个统计信息']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected fallback clarification result.');
    expect(result.questions).toContain('这个统计信息要展示在哪个 Conduit 页面或组件上？');
    expect(result.modelMetrics?.[0]?.status).toBe('missing_config');
  });
});
