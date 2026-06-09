/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CONDUIT_ARTICLE_FAVORITE_FILTER_SKILL_ID,
  CONDUIT_ARTICLE_SUMMARY_FIELD_SKILL_ID,
  CONDUIT_COPY_ARTICLE_LINK_SKILL_ID,
  CONDUIT_HELP_PAGE_SKILL_ID,
  type ConduitPatchFile,
} from '@/common/types/conduitDelivery';
import type { ConduitDeliverySkill } from './ConduitSkillRegistry';

const feedContextContent = String.raw`import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const FeedContext = createContext();

export function useFeedContext() {
  return useContext(FeedContext);
}

function FeedProvider({ children }) {
  const { isAuth } = useAuth();
  const [{ tabName, tagName }, setTab] = useState({
    tabName: isAuth ? "feed" : "global",
    tagName: "",
  });

  useEffect(() => {
    setTab((tab) => ({ ...tab, tabName: isAuth ? "feed" : "global" }));
  }, [isAuth]);

  const changeTab = async (e, tabName) => {
    const tagName = e.target.innerText.trim();

    setTab({ tabName, tagName });
  };

  return (
    <FeedContext.Provider value={{ changeTab, tabName, tagName }}>
      {children}
    </FeedContext.Provider>
  );
}

export default FeedProvider;
`;
const feedTogglerContent = String.raw`import { useAuth } from "../../context/AuthContext";
import { useFeedContext } from "../../context/FeedContext";
import FeedNavLink from "./FeedNavLink";

function FeedToggler() {
  const { isAuth } = useAuth();
  const { tabName, tagName } = useFeedContext();

  return (
    <div className="feed-toggle">
      <ul className="nav nav-pills outline-active">
        {isAuth && <FeedNavLink name="feed" text="Your Feed" />}
        {isAuth && <FeedNavLink name="favorites" text="Favorited Articles" />}

        <FeedNavLink name="global" text="Global Feed" />

        {tabName === "tag" && <FeedNavLink icon name="tag" text={tagName} />}
      </ul>
    </div>
  );
}

export default FeedToggler;
`;
const homeArticlesContent = String.raw`import ArticlesPagination from "../components/ArticlesPagination";
import ArticlesPreview from "../components/ArticlesPreview";
import { useAuth } from "../context/AuthContext";
import { useFeedContext } from "../context/FeedContext";
import useArticleList from "../hooks/useArticles";

function HomeArticles() {
  const { tabName, tagName } = useFeedContext();
  const { loggedUser } = useAuth();

  const { articles, articlesCount, loading, setArticlesData } = useArticleList({
    location: tabName,
    tabName,
    tagName,
    username: tabName === "favorites" ? loggedUser.username : undefined,
  });

  return loading ? (
    <div className="article-preview">
      <em>Loading articles list...</em>
    </div>
  ) : articles.length > 0 ? (
    <>
      <ArticlesPreview
        articles={articles}
        loading={loading}
        updateArticles={setArticlesData}
      />

      <ArticlesPagination
        articlesCount={articlesCount}
        location={tabName}
        tagName={tagName}
        updateArticles={setArticlesData}
      />
    </>
  ) : (
    <div className="article-preview">Articles not available.</div>
  );
}

export default HomeArticles;
`;
const getArticlesTestContent = String.raw`import { describe, expect, it, vi } from "vitest";
import axios from "axios";
import getArticles from "./getArticles";

vi.mock("axios", () => ({ default: vi.fn(async () => ({ data: { articles: [], articlesCount: 0 } })) }));
vi.mock("../helpers/errorHandler", () => ({ default: vi.fn() }));

describe("getArticles favorite filter", () => {
  it("requests favorited articles for the selected username", async () => {
    await getArticles({ location: "favorites", username: "jane", limit: 3, page: 0 });

    expect(axios).toHaveBeenCalledWith({
      url: "api/articles?favorited=jane&&limit=3&&offset=0",
      headers: undefined,
    });
  });
});
`;
const helpPageContent = String.raw`function Help() {
  return (
    <div className="container page">
      <div className="row">
        <div className="col-md-10 offset-md-1">
          <h1>Conduit Help</h1>
          <p>Use the global feed, your feed, tags, and article pages to read and share knowledge.</p>
        </div>
      </div>
    </div>
  );
}

export default Help;
`;
const helpPageTestContent = String.raw`import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Help from "./Help";

describe("Help page", () => {
  it("renders Conduit help content", () => {
    render(<Help />);

    expect(screen.getByText("Conduit Help")).toBeInTheDocument();
  });
});
`;
const mainWithHelpContent = String.raw`import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import AuthProvider from "./context/AuthContext";
import "./styles.css";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import Article from "./routes/Article/Article";
import CommentsSection from "./routes/Article/CommentsSection";
import ArticleEditor from "./routes/ArticleEditor";
import Help from "./routes/Help";
import Home from "./routes/Home";
import HomeArticles from "./routes/HomeArticles";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";
import Profile from "./routes/Profile/Profile";
import ProfileArticles from "./routes/Profile/ProfileArticles";
import ProfileFavArticles from "./routes/Profile/ProfileFavArticles";
import Settings from "./routes/Settings";
import SignUp from "./routes/SignUp";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<Home />}>
              <Route index element={<HomeArticles />} />
            </Route>

            <Route path="help" element={<Help />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<SignUp />} />

            <Route path="settings" element={<Settings />} />

            <Route path="editor" element={<ArticleEditor />}>
              <Route path=":slug" element={<ArticleEditor />} />
            </Route>

            <Route path="article/:slug" element={<Article />}>
              <Route index element={<CommentsSection />} />
            </Route>

            <Route path="profile/:username" element={<Profile />}>
              <Route index element={<ProfileArticles />} />
              <Route path="favorites" element={<ProfileFavArticles />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);

reportWebVitals();
`;
const copyArticleLinkContent = String.raw`function CopyArticleLinkButton({ slug }) {
  const copyLink = async () => {
    const path = slug ? "#/article/" + slug : window.location.hash;
    await navigator.clipboard.writeText(window.location.origin + "/" + path);
  };

  return (
    <button className="btn btn-sm btn-outline-secondary" type="button" onClick={copyLink}>
      Copy article link
    </button>
  );
}

export default CopyArticleLinkButton;
`;
const copyArticleLinkTestContent = String.raw`import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CopyArticleLinkButton from "./CopyArticleLinkButton";

describe("CopyArticleLinkButton", () => {
  it("copies the article hash link", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyArticleLinkButton slug="hello-world" />);

    fireEvent.click(screen.getByText("Copy article link"));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#/article/hello-world"));
  });
});
`;
const copyArticleContent = String.raw`import Markdown from "markdown-to-jsx";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ArticleMeta from "../../components/ArticleMeta";
import ArticlesButtons from "../../components/ArticlesButtons";
import ArticleTags from "../../components/ArticleTags";
import BannerContainer from "../../components/BannerContainer";
import CopyArticleLinkButton from "../../components/CopyArticleLinkButton";
import { useAuth } from "../../context/AuthContext";
import getArticle from "../../services/getArticle";

function Article() {
  const { state } = useLocation();
  const [article, setArticle] = useState(state || {});
  const { title, body, tagList, createdAt, author } = article || {};
  const { headers, isAuth } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();

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
          <CopyArticleLinkButton slug={slug} />
        </ArticleMeta>
      </BannerContainer>

      <div className="container page">
        <div className="row article-content">
          <div className="col-md-12">
            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}
            <ArticleTags tagList={tagList} />
          </div>
        </div>

        <hr />

        <div className="article-actions">
          <ArticleMeta author={author} createdAt={createdAt}>
            <ArticlesButtons article={article} setArticle={setArticle} />
            <CopyArticleLinkButton slug={slug} />
          </ArticleMeta>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

export default Article;
`;
const articleSummaryMigrationContent = String.raw`"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Articles", "summary", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("Articles", "summary");
  },
};
`;
const articleSummaryModelContent = String.raw`"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Article extends Model {
    static associate({ User, Tag, Comment }) {
      this.belongsTo(User, { foreignKey: "userId", as: "author" });
      this.hasMany(Comment, { foreignKey: "articleId", onDelete: "cascade" });
      this.belongsToMany(Tag, {
        through: "TagList",
        as: "tagList",
        foreignKey: "articleId",
        timestamps: false,
        onDelete: "cascade",
      });
      this.belongsToMany(User, {
        through: "Favorites",
        foreignKey: "articleId",
        timestamps: false,
      });
    }

    toJSON() {
      return {
        ...this.get(),
        id: undefined,
        userId: undefined,
      };
    }
  }
  Article.init(
    {
      slug: DataTypes.STRING,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      summary: DataTypes.TEXT,
      body: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Article",
    },
  );
  return Article;
};
`;
const articleSummaryControllerContent = String.raw`const {
  AlreadyTakenError,
  FieldRequiredError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} = require("../helper/customErrors");
const {
  appendFollowers,
  appendFavorites,
  appendTagList,
  slugify,
} = require("../helper/helpers");
const { Article, Tag, User } = require("../models");

const includeOptions = [
  { model: Tag, as: "tagList", attributes: ["name"] },
  { model: User, as: "author", attributes: { exclude: ["email"] } },
];

//? All Articles - by Author/by Tag/Favorited by user
const allArticles = async (req, res, next) => {
  try {
    const { loggedUser } = req;

    const { author, tag, favorited, limit = 3, offset = 0 } = req.query;
    const searchOptions = {
      include: [
        {
          model: Tag,
          as: "tagList",
          attributes: ["name"],
          ...(tag && { where: { name: tag } }),
        },
        {
          model: User,
          as: "author",
          attributes: { exclude: ["email"] },
          ...(author && { where: { username: author } }),
        },
      ],
      limit: parseInt(limit),
      offset: offset * limit,
      order: [["createdAt", "DESC"]],
    };

    let articles = { rows: [], count: 0 };
    if (favorited) {
      const user = await User.findOne({ where: { username: favorited } });

      articles.rows = await user.getFavorites(searchOptions);
      articles.count = await user.countFavorites();
    } else {
      articles = await Article.findAndCountAll(searchOptions);
    }

    for (let article of articles.rows) {
      const articleTags = await article.getTagList();

      appendTagList(articleTags, article);
      await appendFollowers(loggedUser, article);
      await appendFavorites(loggedUser, article);

      delete article.dataValues.Favorites;
    }

    res.json({ articles: articles.rows, articlesCount: articles.count });
  } catch (error) {
    next(error);
  }
};

//* Create Article
const createArticle = async (req, res, next) => {
  try {
    const { loggedUser } = req;
    if (!loggedUser) throw new UnauthorizedError();

    const { title, description, summary, body, tagList } = req.body.article;
    if (!title) throw new FieldRequiredError("A title");
    if (!description) throw new FieldRequiredError("A description");
    if (!body) throw new FieldRequiredError("An article body");

    const slug = slugify(title);
    const slugInDB = await Article.findOne({ where: { slug: slug } });
    if (slugInDB) throw new AlreadyTakenError("Title");

    const article = await Article.create({
      slug: slug,
      title: title,
      description: description,
      summary: summary,
      body: body,
    });

    for (const tag of tagList) {
      const tagInDB = await Tag.findByPk(tag.trim());

      if (tagInDB) {
        await article.addTagList(tagInDB);
      } else if (tag.length > 2) {
        const newTag = await Tag.create({ name: tag.trim() });

        await article.addTagList(newTag);
      }
    }

    delete loggedUser.dataValues.token;

    article.dataValues.tagList = tagList;
    article.setAuthor(loggedUser);
    article.dataValues.author = loggedUser;
    await appendFollowers(loggedUser, loggedUser);
    await appendFavorites(loggedUser, article);

    res.status(201).json({ article });
  } catch (error) {
    next(error);
  }
};

//* Feed
const articlesFeed = async (req, res, next) => {
  try {
    const { loggedUser } = req;
    if (!loggedUser) throw new UnauthorizedError();

    const { limit = 3, offset = 0 } = req.query;
    const authors = await loggedUser.getFollowing();

    const articles = await Article.findAndCountAll({
      include: includeOptions,
      limit: parseInt(limit),
      offset: offset * limit,
      order: [["createdAt", "DESC"]],
      where: { userId: authors.map((author) => author.id) },
    });

    for (const article of articles.rows) {
      const articleTags = await article.getTagList();

      appendTagList(articleTags, article);
      await appendFollowers(loggedUser, article);
      await appendFavorites(loggedUser, article);
    }

    res.json({ articles: articles.rows, articlesCount: articles.count });
  } catch (error) {
    next(error);
  }
};

// Single Article by slug
const singleArticle = async (req, res, next) => {
  try {
    const { loggedUser } = req;

    const { slug } = req.params;
    const article = await Article.findOne({
      where: { slug: slug },
      include: includeOptions,
    });
    if (!article) throw new NotFoundError("Article");

    appendTagList(article.tagList, article);
    await appendFollowers(loggedUser, article);
    await appendFavorites(loggedUser, article);

    res.json({ article });
  } catch (error) {
    next(error);
  }
};

//* Update Article
const updateArticle = async (req, res, next) => {
  try {
    const { loggedUser } = req;
    if (!loggedUser) throw new UnauthorizedError();

    const { slug } = req.params;
    const article = await Article.findOne({
      where: { slug: slug },
      include: includeOptions,
    });
    if (!article) throw new NotFoundError("Article");

    if (loggedUser.id !== article.author.id) {
      throw new ForbiddenError("article");
    }

    const { title, description, summary, body } = req.body.article;
    if (title) {
      article.slug = slugify(title);
      article.title = title;
    }
    if (description) article.description = description;
    if (summary) article.summary = summary;
    if (body) article.body = body;
    await article.save();

    appendTagList(article.tagList, article);
    await appendFollowers(loggedUser, article);
    await appendFavorites(loggedUser, article);

    res.json({ article });
  } catch (error) {
    next(error);
  }
};

//* Delete Article
const deleteArticle = async (req, res, next) => {
  try {
    const { loggedUser } = req;
    if (!loggedUser) throw new UnauthorizedError();

    const { slug } = req.params;
    const article = await Article.findOne({
      where: { slug: slug },
      include: includeOptions,
    });
    if (!article) throw new NotFoundError("Article");

    if (loggedUser.id !== article.author.id) {
      throw new ForbiddenError("article");
    }

    await article.destroy();

    res.json({ message: { body: ["Article deleted successfully"] } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  allArticles,
  createArticle,
  singleArticle,
  updateArticle,
  deleteArticle,
  articlesFeed,
};
`;
const articleSummarySetArticleContent = String.raw`import axios from "axios";
import errorHandler from "../helpers/errorHandler";

async function setArticle({ body, description, headers, slug, summary, tagList, title }) {
  try {
    const { data } = await axios({
      data: { article: { title, description, summary, body, tagList } },
      headers,
      method: slug ? "PUT" : "POST",
      url: slug ? "api/articles/" + slug : "api/articles",
    });

    return data.article.slug;
  } catch (error) {
    errorHandler(error);
  }
}

export default setArticle;
`;
const articleSummaryEditorContent = String.raw`import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import getArticle from "../../services/getArticle";
import setArticle from "../../services/setArticle";
import FormFieldset from "../FormFieldset";

const emptyForm = { title: "", description: "", summary: "", body: "", tagList: "" };

function ArticleEditorForm() {
  const { state } = useLocation();
  const [{ title, description, summary, body, tagList }, setForm] = useState(state || emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const { isAuth, headers, loggedUser } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();

  useEffect(() => {
    const redirect = () => navigate("/", { replace: true, state: null });
    if (!isAuth) return redirect();
    if (state || !slug) return;
    getArticle({ headers, slug })
      .then(({ author: { username }, body, description, summary, tagList, title }) => {
        if (username !== loggedUser.username) redirect();
        setForm({ body, description, summary: summary || "", tagList, title });
      })
      .catch(console.error);
    return () => setForm(emptyForm);
  }, [headers, isAuth, loggedUser.username, navigate, slug, state]);

  const inputHandler = (e) => setForm((form) => ({ ...form, [e.target.name]: e.target.value }));
  const tagsInputHandler = (e) => setForm((form) => ({ ...form, tagList: e.target.value.split(/,| /) }));
  const formSubmit = (e) => {
    e.preventDefault();
    setArticle({ headers, slug, body, description, summary, tagList, title })
      .then((slug) => navigate("/article/" + slug))
      .catch(setErrorMessage);
  };

  return (
    <form onSubmit={formSubmit}>
      <fieldset>
        {errorMessage && <span className="error-messages">{errorMessage}</span>}
        <FormFieldset placeholder="Article Title" name="title" required value={title} handler={inputHandler}></FormFieldset>
        <FormFieldset normal placeholder="What's this article about?" name="description" required value={description} handler={inputHandler}></FormFieldset>
        <FormFieldset normal placeholder="Article summary" name="summary" value={summary} handler={inputHandler}></FormFieldset>
        <fieldset className="form-group">
          <textarea className="form-control" rows="8" placeholder="Write your article (in markdown)" name="body" required value={body} onChange={inputHandler}></textarea>
        </fieldset>
        <FormFieldset normal placeholder="Enter tags" name="tags" value={tagList} handler={tagsInputHandler}>
          <div className="tag-list"></div>
        </FormFieldset>
        <button className="btn btn-lg pull-xs-right btn-primary" type="submit">{slug ? "Update Article" : "Publish Article"}</button>
      </fieldset>
    </form>
  );
}

export default ArticleEditorForm;
`;
const articleSummaryArticleContent = String.raw`import Markdown from "markdown-to-jsx";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ArticleMeta from "../../components/ArticleMeta";
import ArticlesButtons from "../../components/ArticlesButtons";
import ArticleTags from "../../components/ArticleTags";
import BannerContainer from "../../components/BannerContainer";
import { useAuth } from "../../context/AuthContext";
import getArticle from "../../services/getArticle";

function Article() {
  const { state } = useLocation();
  const [article, setArticle] = useState(state || {});
  const { title, summary, body, tagList, createdAt, author } = article || {};
  const { headers, isAuth } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();

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
            {summary && <p className="article-summary">{summary}</p>}
            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}
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
const articleSummaryTestContent = String.raw`const { readFileSync } = require("fs");
const { join } = require("path");

