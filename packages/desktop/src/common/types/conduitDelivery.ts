/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export const CONDUIT_OFFICIAL_REPOSITORY_URL = 'https://github.com/TonyMckes/conduit-realworld-example-app';

export const CONDUIT_READING_STATS_SKILL_ID = 'conduit.article-reading-stats';
export const CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID = 'conduit.article-preview-reading-stats';
export const CONDUIT_ARTICLE_COMMENT_COUNT_SKILL_ID = 'conduit.article-comment-count';
export const CONDUIT_ARTICLE_FAVORITE_FILTER_SKILL_ID = 'conduit.article-favorite-filter';
export const CONDUIT_HELP_PAGE_SKILL_ID = 'conduit.help-page';
export const CONDUIT_COPY_ARTICLE_LINK_SKILL_ID = 'conduit.copy-article-link';
export const CONDUIT_ARTICLE_SUMMARY_FIELD_SKILL_ID = 'conduit.article-summary-field';

export const CONDUIT_DELIVERY_STAGE_ORDER = [
  'intake',
  'clarify',
  'plan',
  'locate',
  'patch',
  'verify',
  'summarize',
] as const;

export type ConduitDeliveryStage = (typeof CONDUIT_DELIVERY_STAGE_ORDER)[number];

export type ConduitDeliveryStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'validation_failed';

export type ConduitDeliveryStageStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type ConduitModelCallStatus = 'configured' | 'missing_config' | 'failed';

export type ConduitVerificationStatus = 'passed' | 'failed';

export type ConduitSandboxBinding = {
  path: string;
  repositoryUrl: string;
  branch?: string;
  packageName: string;
  boundAt: number;
};

export type ConduitDeliveryBindSandboxRequest = {
  path: string;
};

export type ConduitDeliveryCloneSandboxRequest = {
  targetPath: string;
};

export type ConduitDeliveryStartRunRequest = {
  requirement: string;
  sandboxPath?: string;
  conversationId?: string;
};

export type ConduitDeliveryRunLookup = {
  runId?: string;
};

export type ConduitDeliveryReplayStage = 'plan' | 'patch' | 'verify' | 'summary';

export type ConduitDeliveryReplayRequest = {
  runId: string;
  stage?: ConduitDeliveryReplayStage;
};

export type ConduitSkillTargetFile = {
  path: string;
  purpose: string;
};

export type ConduitSkillMetadata = {
  id: string;
  name: string;
  level: 'L1' | 'L2' | 'L3';
  description: string;
  matcherPhrases: string[];
  targetFiles: ConduitSkillTargetFile[];
  verificationCommands: ConduitVerificationCommand[];
};

export type ConduitClarification = {
  questions: string[];
  defaults: string[];
  resolvedRequirement: string;
};

export type ConduitModuleLocation = {
  path: string;
  reason: string;
};

export type ConduitPatchFile = {
  path: string;
  content: string;
  operation: 'create_or_replace' | 'replace';
};

export type ConduitChangedFile = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';
};

export type ConduitVerificationCommand = {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  description: string;
};

export type ConduitVerificationResult = ConduitVerificationCommand & {
  status: ConduitVerificationStatus;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
};

export type ConduitModelCallMetrics = {
  provider: 'doubao';
  status: ConduitModelCallStatus;
  model?: string;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  error?: string;
};

export type ConduitAgentInvocation = {
  id: string;
  agentName: string;
  purpose: string;
  status: 'succeeded' | 'failed' | 'fallback';
  startedAt: number;
  finishedAt: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
};

export type ConduitContextSlice = {
  path: string;
  reason: string;
  lineStart: number;
  lineEnd: number;
  charCount: number;
  tokenEstimate: number;
  preview?: string;
};

export type ConduitPrReadySummary = {
  title: string;
  body: string;
  changedFiles: ConduitChangedFile[];
  verificationResults: ConduitVerificationResult[];
  manualCommands: string[];
};

export type ConduitDeliveryEvent = {
  id: string;
  runId: string;
  stage: ConduitDeliveryStage;
  status: ConduitDeliveryStageStatus;
  message: string;
  createdAt: number;
  data?: unknown;
};

