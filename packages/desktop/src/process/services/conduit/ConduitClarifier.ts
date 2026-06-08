/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConduitRequirementDsl } from '@/common/types/conduitDelivery';

export type ConduitClarifierResult =
  | { status: 'needs_clarification'; questions: string[] }
  | { status: 'ready'; dsl: ConduitRequirementDsl };

const ARTICLE_DETAIL_SURFACE_RE = /(?:文章详情页|文章.*详情页|详情页.*文章|article detail page|article detail|article.*detail page|article.*detail)/i;
const UNSUPPORTED_ARTICLE_SURFACE_RE = /(?:文章列表|列表页|首页|article list|feed|home)/i;
const WORD_COUNT_RE = /字数|word count|words?/i;
const READING_TIME_RE = /阅读时间|预计阅读|reading time|read time/i;
const LATEST_NON_ARTICLE_DETAIL_SURFACE_RE = /(?:文章列表|列表页|首页|article list|feed|home|用户详情页|user detail|profile page|profile|编辑器页|editor page|editor|用户列表页|user list)/i;
const REJECTS_ARTICLE_DETAIL_RE = /(?:不要|不是|not).*文章详情页|not.*article detail/i;
const REJECTS_WORD_COUNT_RE = /(?:不要|不需要|移除|去掉).*?(?:字数|word count)|(?:字数|word count).*?(?:不要|不需要|移除|去掉)|\b(?:not|without|no)\b.*?\bword count\b|\bword count\b.*?\b(?:not|without|no)\b/i;
const REJECTS_READING_TIME_RE = /(?:不要|不需要|移除|去掉).*?(?:阅读时间|预计阅读|reading time|read time)|(?:阅读时间|预计阅读|reading time|read time).*?(?:不要|不需要|移除|去掉)|\b(?:not|without|no)\b.*?\b(?:reading time|read time)\b|\b(?:reading time|read time)\b.*?\b(?:not|without|no)\b/i;
const ONLY_FEATURE_RE = /\bonly\b|只保留/i;

export class ConduitClarifier {
  analyze(pmInputs: string[]): ConduitClarifierResult {
    const combined = pmInputs.join('\n').trim();
    const latest = pmInputs.at(-1)?.trim() ?? '';
    const latestHasUnsupportedSurface = UNSUPPORTED_ARTICLE_SURFACE_RE.test(latest);
    const latestHasArticleDetailSurface = ARTICLE_DETAIL_SURFACE_RE.test(latest);
    const latestMentionsNonArticleDetailSurface = LATEST_NON_ARTICLE_DETAIL_SURFACE_RE.test(latest);
    const hasArticleDetailSurface = ARTICLE_DETAIL_SURFACE_RE.test(combined);
    const latestRejectsArticleDetail = REJECTS_ARTICLE_DETAIL_RE.test(latest);
    const latestHasWordCount = WORD_COUNT_RE.test(latest);
    const latestHasReadingTime = READING_TIME_RE.test(latest);
    const latestOnlyFeature = ONLY_FEATURE_RE.test(latest);
    const latestRejectsWordCount =
      REJECTS_WORD_COUNT_RE.test(latest) || (latestOnlyFeature && latestHasReadingTime && !latestHasWordCount);
    const latestRejectsReadingTime =
      REJECTS_READING_TIME_RE.test(latest) || (latestOnlyFeature && latestHasWordCount && !latestHasReadingTime);
    const questions: string[] = [];

    if (latestHasUnsupportedSurface || latestMentionsNonArticleDetailSurface || latestRejectsArticleDetail) {
      questions.push('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
    } else if (!hasArticleDetailSurface) {
      questions.push('这个统计信息要展示在哪个 Conduit 页面或组件上？');
    }
    if (latestRejectsWordCount || !WORD_COUNT_RE.test(combined)) {
      questions.push('是否需要展示文章字数？');
    }
    if (latestRejectsReadingTime || !READING_TIME_RE.test(combined)) {
      questions.push('是否需要展示预计阅读时间，以及阅读速度按多少 WPM 计算？');
    }

    if (questions.length > 0) {
      return { status: 'needs_clarification', questions };
    }

    return {
      status: 'ready',
      dsl: {
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
      },
    };
  }
}
