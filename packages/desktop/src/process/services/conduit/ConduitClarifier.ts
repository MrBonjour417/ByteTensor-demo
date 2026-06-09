/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConduitRequirementDsl } from '@/common/types/conduitDelivery';

export type ConduitClarifierResult =
  | { status: 'needs_clarification'; questions: string[] }
  | { status: 'ready'; dsl: ConduitRequirementDsl };

const ARTICLE_DETAIL_SURFACE_RE =
  /(?:文章详情页|文章.*详情页|详情页.*文章|article detail pages?|article detail|article.*detail pages?|article.*detail)/i;
const ARTICLE_PREVIEW_SURFACE_RE =
  /(?:文章列表|列表页|文章卡片|预览卡片|article list|article preview cards?|preview cards?|article cards?)/i;
const UNSUPPORTED_SURFACE_RE =
  /(?:首页|feed|home|用户详情页|user detail|profile page|profile|编辑器页|editor page|editor|用户列表页|user list)/i;
const WORD_COUNT_RE = /字数|word count|words?/i;
const READING_TIME_RE = /阅读时间|预计阅读|reading time|read time/i;
const COMMENTS_COUNT_RE = /commentsCount|comments count|comment count|评论数量|评论数/i;
const BACKEND_API_RE = /backend|api|后端|接口/i;
const REJECTS_ARTICLE_DETAIL_RE = /(?:不要|不是|not).*文章详情页|not.*article detail/i;
const REJECTS_WORD_COUNT_RE =
  /(?:不要|不需要|移除|去掉).*?(?:字数|word count)|(?:字数|word count).*?(?:不要|不需要|移除|去掉)|\b(?:not|without|no)\b.*?\bword count\b|\bword count\b.*?\b(?:not|without|no)\b/i;
const REJECTS_READING_TIME_RE =
  /(?:不要|不需要|移除|去掉).*?(?:阅读时间|预计阅读|reading time|read time)|(?:阅读时间|预计阅读|reading time|read time).*?(?:不要|不需要|移除|去掉)|\b(?:not|without|no)\b.*?\b(?:reading time|read time)\b|\b(?:reading time|read time)\b.*?\b(?:not|without|no)\b/i;
const ONLY_FEATURE_RE = /\bonly\b|只保留/i;
const SUPPORTED_SURFACE_QUESTION = 'P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。';

