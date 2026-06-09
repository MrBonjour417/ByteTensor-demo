/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConduitAgentInvocation,
  ConduitModelCallMetrics,
  ConduitRequirementDsl,
} from '@/common/types/conduitDelivery';
import { ConduitClarifier } from './ConduitClarifier';
import type { ConduitClarifierResult } from './ConduitClarifier';
import { DoubaoModelClient } from './DoubaoModelClient';

type ClarificationAgentResult = ConduitClarifierResult & {
  modelMetrics?: ConduitModelCallMetrics[];
  agentInvocations?: ConduitAgentInvocation[];
};

type ConduitSubagentRequest = {
  agentName: string;
  purpose: string;
  input: string;
};

type ConduitSubagentResult = {
  content?: string;
  metrics: ConduitModelCallMetrics;
  invocation: ConduitAgentInvocation;
};

type ConduitSubagentDispatcher = {
  run(request: ConduitSubagentRequest): Promise<ConduitSubagentResult>;
};

type ModelClientLike = {
  completeJson(prompt: string): Promise<{ metrics: ConduitModelCallMetrics; content?: string }>;
};

type ConduitClarificationAgentOptions = {
  fallback?: ConduitClarifier;
  modelClient?: ModelClientLike;
  dispatcher?: ConduitSubagentDispatcher;
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
  readonly #dispatcher: ConduitSubagentDispatcher;

  constructor(options: ConduitClarificationAgentOptions = {}) {
    this.#fallback = options.fallback ?? new ConduitClarifier();
    const modelClient = options.modelClient ?? new DoubaoModelClient();
    this.#dispatcher = options.dispatcher ?? new ModelBackedClarificationSubagent(modelClient);
  }

  async analyze(pmInputs: string[]): Promise<ClarificationAgentResult> {
    const subagentResult = await this.#dispatcher.run({
      agentName: 'clarification_subagent',
      purpose: '需求澄清',
      input: this.#buildPrompt(pmInputs),
    });
    if (subagentResult.metrics.status === 'configured' || subagentResult.metrics.status === 'failed') {
      const parsed = parseModelResponse(subagentResult.content);
      if (parsed) {
        return {
          ...parsed,
          modelMetrics: [subagentResult.metrics],
          agentInvocations: [subagentResult.invocation],
        };
      }
    }

    const fallback = this.#fallback.analyze(pmInputs);
    return {
      ...fallback,
      modelMetrics: [subagentResult.metrics],
      agentInvocations: [{ ...subagentResult.invocation, status: 'fallback' }],
    };
  }

  #buildPrompt(pmInputs: string[]): string {
    return [
      'You are the Conduit clarification Agent.',
      'Convert PM input into JSON only.',
      'Return {"status":"needs_clarification","questions":[...]} when information is ambiguous.',
      'Return {"status":"ready","dsl":{...}} only when executable acceptance criteria are clear.',
      'Supported tasks: P0 article-detail word count + estimated reading time; P1 article-preview/card word count + estimated reading time; P2 commentsCount propagated from backend article API to article detail UI.',
      '用户输入是中文时，澄清问题必须使用中文；不要把支持范围说明写成英文。',
      'Concrete generic deliveries supported today: article favorite filter, help page, article copy-link interaction, article summary field. For any other page, field, API, schema, filter, or interaction request, return needs_clarification in the user language instead of inventing a ready DSL.',
      'PM inputs:',
      ...pmInputs,
    ].join('\n');
  }
}

class ModelBackedClarificationSubagent implements ConduitSubagentDispatcher {
  readonly #modelClient: ModelClientLike;
  readonly #now: () => number;

  constructor(modelClient: ModelClientLike, now: () => number = Date.now) {
    this.#modelClient = modelClient;
    this.#now = now;
  }

  async run(request: ConduitSubagentRequest): Promise<ConduitSubagentResult> {
    const startedAt = this.#now();
    const result = await this.#modelClient.completeJson(request.input);
    const finishedAt = this.#now();
    return {
      content: result.content,
      metrics: result.metrics,
      invocation: {
        id: `${request.agentName}-${startedAt}`,
        agentName: request.agentName,
        purpose: request.purpose,
        status:
          result.metrics.status === 'configured'
            ? 'succeeded'
            : result.metrics.status === 'failed'
              ? 'failed'
              : 'fallback',
        startedAt,
        finishedAt,
        inputTokens: result.metrics.promptTokens ?? 0,
        outputTokens: result.metrics.completionTokens ?? 0,
        error: result.metrics.error,
      },
    };
  }
}
