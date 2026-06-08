/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { CONDUIT_READING_STATS_SKILL_ID } from '@/common/types/conduitDelivery';
import { ConduitSkillRegistry } from '@process/services/conduit/ConduitSkillRegistry';
import { createArticleReadingStatsSkill } from '@process/services/conduit/articleReadingStatsSkill';

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
});
