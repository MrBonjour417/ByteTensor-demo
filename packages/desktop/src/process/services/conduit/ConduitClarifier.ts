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
  /(?:用户详情页|user detail|profile page|profile|编辑器页|editor page|editor|用户列表页|user list)/i;
const WORD_COUNT_RE = /字数|word count|words?/i;
const READING_TIME_RE = /阅读时间|预计阅读|reading time|read time/i;
const COMMENTS_COUNT_RE = /commentsCount|comments count|comment count|评论数量|评论数/i;
const BACKEND_API_RE = /backend|api|后端|接口/i;
const FAVORITE_FILTER_RE = /收藏筛选|收藏.*筛选|favorited? filter|favorite filter|favorited articles/i;
const ADD_PAGE_RE = /新增帮助页面|新建帮助页面|帮助页面|help page|(?:add|new) help page/i;
const ADD_INTERACTION_RE = /复制链接|copy.*link/i;
const ADD_FIELD_RE = /summary 字段|summary field|文章.*summary|article summary/i;
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
    const combinedHasFavoriteFilter = FAVORITE_FILTER_RE.test(combined);
    const latestMentionsPage = /页面|page/i.test(latest);
    const latestMentionsInteraction = /交互|按钮|interaction|button/i.test(latest);
    const latestMentionsField = /字段|field|schema|api/i.test(latest);
    const combinedHasAddPage = ADD_PAGE_RE.test(combined) && !(latestMentionsPage && !ADD_PAGE_RE.test(latest));
    const combinedHasAddInteraction =
      ADD_INTERACTION_RE.test(combined) && !(latestMentionsInteraction && !ADD_INTERACTION_RE.test(latest));
    const combinedHasAddField =
      ADD_FIELD_RE.test(combined) && !combinedHasCommentsCount && !(latestMentionsField && !ADD_FIELD_RE.test(latest));
    const hasGenericOperation =
      combinedHasFavoriteFilter || combinedHasAddPage || combinedHasAddInteraction || combinedHasAddField;
    const questions: string[] = [];

    if (!hasGenericOperation) {
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
    }

    if (questions.length > 0) return { status: 'needs_clarification', questions };

    if (combinedHasFavoriteFilter) return { status: 'ready', dsl: this.#buildFavoriteFilterDsl() };
    if (combinedHasCommentsCount) return { status: 'ready', dsl: this.#buildCommentCountDsl() };
    if (combinedHasAddPage) return { status: 'ready', dsl: this.#buildHelpPageDsl() };
    if (combinedHasAddInteraction) return { status: 'ready', dsl: this.#buildCopyLinkInteractionDsl() };
    if (combinedHasAddField) return { status: 'ready', dsl: this.#buildArticleSummaryFieldDsl() };
    if (shouldUsePreviewSurface) return { status: 'ready', dsl: this.#buildPreviewReadingStatsDsl() };
    return { status: 'ready', dsl: this.#buildArticleReadingStatsDsl() };
  }

  #buildFavoriteFilterDsl(): ConduitRequirementDsl {
    return {
      operation: 'add_filter',
      level: 'L2',
      title: '文章收藏筛选器',
      userGoal: '在文章列表增加收藏文章筛选器。',
      targetSurface: 'article_list',
      acceptanceCriteria: [
        '已登录用户可以在首页文章列表切换到收藏文章筛选。',
        '收藏筛选复用现有 favorited 查询参数，不新增后端 Schema。',
        '匿名用户不显示需要用户名的收藏筛选入口。',
      ],
      requiresBackend: false,
      requiresDatabase: false,
      verification: ['Run getArticles favorite filter URL test.'],
    };
  }

  #buildHelpPageDsl(): ConduitRequirementDsl {
    return {
      operation: 'add_page',
      level: 'L2',
      title: 'Conduit help page',
      userGoal: '新增 Conduit 帮助页面并接入前端路由。',
      targetSurface: 'new_page',
      acceptanceCriteria: ['访问 /help 时展示帮助页内容。', '未知路由继续进入 NotFound。'],
      requiresBackend: false,
      requiresDatabase: false,
      verification: ['Run help page route render test.'],
    };
  }

  #buildCopyLinkInteractionDsl(): ConduitRequirementDsl {
    return {
      operation: 'add_interaction',
      level: 'L2',
      title: 'Article copy link interaction',
      userGoal: '在文章详情页新增复制文章链接交互。',
      targetSurface: 'article_detail',
      acceptanceCriteria: ['文章详情页展示复制链接按钮。', '点击按钮会调用 clipboard 写入当前文章链接。'],
      requiresBackend: false,
      requiresDatabase: false,
      verification: ['Run copy article link interaction test.'],
    };
  }

  #buildArticleSummaryFieldDsl(): ConduitRequirementDsl {
    return {
      operation: 'add_field',
      level: 'L3',
      title: 'Article summary field propagation',
      userGoal: '给文章新增 summary 字段并贯通数据库、后端 API 与前端展示。',
      targetSurface: 'article_detail',
      acceptanceCriteria: [
        'Article 模型和迁移包含 summary 字段。',
        '文章接口返回 summary。',
        '前端文章详情页展示 summary。',
      ],
      requiresBackend: true,
      requiresDatabase: true,
      verification: ['Run article summary field backend/frontend tests.'],
    };
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
