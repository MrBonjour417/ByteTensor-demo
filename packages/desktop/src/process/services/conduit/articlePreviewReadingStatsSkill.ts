/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID, type ConduitPatchFile } from '@/common/types/conduitDelivery';
import type { ConduitDeliverySkill } from './ConduitSkillRegistry';

const matcher =
  /(?:article preview|preview card|article list|feed|文章列表|列表页|文章卡片).*?(?:word count|reading time|字数|阅读时间)|(?:word count|reading time|字数|阅读时间).*?(?:article preview|preview card|article list|feed|文章列表|列表页|文章卡片)/i;

const helper =
  'export const WORDS_PER_MINUTE = 200;\n\nfunction normalizeArticleText(body) {\n  if (!body) return "";\n  return String(body).replace(/<[^>]+>/g, " ").replace(/[^\\p{L}\\p{N}]+/gu, " ").trim();\n}\n\nexport default function articleReadingStats(body) {\n  const text = normalizeArticleText(body);\n  if (!text) return { wordCount: 0, readingTimeMinutes: 0 };\n  const wordCount = text.split(/\\s+/u).filter(Boolean).length;\n  return { wordCount, readingTimeMinutes: Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)) };\n}\n';
const preview =
  'import { Link } from "react-router-dom";\nimport articleReadingStats from "../../helpers/articleReadingStats";\nimport ArticleMeta from "../ArticleMeta";\nimport ArticleTags from "../ArticleTags";\nimport FavButton from "../FavButton";\n\nfunction ArticlesPreview({ articles, loading, updateArticles }) {\n  const handleFav = (article) => {\n    const items = [...articles];\n\n    const updatedArticles = items.map((item) =>\n      item.slug === article.slug ? { ...item, ...article } : item,\n    );\n\n    updateArticles((prev) => ({ ...prev, articles: updatedArticles }));\n  };\n\n  return articles?.length > 0 ? (\n    articles.map((article) => {\n      const readingStats = articleReadingStats(article.body);\n\n      return (\n        <div className="article-preview" key={article.slug}>\n          <ArticleMeta author={article.author} createdAt={article.createdAt}>\n            <FavButton\n              favorited={article.favorited}\n              favoritesCount={article.favoritesCount}\n              handler={handleFav}\n              right\n              slug={article.slug}\n            />\n          </ArticleMeta>\n          <Link\n            to={`/article/${article.slug}`}\n            state={article}\n            className="preview-link"\n          >\n            <h1>{article.title}</h1>\n            <p>{article.description}</p>\n            {readingStats.wordCount > 0 && (\n              <span className="article-reading-stats">\n                {readingStats.wordCount} words \u00b7 {readingStats.readingTimeMinutes} min read\n              </span>\n            )}\n            <span>Read more...</span>\n            <ArticleTags tagList={article.tagList} />\n          </Link>\n        </div>\n      );\n    })\n  ) : loading ? (\n    <div className="article-preview">Loading article...</div>\n  ) : (\n    <div className="article-preview">No articles available.</div>\n  );\n}\n\nexport default ArticlesPreview;\n';
const test =
  'import { describe, expect, it, vi } from "vitest";\nimport { render, screen } from "@testing-library/react";\nimport { MemoryRouter } from "react-router-dom";\nimport ArticlesPreview from "./ArticlesPreview";\n\nvi.mock("../ArticleMeta", () => ({ default: ({ children }) => <div>{children}</div> }));\nvi.mock("../ArticleTags", () => ({ default: () => <div /> }));\nvi.mock("../FavButton", () => ({ default: () => <button>Favorite</button> }));\n\ndescribe("ArticlesPreview reading stats", () => {\n  it("shows word count and reading time without removing existing card behavior", () => {\n    render(<MemoryRouter><ArticlesPreview articles={[{ slug: "a", title: "A", description: "D", body: "one two three", author: {}, tagList: [], favorited: false, favoritesCount: 0 }]} loading={false} updateArticles={() => undefined} /></MemoryRouter>);\n    expect(screen.getByText("3 words \u00b7 1 min read")).toBeInTheDocument();\n    expect(screen.getByText("Favorite")).toBeInTheDocument();\n    expect(screen.getByText("Read more...")).toBeInTheDocument();\n  });\n});\n';

const patches: ConduitPatchFile[] = [
  { path: 'frontend/src/helpers/articleReadingStats.js', content: helper, operation: 'create_or_replace' },
  {
    path: 'frontend/src/components/ArticlesPreview/ArticlesPreview.jsx',
    content: preview,
    operation: 'create_or_replace',
  },
  {
    path: 'frontend/src/components/ArticlesPreview/ArticlesPreview.test.jsx',
    content: test,
    operation: 'create_or_replace',
  },
];

export function createArticlePreviewReadingStatsSkill(): ConduitDeliverySkill {
  return {
    id: CONDUIT_ARTICLE_PREVIEW_READING_STATS_SKILL_ID,
    name: 'Article preview reading statistics',
    level: 'L1',
    description: 'Show word count and estimated reading time on Conduit article preview cards.',
    matcherPhrases: ['article preview', 'preview card', 'article list', 'word count', 'reading time', '文章列表'],
    targetFiles: patches.map((patch) => ({ path: patch.path, purpose: 'Skill patch target' })),
    verificationCommands: [
      {
        id: 'article-preview-reading-stats-test',
        command: 'npm',
        args: ['run', 'test', '--', 'frontend/src/components/ArticlesPreview/ArticlesPreview.test.jsx'],
        description: 'Run article preview reading statistics component test.',
      },
    ],
    matches: (requirement) => matcher.test(requirement),
    buildPlan: () => [
      'Reuse the article reading statistics helper.',
      'Render stats on article preview cards without removing existing card behavior.',
      'Cover preview-card stats with a focused component test.',
    ],
    buildPatches: () => patches,
  };
}
