/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConduitModelCallMetrics, ConduitRequirementDsl } from '@/common/types/conduitDelivery';
import { ConduitClarifier } from './ConduitClarifier';
import type { ConduitClarifierResult } from './ConduitClarifier';
import { DoubaoModelClient } from './DoubaoModelClient';

type ClarificationAgentResult = ConduitClarifierResult & { modelMetrics?: ConduitModelCallMetrics[] };

type ModelClientLike = {
  completeJson(prompt: string): Promise<{ metrics: ConduitModelCallMetrics; content?: string }>;
};

type ConduitClarificationAgentOptions = {
  fallback?: ConduitClarifier;
  modelClient?: ModelClientLike;
};

type ModelClarificationResponse =
  | { status: 'needs_clarification'; questions: string[] }
  | { status: 'ready'; dsl: ConduitRequirementDsl };

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);

const isRequirementDsl = (value: unknown): value is ConduitRequirementDsl => {
  if (!value || typeof value !== 'object') return false;
  const dsl = value as Partial<ConduitRequirementDsl>;
  return (
    typeof dsl.level === 'string' &&
    typeof dsl.title === 'string' &&
    typeof dsl.userGoal === 'string' &&
    typeof dsl.targetSurface === 'string' &&
    Array.isArray(dsl.acceptanceCriteria) &&
    typeof dsl.requiresBackend === 'boolean' &&
    typeof dsl.requiresDatabase === 'boolean' &&
    Array.isArray(dsl.verification)
  );
};

const parseModelResponse = (content: string | undefined): ModelClarificationResponse | undefined => {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as Partial<ModelClarificationResponse>;
    if (parsed.status === 'needs_clarification' && isStringArray(parsed.questions)) {
      return { status: 'needs_clarification', questions: parsed.questions };
    }
    if (parsed.status === 'ready' && isRequirementDsl(parsed.dsl)) {
      return { status: 'ready', dsl: parsed.dsl };
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export class ConduitClarificationAgent {
  readonly #fallback: ConduitClarifier;
  readonly #modelClient: ModelClientLike;

  constructor(options: ConduitClarificationAgentOptions = {}) {
    this.#fallback = options.fallback ?? new ConduitClarifier();
    this.#modelClient = options.modelClient ?? new DoubaoModelClient();
  }

  async analyze(pmInputs: string[]): Promise<ClarificationAgentResult> {
    const modelResult = await this.#modelClient.completeJson(this.#buildPrompt(pmInputs));
    if (modelResult.metrics.status === 'configured' || modelResult.metrics.status === 'failed') {
      const parsed = parseModelResponse(modelResult.content);
      if (parsed) return { ...parsed, modelMetrics: [modelResult.metrics] };
    }

    return { ...this.#fallback.analyze(pmInputs), modelMetrics: [modelResult.metrics] };
  }

  #buildPrompt(pmInputs: string[]): string {
    return [
      'You are the Conduit clarification Agent.',
      'Convert PM input into JSON only.',
      'Return {"status":"needs_clarification","questions":[...]} when information is ambiguous.',
      'Return {"status":"ready","dsl":{...}} only when executable acceptance criteria are clear.',
      'Supported tasks: P0 article-detail word count + estimated reading time; P1 article-preview/card word count + estimated reading time; P2 commentsCount propagated from backend article API to article detail UI.',
      'PM inputs:',
      ...pmInputs,
    ].join('\n');
  }
}
