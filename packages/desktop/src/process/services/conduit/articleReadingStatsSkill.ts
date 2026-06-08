/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CONDUIT_READING_STATS_SKILL_ID, type ConduitPatchFile } from '@/common/types/conduitDelivery';
import type { ConduitDeliverySkill } from './ConduitSkillRegistry';

const matcherPhrases = [
  'word count',
  'estimated reading time',
  'reading time',
  'article detail',
  '字数统计',
  '预计阅读',
  '阅读时间',
  '文章详情',
];

const helperContent = [
  'export const WORDS_PER_MINUTE = 200;',
  '',
  'function normalizeArticleText(body) {',
  '  if (!body) return "";',
  '',
  '  return String(body)',
  '    .replace(/```[\\s\\S]*?```/g, " ")',
  '    .replace(/`([^`]*)`/g, "$1")',
  '    .replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g, " ")',
  '    .replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, "$1")',
  '    .replace(/<[^>]+>/g, " ")',
  '    .replace(/[#>*_~|\\-]+/g, " ")',
  '    .replace(/[^\\p{L}\\p{N}]+/gu, " ")',
  '    .trim();',
  '}',
  '',
  'export default function articleReadingStats(body) {',
  '  const text = normalizeArticleText(body);',
  '  if (!text) {',
  '    return { wordCount: 0, readingTimeMinutes: 0 };',
  '  }',
  '',
  '  const wordCount = text.split(/\\s+/u).filter(Boolean).length;',
  '  const readingTimeMinutes = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));',
  '',
  '  return { wordCount, readingTimeMinutes };',
  '}',
  '',
].join('\n');

const helperTestContent = [
  'import articleReadingStats from "./articleReadingStats";',
  '',
  'it("returns zero stats for an empty article body", () => {',
  '  expect(articleReadingStats()).toEqual({ wordCount: 0, readingTimeMinutes: 0 });',
  '  expect(articleReadingStats("   ")).toEqual({ wordCount: 0, readingTimeMinutes: 0 });',
  '});',
  '',
  'it("counts visible words after stripping Markdown syntax", () => {',
  '  const body = [',
  '    "# Heading",',
  '    "",',
  '    "This **article** links to [Conduit](https://example.com) and skips ![image alt](image.png).",',
  '    "",',
  '    "```",',
  '    "const hidden = true;",',
  '    "```",',
  '  ].join("\\n");',
  '',
  '  expect(articleReadingStats(body).wordCount).toBe(8);',
  '});',
  '',
  'it("rounds nonzero reading time up to at least one minute", () => {',
  '  expect(articleReadingStats("one two three")).toEqual({ wordCount: 3, readingTimeMinutes: 1 });',
  '});',
  '',
  'it("rounds longer articles up using 200 words per minute", () => {',
  '  const body = Array.from({ length: 201 }, (_, index) => `word${index}`).join(" ");',
  '',
  '  expect(articleReadingStats(body)).toEqual({ wordCount: 201, readingTimeMinutes: 2 });',
  '});',
  '',
].join('\n');

const articleContent = `import Markdown from "markdown-to-jsx";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ArticleMeta from "../../components/ArticleMeta";
import ArticlesButtons from "../../components/ArticlesButtons";
import ArticleTags from "../../components/ArticleTags";
import BannerContainer from "../../components/BannerContainer";
import { useAuth } from "../../context/AuthContext";
import articleReadingStats from "../../helpers/articleReadingStats";
import getArticle from "../../services/getArticle";

function Article() {
  const { state } = useLocation();
  const [article, setArticle] = useState(state || {});
  const { title, body, tagList, createdAt, author } = article || {};
  const { headers, isAuth } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const readingStats = articleReadingStats(body);

  useEffect(() => {
    if (state) return;

    getArticle({ slug, headers })
      .then(setArticle)
      .catch((error) => {
        console.error(error);
        navigate("/not-found", { replace: true });
      });
  }, [isAuth, slug, headers, state, navigate]);

  return (
    <div className="article-page">
      <BannerContainer>
        <h1>{title}</h1>
        <ArticleMeta author={author} createdAt={createdAt}>
          <ArticlesButtons article={article} setArticle={setArticle} />
        </ArticleMeta>
      </BannerContainer>

      <div className="container page">
        <div className="row article-content">
          <div className="col-md-12">
            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}
            {body && (
              <p className="article-reading-stats">
                This article has {readingStats.wordCount} words and takes about {readingStats.readingTimeMinutes} min to read.
              </p>
            )}
            <ArticleTags tagList={tagList} />
          </div>
        </div>

        <hr />

        <div className="article-actions">
          <ArticleMeta author={author} createdAt={createdAt}>
            <ArticlesButtons article={article} setArticle={setArticle} />
          </ArticleMeta>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

export default Article;
`;

const patches: ConduitPatchFile[] = [
  {
    path: 'frontend/src/helpers/articleReadingStats.js',
    operation: 'create_or_replace',
    content: helperContent,
  },
  {
    path: 'frontend/src/helpers/articleReadingStats.test.js',
    operation: 'create_or_replace',
    content: helperTestContent,
  },
  {
    path: 'frontend/src/routes/Article/Article.jsx',
    operation: 'replace',
    content: articleContent,
  },
];

export function createArticleReadingStatsSkill(): ConduitDeliverySkill {
  return {
    id: CONDUIT_READING_STATS_SKILL_ID,
    name: 'Article reading statistics',
    level: 'L1',
    description: 'Shows article word count and estimated reading time on the Conduit article detail page.',
    matcherPhrases,
    targetFiles: patches.map((patch) => ({ path: patch.path, purpose: patch.operation })),
    verificationCommands: [
      {
        id: 'article-reading-stats-test',
        command: 'npm',
        args: ['run', 'test', '--', 'frontend/src/helpers/articleReadingStats.test.js'],
        description: 'Run the focused Vitest helper test for article reading stats.',
      },
      {
        id: 'root-test',
        command: 'npm',
        args: ['run', 'test'],
        description: 'Run the Conduit root Vitest suite.',
      },
    ],
    matches(requirement) {
      const normalized = requirement.toLowerCase();
      const hasArticleContext = matcherPhrases.some((phrase) => normalized.includes(phrase.toLowerCase()));
      const hasReadingSignal =
        normalized.includes('word') ||
        normalized.includes('reading') ||
        requirement.includes('字数') ||
        requirement.includes('阅读');
      return hasArticleContext && hasReadingSignal;
    },
    buildPatches() {
      return patches.map((patch) => ({ ...patch }));
    },
    buildPlan() {
      return [
        'Clarify that the statistic is derived from Article.body on the detail page.',
        'Add a pure frontend helper that strips Markdown and calculates word count plus reading time.',
        'Render the statistic below the article body and above tags.',
        'Run focused helper tests and report the actual verification status.',
      ];
    },
  };
}