describe("Article summary field", () => {
  it("defines a summary field", () => {
    const source = readFileSync(join(__dirname, "Article.js"), "utf8");
    expect(source).toContain("summary: DataTypes.TEXT");
  });
});
`;
const articleSummaryArticleTestContent = String.raw`import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Article from "./Article";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ headers: {}, isAuth: false }) }));
vi.mock("../../components/ArticleMeta", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../../components/ArticlesButtons", () => ({ default: () => <div /> }));
vi.mock("../../components/ArticleTags", () => ({ default: () => <div /> }));
vi.mock("../../components/BannerContainer", () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock("../../services/getArticle", () => ({ default: vi.fn() }));

describe("Article summary", () => {
  it("renders summary from article state", () => {
    render(<MemoryRouter initialEntries={[{ pathname: "/article/a", state: { title: "A", summary: "Short summary", body: "Body", tagList: [], author: {} } }]}><Routes><Route path="/article/:slug" element={<Article />} /></Routes></MemoryRouter>);
    expect(screen.getByText("Short summary")).toHaveClass("article-summary");
  });
});
`;

const favoritePatches: ConduitPatchFile[] = [
  { path: 'frontend/src/context/FeedContext.jsx', operation: 'replace', content: feedContextContent },
  { path: 'frontend/src/components/FeedToggler/FeedToggler.jsx', operation: 'replace', content: feedTogglerContent },
  { path: 'frontend/src/routes/HomeArticles.jsx', operation: 'replace', content: homeArticlesContent },
  {
    path: 'frontend/src/services/getArticles.test.js',
    operation: 'create_or_replace',
    content: getArticlesTestContent,
  },
];

const helpPagePatches: ConduitPatchFile[] = [
  { path: 'frontend/src/routes/Help.jsx', operation: 'create_or_replace', content: helpPageContent },
  { path: 'frontend/src/routes/Help.test.jsx', operation: 'create_or_replace', content: helpPageTestContent },
  { path: 'frontend/src/main.jsx', operation: 'replace', content: mainWithHelpContent },
];

const copyLinkPatches: ConduitPatchFile[] = [
  {
    path: 'frontend/src/components/CopyArticleLinkButton.jsx',
    operation: 'create_or_replace',
    content: copyArticleLinkContent,
  },
  { path: 'frontend/src/routes/Article/Article.jsx', operation: 'replace', content: copyArticleContent },
  {
    path: 'frontend/src/components/CopyArticleLinkButton.test.jsx',
    operation: 'create_or_replace',
    content: copyArticleLinkTestContent,
  },
];

const summaryFieldPatches: ConduitPatchFile[] = [
  {
    path: 'backend/migrations/20260609000000-add-article-summary.js',
    operation: 'create_or_replace',
    content: articleSummaryMigrationContent,
  },
  { path: 'backend/models/Article.js', operation: 'replace', content: articleSummaryModelContent },
  { path: 'backend/controllers/articles.js', operation: 'replace', content: articleSummaryControllerContent },
  { path: 'frontend/src/services/setArticle.js', operation: 'replace', content: articleSummarySetArticleContent },
  {
    path: 'frontend/src/components/ArticleEditorForm/ArticleEditorForm.jsx',
    operation: 'replace',
    content: articleSummaryEditorContent,
  },
  { path: 'frontend/src/routes/Article/Article.jsx', operation: 'replace', content: articleSummaryArticleContent },
  { path: 'backend/models/Article.test.js', operation: 'create_or_replace', content: articleSummaryTestContent },
  {
    path: 'frontend/src/routes/Article/Article.test.jsx',
    operation: 'create_or_replace',
    content: articleSummaryArticleTestContent,
  },
];

export function createArticleFavoriteFilterSkill(): ConduitDeliverySkill {
  return {
    id: CONDUIT_ARTICLE_FAVORITE_FILTER_SKILL_ID,
    name: 'Article favorite filter',
    level: 'L2',
    description: 'Adds a favorited-articles filter tab to the Conduit home article list.',
    matcherPhrases: ['收藏筛选', 'favorited filter', 'favorite filter', 'favorited articles'],
    targetFiles: favoritePatches.map((patch) => ({ path: patch.path, purpose: patch.operation })),
    verificationCommands: [
      {
        id: 'favorite-filter-url-test',
        command: 'npm',
        args: ['run', 'test', '--', 'frontend/src/services/getArticles.test.js'],
        description: 'Run favorite filter URL construction test.',
      },
    ],
    matches: (requirement) =>
      /收藏筛选|收藏.*筛选|favorited? filter|favorite filter|favorited articles/i.test(requirement),
    buildPlan: () => [
      'Add a Favorited Articles tab for authenticated users.',
      'Pass the logged-in username into the existing favorites article query.',
      'Cover favorited URL construction with a focused service test.',
    ],
    buildPatches: () => favoritePatches.map((patch) => ({ ...patch })),
  };
}

export function createConduitHelpPageSkill(): ConduitDeliverySkill {
  return {
    id: CONDUIT_HELP_PAGE_SKILL_ID,
    name: 'Conduit help page',
    level: 'L2',
    description: 'Adds a routed Conduit help page.',
    matcherPhrases: ['新增页面', '帮助页面', 'help page', 'add page'],
    targetFiles: helpPagePatches.map((patch) => ({ path: patch.path, purpose: patch.operation })),
    verificationCommands: [
      {
        id: 'help-page-test',
        command: 'npm',
        args: ['run', 'test', '--', 'frontend/src/routes/Help.test.jsx'],
        description: 'Run help page render test.',
      },
    ],
    matches: (requirement) => /新增帮助页面|新建帮助页面|帮助页面|help page|(?:add|new) help page/i.test(requirement),
    buildPlan: () => [
      'Create the Help route component.',
      'Register /help in the existing React route tree.',
      'Verify the page renders.',
    ],
    buildPatches: () => helpPagePatches.map((patch) => ({ ...patch })),
  };
}

export function createCopyArticleLinkSkill(): ConduitDeliverySkill {
  return {
    id: CONDUIT_COPY_ARTICLE_LINK_SKILL_ID,
    name: 'Copy article link interaction',
    level: 'L2',
    description: 'Adds a reusable copy-link interaction for article pages.',
    matcherPhrases: ['复制链接', 'copy link', '新增交互', 'add interaction'],
    targetFiles: copyLinkPatches.map((patch) => ({ path: patch.path, purpose: patch.operation })),
    verificationCommands: [
      {
        id: 'copy-article-link-test',
        command: 'npm',
        args: ['run', 'test', '--', 'frontend/src/components/CopyArticleLinkButton.test.jsx'],
        description: 'Run copy article link interaction test.',
      },
    ],
    matches: (requirement) => /复制链接|copy.*link/i.test(requirement),
    buildPlan: () => [
      'Add a reusable copy-link button.',
      'Mount it in article detail actions.',
      'Verify the interaction.',
    ],
    buildPatches: () => copyLinkPatches.map((patch) => ({ ...patch })),
  };
}

export function createArticleSummaryFieldSkill(): ConduitDeliverySkill {
  return {
    id: CONDUIT_ARTICLE_SUMMARY_FIELD_SKILL_ID,
    name: 'Article summary field propagation',
    level: 'L3',
    description: 'Adds an Article.summary field at the database, API, and frontend layers.',
    matcherPhrases: ['新增字段', 'summary 字段', 'summary field', 'add field'],
    targetFiles: summaryFieldPatches.map((patch) => ({ path: patch.path, purpose: patch.operation })),
    verificationCommands: [
      {
        id: 'article-summary-field-test',
        command: 'npm',
        args: ['run', 'test', '--', 'backend/models/Article.test.js'],
        description: 'Run article summary field model test.',
      },
      {
        id: 'article-summary-frontend-test',
        command: 'npm',
        args: ['run', 'test', '--', 'frontend/src/routes/Article/Article.test.jsx'],
        description: 'Run article summary frontend render test.',
      },
    ],
    matches: (requirement) =>
      !/commentsCount|comments count|comment count|评论数量|评论数/i.test(requirement) &&
      /summary 字段|summary field|文章.*summary|article summary/i.test(requirement),
    buildPlan: () => [
      'Add a nullable Article.summary migration.',
      'Expose summary on the backend model/API and editor submit path.',
      'Render summary on article detail with tests.',
    ],
    buildPatches: () => summaryFieldPatches.map((patch) => ({ ...patch })),
  };
}
