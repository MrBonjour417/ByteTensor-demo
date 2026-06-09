/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { DoubaoModelClient } from '@process/services/conduit/DoubaoModelClient';

describe('DoubaoModelClient', () => {
  it('reports missing endpoint and API key without calling the network', async () => {
    const fetchModel = vi.fn();
    const client = new DoubaoModelClient({ env: {}, fetchModel });

    const result = await client.checkConfiguration();

    expect(result).toEqual({
      provider: 'doubao',
      status: 'missing_config',
      endpointConfigured: false,
      apiKeyConfigured: false,
      error: 'DOUBAO_ENDPOINT and DOUBAO_API_KEY must be set in the environment.',
    });
    expect(fetchModel).not.toHaveBeenCalled();
  });

  it('reports configured credentials without exposing secret values', async () => {
    const client = new DoubaoModelClient({
      env: {
        DOUBAO_ENDPOINT: 'https://example.test/v1/chat/completions',
        DOUBAO_API_KEY: 'secret',
        DOUBAO_MODEL: 'doubao-seed-2.0-lite',
      },
    });

    await expect(client.checkConfiguration()).resolves.toMatchObject({
      provider: 'doubao',
      status: 'configured',
      endpointConfigured: true,
      apiKeyConfigured: true,
      model: 'doubao-seed-2.0-lite',
    });
  });

  it('extracts OpenAI-compatible JSON message content with metrics', async () => {
    const fetchModel = vi.fn(async () => ({
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      choices: [{ message: { content: '{"status":"needs_clarification","questions":["Where?"]}' } }],
    }));
    const client = new DoubaoModelClient({
      env: {
        DOUBAO_ENDPOINT: 'https://example.test/v1/chat/completions',
        DOUBAO_API_KEY: 'secret',
        DOUBAO_MODEL: 'doubao-seed-2.0-lite',
      },
      fetchModel,
      now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(25),
    });

    await expect(client.completeJson('prompt')).resolves.toEqual({
      content: '{"status":"needs_clarification","questions":["Where?"]}',
      metrics: expect.objectContaining({
        provider: 'doubao',
        status: 'configured',
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18,
        latencyMs: 15,
      }),
    });
  });
});