export class ConduitClarifier {
  analyze(pmInputs: string[]): ConduitClarifierResult {
    const combined = pmInputs.join('\n').trim();
    const latest = pmInputs.at(-1)?.trim() ?? '';
    const latestHasArticleDetailSurface = ARTICLE_DETAIL_SURFACE_RE.test(latest);
    const hasArticleDetailSurface = ARTICLE_DETAIL_SURFACE_RE.test(combined);
    const latestRejectsArticleDetail = REJECTS_ARTICLE_DETAIL_RE.test(latest);
    const latestHasWordCount = WORD_COUNT_RE.test(latest);
    const latestHasReadingTime = READING_TIME_RE.test(latest);
    const latestOnlyFeature = ONLY_FEATURE_RE.test(latest);
    const latestRejectsWordCount =
      REJECTS_WORD_COUNT_RE.test(latest) || (latestOnlyFeature && latestHasReadingTime && !latestHasWordCount);
    const latestRejectsReadingTime =
      REJECTS_READING_TIME_RE.test(latest) || (latestOnlyFeature && latestHasWordCount && !latestHasReadingTime);
    const combinedHasArticlePreviewSurface = ARTICLE_PREVIEW_SURFACE_RE.test(combined);
    const latestHasArticlePreviewSurface = ARTICLE_PREVIEW_SURFACE_RE.test(latest);
    const latestHasUnsupportedSurface = UNSUPPORTED_SURFACE_RE.test(latest);
    const latestHasCommentsCount = COMMENTS_COUNT_RE.test(latest);
    const shouldUsePreviewSurface =
      latestHasArticlePreviewSurface || (combinedHasArticlePreviewSurface && !latestHasArticleDetailSurface);
    const combinedHasCommentsCount = COMMENTS_COUNT_RE.test(combined);
    const combinedHasBackendApi = BACKEND_API_RE.test(combined);
    const questions: string[] = [];

    if (latestHasUnsupportedSurface || latestRejectsArticleDetail) {
      questions.push(SUPPORTED_SURFACE_QUESTION);
    } else if (combinedHasCommentsCount) {
      if (!hasArticleDetailSurface) questions.push('commentsCount 要展示在哪个 Conduit 页面上？');
      if (!combinedHasBackendApi && !latestHasCommentsCount) questions.push('commentsCount 是否需要来自后端 API？');
    } else if (shouldUsePreviewSurface) {
      if (latestRejectsWordCount || !WORD_COUNT_RE.test(combined)) questions.push('是否需要展示文章字数？');
      if (latestRejectsReadingTime || !READING_TIME_RE.test(combined)) {
        questions.push('是否需要展示预计阅读时间，以及阅读速度按多少 WPM 计算？');
      }
    } else {
      if (!hasArticleDetailSurface) questions.push('这个统计信息要展示在哪个 Conduit 页面或组件上？');
      if (latestRejectsWordCount || !WORD_COUNT_RE.test(combined)) questions.push('是否需要展示文章字数？');
      if (latestRejectsReadingTime || !READING_TIME_RE.test(combined)) {
        questions.push('是否需要展示预计阅读时间，以及阅读速度按多少 WPM 计算？');
      }
    }

    if (questions.length > 0) return { status: 'needs_clarification', questions };

    if (combinedHasCommentsCount) return { status: 'ready', dsl: this.#buildCommentCountDsl() };
    if (shouldUsePreviewSurface) return { status: 'ready', dsl: this.#buildPreviewReadingStatsDsl() };
    return { status: 'ready', dsl: this.#buildArticleReadingStatsDsl() };
  }

  #buildArticleReadingStatsDsl(): ConduitRequirementDsl {
    return {
      level: 'L1',
      title: 'Article reading statistics',
      userGoal: 'Show article word count and estimated reading time on Conduit article detail pages.',
      targetSurface: 'article_detail',
      acceptanceCriteria: [
        'Article detail pages show article word count when Article.body exists.',
        'Article detail pages show estimated reading time rounded up to at least one minute.',
        'The statistic is hidden when Article.body is empty or missing.',
        'The helper has unit coverage for Markdown-like body text.',
      ],
      requiresBackend: false,
      requiresDatabase: false,
      verification: ['Run article reading statistics helper test.', 'Run the Conduit root test command.'],
    };
  }

  #buildPreviewReadingStatsDsl(): ConduitRequirementDsl {
    return {
      level: 'L1',
      title: 'Article preview reading statistics',
      userGoal: 'Show word count and estimated reading time on Conduit article preview cards.',
      targetSurface: 'article_list',
      acceptanceCriteria: [
        'Article preview cards show word count when Article.body exists.',
        'Article preview cards show estimated reading time rounded up to at least one minute.',
        'Existing preview-card metadata, favorite behavior, routing state, tags, loading, and empty states remain intact.',
      ],
      requiresBackend: false,
      requiresDatabase: false,
      verification: ['Run article preview reading statistics component test.'],
    };
  }

  #buildCommentCountDsl(): ConduitRequirementDsl {
    return {
      level: 'L2',
      title: 'Article comments count cross-stack field',
      userGoal: 'Add commentsCount from the backend API to Conduit article detail pages.',
      targetSurface: 'article_detail',
      acceptanceCriteria: [
        'Backend article API responses include commentsCount from persisted comments.',
        'Article detail pages render commentsCount from the API payload.',
        'Existing article controller exports and article-detail behavior remain intact.',
      ],
      requiresBackend: true,
      requiresDatabase: false,
      verification: ['Run backend commentsCount helper test.', 'Run frontend commentsCount render test.'],
    };
  }
}
