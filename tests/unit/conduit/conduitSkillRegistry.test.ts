/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  CONDUIT_ARTICLE_COMMENT_COUNT_SKILL_ID,
  CONDUIT_ARTICLE_FAVORITE_FILTER_SKILL_ID,
  CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID,
  CONDUIT_ARTICLE_SUMMARY_FIELD_SKILL_ID,
  CONDUIT_COPY_ARTICLE_LINK_SKILL_ID,
  CONDUIT_HELP_PAGE_SKILL_ID,
  CONDUIT_READING_STATS_SKILL_ID,
} from '@/common/types/conduitDelivery';
import { ConduitSkillRegistry } from '@process/services/conduit/ConduitSkillRegistry';
import { createArticleCommentCountSkill } from '@process/services/conduit/articleCommentCountSkill';
import { createArticlePreviewReadingStatsSkill } from '@process/services/conduit/articlePreviewReadingStatsSkill';
import { createArticleReadingStatsSkill } from '@process/services/conduit/articleReadingStatsSkill';
import {
  createArticleFavoriteFilterSkill,
  createArticleSummaryFieldSkill,
  createConduitHelpPageSkill,
  createCopyArticleLinkSkill,
} from '@process/services/conduit/genericConduitSkills';

describe('ConduitSkillRegistry', () => {
  it('selects the article reading-stat Skill for the English L1 requirement', () => {
    const registry = new ConduitSkillRegistry([createArticleReadingStatsSkill()]);

    const skill = registry.selectSkill('show article word count and estimated reading time on the article detail page');

    expect(skill?.id).toBe(CONDUIT_READING_STATS_SKILL_ID);
  });

  it('selects the article reading-stat Skill for the Chinese L1 requirement', () => {
    const registry = new ConduitSkillRegistry([createArticleReadingStatsSkill()]);

    const skill = registry.selectSkill('文章详情页新增字数统计，在正文下方显示预计阅读时间');

    expect(skill?.id).toBe(CONDUIT_READING_STATS_SKILL_ID);
  });

  it('selects the article preview reading-stat Skill for article list cards', () => {
    const registry = new ConduitSkillRegistry([createArticlePreviewReadingStatsSkill()]);

    const skill = registry.selectSkill('show word count and estimated reading time on article preview cards');

    expect(skill?.id).toBe(CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID);
  });

  it('selects the L2 comment-count Skill for backend-to-frontend article field propagation', () => {
    const registry = new ConduitSkillRegistry([createArticleCommentCountSkill()]);

    const skill = registry.selectSkill('add comments count field from backend API and show it on article detail');

    expect(skill?.id).toBe(CONDUIT_ARTICLE_COMMENT_COUNT_SKILL_ID);
  });

  it('selects generic Skill family members for add_filter/add_page/add_interaction/add_field requests', () => {
    const registry = new ConduitSkillRegistry([
      createArticleFavoriteFilterSkill(),
      createConduitHelpPageSkill(),
      createCopyArticleLinkSkill(),
      createArticleSummaryFieldSkill(),
    ]);

    expect(registry.selectSkill('新增文章收藏筛选器')?.id).toBe(CONDUIT_ARTICLE_FAVORITE_FILTER_SKILL_ID);
    expect(registry.selectSkill('新增帮助页面')?.id).toBe(CONDUIT_HELP_PAGE_SKILL_ID);
    expect(registry.selectSkill('文章详情页新增复制链接交互')?.id).toBe(CONDUIT_COPY_ARTICLE_LINK_SKILL_ID);
    expect(registry.selectSkill('给文章新增 summary 字段并贯通前后端')?.id).toBe(
      CONDUIT_ARTICLE_SUMMARY_FIELD_SKILL_ID
    );
  });

  it('keeps commentsCount field propagation on the dedicated comments-count Skill', () => {
    const registry = new ConduitSkillRegistry([
      createArticleFavoriteFilterSkill(),
      createConduitHelpPageSkill(),
      createCopyArticleLinkSkill(),
      createArticleSummaryFieldSkill(),
      createArticleCommentCountSkill(),
    ]);

    expect(
      registry.selectSkill('Add commentsCount field from the backend API to Conduit article detail pages')?.id
    ).toBe(CONDUIT_ARTICLE_COMMENT_COUNT_SKILL_ID);
  });

  it('does not select a Skill for an unrelated Conduit requirement', () => {
    const registry = new ConduitSkillRegistry([createArticleReadingStatsSkill()]);

    expect(registry.selectSkill('add cover image support to article editor')).toBeUndefined();
  });

  it('builds the deterministic three-file Conduit patch', () => {
    const skill = createArticleReadingStatsSkill();

    const patches = skill.buildPatches();

    expect(patches.map((patch) => patch.path)).toEqual([
      'frontend/src/helpers/articleReadingStats.js',
      'frontend/src/helpers/articleReadingStats.test.js',
      'frontend/src/routes/Article/Article.jsx',
    ]);
    expect(patches[0].content).toContain('WORDS_PER_MINUTE = 200');
    expect(patches[1].content).toContain('rounds nonzero reading time up to at least one minute');
    expect(patches[2].content).toContain('This article has');
  });

  it('builds a frontend article-preview Skill patch', () => {
    const skill = createArticlePreviewReadingStatsSkill();

    expect(skill.buildPatches().map((patch) => patch.path)).toEqual([
      'frontend/src/helpers/articleReadingStats.js',
      'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx',
      'frontend/src/components/ArticlesPreview/ArticlesPreview.test.jsx',
    ]);
    const previewContent = skill.buildPatches()[1].content;
    expect(previewContent).toContain('FavButton');
    expect(previewContent).toContain('state={article}');
    expect(previewContent).toContain('Loading article...');
  });

  it('builds an L2 comment-count cross-stack patch', () => {
    const skill = createArticleCommentCountSkill();

    expect(skill.buildPatches().map((patch) => patch.path)).toEqual([
      'backend/helper/helpers.js',
      'backend/helper/helpers.test.js',
      'backend/controllers/articles.js',
      'frontend/src/routes/Article/Article.jsx',
      'frontend/src/routes/Article/Article.test.jsx',
    ]);
    const patches = skill.buildPatches();
    expect(patches[2].content).toContain('const allArticles = async');
    expect(patches[2].content).toContain('module.exports = {');
    expect(patches[2].content).toContain('singleArticle');
    expect(skill.buildPlan().some((step) => step.includes('backend'))).toBe(true);
    expect(patches[3].content).not.toContain('articleReadingStats');
  });

  it('builds the article favorite filter Skill patch without backend schema changes', () => {
    const skill = createArticleFavoriteFilterSkill();
    const patches = skill.buildPatches();

    expect(patches.map((patch) => patch.path)).toEqual([
      'frontend/src/context/FeedContext.jsx',
      'frontend/src/components/FeedToggler/FeedToggler.jsx',
      'frontend/src/routes/HomeArticles.jsx',
      'frontend/src/services/getArticles.test.js',
    ]);
    expect(patches[1].content).toContain('Favorited Articles');
    expect(patches[2].content).toContain('loggedUser.username');
    expect(skill.verificationCommands[0].args).toContain('frontend/src/services/getArticles.test.js');
  });

  it('mounts the copy-link interaction in the article detail UI', () => {
    const skill = createCopyArticleLinkSkill();
    const patches = skill.buildPatches();

    expect(patches.map((patch) => patch.path)).toContain('frontend/src/routes/Article/Article.jsx');
    expect(patches.find((patch) => patch.path.endsWith('Article.jsx'))?.content).toContain('CopyArticleLinkButton');
  });

  it('propagates the summary field through backend API and frontend article detail patches', () => {
    const skill = createArticleSummaryFieldSkill();
    const patchPaths = skill.buildPatches().map((patch) => patch.path);

    expect(patchPaths).toEqual([
      'backend/migrations/20260609000000-add-article-summary.js',
      'backend/models/Article.js',
      'backend/controllers/articles.js',
      'frontend/src/services/setArticle.js',
      'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx',
      'frontend/src/routes/Article/Article.jsx',
      'backend/models/Article.test.js',
      'frontend/src/routes/Article/Article.test.jsx',
    ]);
    expect(skill.buildPatches().find((patch) => patch.path === 'backend/controllers/articles.js')?.content).toContain(
      'summary: summary'
    );
    expect(skill.buildPatches().find((patch) => patch.path === 'backend/controllers/articles.js')?.content).toContain(
      'const allArticles = async'
    );
    expect(
      skill.buildPatches().find((patch) => patch.path === 'frontend/src/routes/Article/Article.jsx')?.content
    ).toContain('article-summary');
  });
});
