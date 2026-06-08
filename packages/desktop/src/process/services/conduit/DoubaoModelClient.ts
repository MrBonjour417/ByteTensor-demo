/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConduitModelCallMetrics } from '@/common/types/conduitDelivery';

type DoubaoEnv = Partial<Pick<NodeJS.ProcessEnv, 'DOUBAO_ENDPOINT' | 'DOUBAO_API_KEY' | 'DOUBAO_MODEL'>>;

type DoubaoModelClientOptions = {
  env?: DoubaoEnv;
  fetchModel?: (request: { endpoint: string; apiKey: string; model: string; prompt: string }) => Promise<unknown>;
  now?: () => number;
};

const DEFAULT_MODEL = 'doubao-seed-2.0-lite';

export class DoubaoModelClient {
  readonly #env: DoubaoEnv;
  readonly #fetchModel?: DoubaoModelClientOptions['fetchModel'];
  readonly #now: () => number;

  constructor(options: DoubaoModelClientOptions = {}) {
    this.#env = options.env ?? process.env;
    this.#fetchModel = options.fetchModel;
    this.#now = options.now ?? Date.now;
  }

  async checkConfiguration(): Promise<ConduitModelCallMetrics> {
    const endpoint = this.#env.DOUBAO_ENDPOINT;
    const apiKey = this.#env.DOUBAO_API_KEY;
    const model = this.#env.DOUBAO_MODEL ?? DEFAULT_MODEL;
    if (!endpoint || !apiKey) {
      const missing =
        !endpoint && !apiKey ? 'DOUBAO_ENDPOINT and DOUBAO_API_KEY' : !endpoint ? 'DOUBAO_ENDPOINT' : 'DOUBAO_API_KEY';
      return {
        provider: 'doubao',
        status: 'missing_config',
        endpointConfigured: Boolean(endpoint),
        apiKeyConfigured: Boolean(apiKey),
        error: `${missing} must be set in the environment.`,
      };
    }

    return {
      provider: 'doubao',
      status: 'configured',
      model,
      endpointConfigured: true,
      apiKeyConfigured: true,
    };
  }

  async call(prompt: string): Promise<ConduitModelCallMetrics> {
    const configuration = await this.checkConfiguration();
    if (configuration.status !== 'configured') return configuration;
    if (!this.#fetchModel || !this.#env.DOUBAO_ENDPOINT || !this.#env.DOUBAO_API_KEY) return configuration;

    const startedAt = this.#now();
    try {
      await this.#fetchModel({
        endpoint: this.#env.DOUBAO_ENDPOINT,
        apiKey: this.#env.DOUBAO_API_KEY,
        model: configuration.model ?? DEFAULT_MODEL,
        prompt,
      });
      return { ...configuration, latencyMs: Math.max(0, this.#now() - startedAt) };
    } catch (error) {
      return {
        ...configuration,
        status: 'failed',
        latencyMs: Math.max(0, this.#now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
