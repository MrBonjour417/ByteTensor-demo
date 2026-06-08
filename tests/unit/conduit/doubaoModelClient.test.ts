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
});