export type ConduitDeliveryStageState = {
  stage: ConduitDeliveryStage;
  status: ConduitDeliveryStageStatus;
  startedAt?: number;
  finishedAt?: number;
  message?: string;
};

export type ConduitDeliveryRunState = {
  runId: string;
  status: ConduitDeliveryStatus;
  requirement: string;
  createdAt: number;
  updatedAt: number;
  conversationId?: string;
  sandbox?: ConduitSandboxBinding;
  selectedSkill?: ConduitSkillMetadata;
  clarification?: ConduitClarification;
  plan?: string[];
  moduleLocations?: ConduitModuleLocation[];
  stages: ConduitDeliveryStageState[];
  events: ConduitDeliveryEvent[];
  changedFiles: ConduitChangedFile[];
  verificationResults: ConduitVerificationResult[];
  modelMetrics?: ConduitModelCallMetrics[];
  agentInvocations?: ConduitAgentInvocation[];
  contextSlices?: ConduitContextSlice[];
  summary?: ConduitPrReadySummary;
  error?: string;
};

export type ConduitDeliveryRunSummary = Pick<
  ConduitDeliveryRunState,
  'runId' | 'status' | 'requirement' | 'createdAt' | 'updatedAt' | 'selectedSkill' | 'summary' | 'error'
>;

export type ConduitSessionStatus =
  | 'idle'
  | 'active_collecting_pm_input'
  | 'clarifying'
  | 'ready_to_confirm'
  | 'ready_to_run'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'paused'
  | 'exited';

export type ConduitRequirementLevel = 'L1' | 'L2' | 'L3';
export type ConduitRequirementOperation =
  | 'add_field'
  | 'add_page'
  | 'add_filter'
  | 'add_interaction'
  | 'modify_api'
  | 'modify_schema'
  | 'custom_skill';

export type ConduitRequirementDsl = {
  operation?: ConduitRequirementOperation;
  level: ConduitRequirementLevel;
  title: string;
  userGoal: string;
  targetSurface: 'article_detail' | 'article_list' | 'profile' | 'editor' | 'home' | 'new_page' | 'unknown';
  acceptanceCriteria: string[];
  requiresBackend: boolean;
  requiresDatabase: boolean;
  verification: string[];
  unresolvedQuestions?: string[];
};

export type ConduitPlanSummary = {
  summary: string;
  targetFiles: string[];
  risks: string[];
};

export type ConduitRecalledDemand = {
  sessionId: string;
  requirement: string;
  summary: string;
  similarity: number;
};

export type ConduitConversationEntryKind =
  | 'mode_entered'
  | 'pm_input'
  | 'clarification_question'
  | 'requirement_confirmed'
  | 'plan_summary'
  | 'demand_recalled'
  | 'status'
  | 'error';

export type ConduitConversationEntry = {
  id: string;
  sessionId: string;
  conversationId: string;
  role: 'user' | 'conduit';
  kind: ConduitConversationEntryKind;
  content: string;
  createdAt: number;
};

export type ConduitSessionState = {
  sessionId: string;
  conversationId: string;
  status: ConduitSessionStatus;
  createdAt: number;
  updatedAt: number;
  pmInputs: string[];
  notes?: string[];
  clarificationQuestions: string[];
  entries?: ConduitConversationEntry[];
  requirementDsl?: ConduitRequirementDsl;
  planSummary?: ConduitPlanSummary;
  recalledDemands?: ConduitRecalledDemand[];
  activeRunId?: string;
  runState?: ConduitDeliveryRunState;
  modelMetrics?: ConduitModelCallMetrics[];
  agentInvocations?: ConduitAgentInvocation[];
  error?: string;
};

export type ConduitSessionLookup = {
  conversationId: string;
};

export type ConduitSessionInputRequest = {
  conversationId: string;
  input: string;
  workspacePath?: string;
};

export type ConduitSessionCommandResult = {
  handled: boolean;
  session?: ConduitSessionState;
  entries: ConduitConversationEntry[];
};

export type ConduitConfirmRunRequest = {
  conversationId: string;
  sandboxPath?: string;
};

export type ConduitStageReplayRequest = {
  conversationId: string;
  stage: ConduitDeliveryReplayStage;
};
