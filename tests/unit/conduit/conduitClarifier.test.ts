/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { ConduitClarifier } from '@process/services/conduit/ConduitClarifier';

describe('ConduitClarifier', () => {
  it('asks for clarification when the PM input lacks a target surface', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['加一个统计信息']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('这个统计信息要展示在哪个 Conduit 页面或组件上？');
  });

  it('keeps unsupported home/feed surfaces in clarification instead of finalizing delivery DSL', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['首页展示字数和预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。');
  });

  it('builds a preview-card DSL for article-list reading-statistics requirements', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['show word count and estimated reading time on article preview cards']);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl).toMatchObject({
      level: 'L1',
      targetSurface: 'article_list',
      userGoal: 'Show word count and estimated reading time on Conduit article preview cards.',
    });
  });

  it('builds an L2 comments-count DSL for backend article API requirements', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['add commentsCount from the backend API to article detail pages']);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl).toMatchObject({
      level: 'L2',
      targetSurface: 'article_detail',
      requiresBackend: true,
      userGoal: 'Add commentsCount from the backend API to Conduit article detail pages.',
    });
  });

  it('does not treat non-article detail pages as article detail delivery', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['用户详情页展示字数和预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。');
  });

  it('respects a later correction away from article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章详情页展示字数和预计阅读时间', '改为用户详情页展示字数和预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。');
  });

  it('treats the latest requested surface as authoritative when it rejects article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      '不要文章详情页，改为首页展示字数和预计阅读时间',
    ]);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。');
  });

  it('blocks latest corrections that explicitly reject article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章详情页展示字数和预计阅读时间', '不是文章详情页，要展示字数和预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。');
  });

  it('allows generic wording corrections after article-detail target is established', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章详情页展示字数和预计阅读时间', '改成显示在正文下方']);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl.targetSurface).toBe('article_detail');
  });

  it('does not finalize when latest clarification removes word-count output', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章详情页展示字数和预计阅读时间', '不要字数，只保留预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('是否需要展示文章字数？');
  });

  it('does not finalize when latest English clarification removes word count', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      'article detail page word count and reading time',
      'only reading time on the article detail page, no word count',
    ]);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('是否需要展示文章字数？');
  });

  it('keeps complete English requirements with only and now ready', () => {
    const clarifier = new ConduitClarifier();

    expect(clarifier.analyze(['only show article word count and reading time on the article detail page']).status).toBe(
      'ready'
    );
    expect(clarifier.analyze(['now show article detail page word count and reading time']).status).toBe('ready');
  });

  it('blocks later corrections to other named surfaces outside article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      'change it to the profile page with word count and reading time',
    ]);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0/P1/P2 当前仅支持文章详情页或文章列表卡片交付，请确认目标页面。');
  });

  it('allows a later clarification to replace an unsupported article surface', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章列表展示字数和预计阅读时间', '改为文章详情页']);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl.targetSurface).toBe('article_detail');
  });

  it('lets the latest clarification switch a ready article-detail request to preview cards', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      'article detail word count and reading time',
      'change it to article preview cards',
    ]);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl.targetSurface).toBe('article_list');
    expect(result.dsl.userGoal).toBe('Show word count and estimated reading time on Conduit article preview cards.');
  });

  it('builds an L1 article reading-statistics DSL when the input is sufficient', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章详情页展示字数和预计阅读时间']);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl).toMatchObject({
      level: 'L1',
      targetSurface: 'article_detail',
      requiresBackend: false,
      requiresDatabase: false,
    });
    expect(result.dsl.acceptanceCriteria).toContain(
      'Article detail pages show article word count when Article.body exists.'
    );
  });
});
