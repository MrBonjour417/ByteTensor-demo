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

type OpenAiCompatibleResponse = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: { content?: string };
    text?: string;
  }>;
};

const asOpenAiCompatibleResponse = (value: unknown): OpenAiCompatibleResponse =>
  value && typeof value === 'object' ? (value as OpenAiCompatibleResponse) : {};

const contentFromResponse = (value: unknown): string | undefined => {
  const response = asOpenAiCompatibleResponse(value);
  return response.choices?.[0]?.message?.content ?? response.choices?.[0]?.text;
};

const usageMetricsFromResponse = (value: unknown) => {
  const response = asOpenAiCompatibleResponse(value);
  return {
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
  };
};
const defaultFetchModel: NonNullable<DoubaoModelClientOptions['fetchModel']> = async ({
  endpoint,
  apiKey,
  model,
  prompt,
}) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(`Doubao request failed with HTTP ${response.status}`);
  return response.json();
};

const DEFAULT_MODEL = 'doubao-seed-2.0-lite';

export class DoubaoModelClient {
  readonly #env: DoubaoEnv;
  readonly #fetchModel?: DoubaoModelClientOptions['fetchModel'];
  readonly #now: () => number;

  constructor(options: DoubaoModelClientOptions = {}) {
    this.#env = options.env ?? process.env;
    this.#fetchModel = options.fetchModel ?? defaultFetchModel;
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

  async completeJson(prompt: string): Promise<{ metrics: ConduitModelCallMetrics; content?: string }> {
    const configuration = await this.checkConfiguration();
    if (configuration.status !== 'configured') return { metrics: configuration };
    if (!this.#fetchModel || !this.#env.DOUBAO_ENDPOINT || !this.#env.DOUBAO_API_KEY) {
      return { metrics: configuration };
    }

    const startedAt = this.#now();
    try {
      const response = await this.#fetchModel({
        endpoint: this.#env.DOUBAO_ENDPOINT,
        apiKey: this.#env.DOUBAO_API_KEY,
        model: configuration.model ?? DEFAULT_MODEL,
        prompt,
      });
      return {
        content: contentFromResponse(response),
        metrics: {
          ...configuration,
          ...usageMetricsFromResponse(response),
          latencyMs: Math.max(0, this.#now() - startedAt),
        },
      };
    } catch (error) {
      return {
        metrics: {
          ...configuration,
          status: 'failed',
          latencyMs: Math.max(0, this.#now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
