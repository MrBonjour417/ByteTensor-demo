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

  it('keeps unsupported article surfaces in clarification instead of finalizing article-detail DSL', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章列表展示字数和预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
  });

  it('does not treat non-article detail pages as article detail delivery', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['用户详情页展示字数和预计阅读时间']);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
  });

  it('respects a later correction away from article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      '改为用户详情页展示字数和预计阅读时间',
    ]);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
  });

  it('treats the latest requested surface as authoritative when it rejects article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      '不要文章详情页，改为首页展示字数和预计阅读时间',
    ]);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
  });

  it('blocks latest corrections that explicitly reject article detail', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      '不是文章详情页，要展示字数和预计阅读时间',
    ]);

    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') throw new Error('Expected clarification result.');
    expect(result.questions).toContain('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
  });

  it('allows generic wording corrections after article-detail target is established', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      '改成显示在正文下方',
    ]);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl.targetSurface).toBe('article_detail');
  });

  it('does not finalize when latest clarification removes word-count output', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze([
      '文章详情页展示字数和预计阅读时间',
      '不要字数，只保留预计阅读时间',
    ]);

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
    expect(result.questions).toContain('P0 仅支持文章详情页交付，请确认是否改为文章详情页。');
  });

  it('allows a later clarification to replace an unsupported article surface', () => {
    const clarifier = new ConduitClarifier();

    const result = clarifier.analyze(['文章列表展示字数和预计阅读时间', '改为文章详情页']);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready result.');
    expect(result.dsl.targetSurface).toBe('article_detail');
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
