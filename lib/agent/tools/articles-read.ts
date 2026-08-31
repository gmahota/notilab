/**
 * lib/agent/tools/articles-read.ts — Read tools.
 *
 * The descriptions here are load-bearing. They are what a language model reads
 * when it decides which tool answers "encontra notícias sem imagem", so they
 * name the filter that does it rather than describing the tool in the abstract.
 *
 * Reads are not audited. That is deliberate: an audit trail that records every
 * search stops being readable, and the question an audit answers is what
 * changed. Reads are still authenticated, authorised and rate-limited.
 */

import { defineTool } from "../types"
import { f } from "../schema"
import {
  ARTICLE_PRIORITIES,
  ARTICLE_SORTS,
  ARTICLE_STATUSES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getArticle,
  searchArticles,
} from "@/lib/editorial/article-service"
import { getSchedule } from "@/lib/editorial/schedule-service"
import { ARTICLE_DETAIL_SCHEMA, ARTICLE_SUMMARY_SCHEMA } from "./shapes"

export const searchArticlesTool = defineTool({
  name: "search_articles",
  title: "Search articles",
  description:
    "Search NotiLab articles with editorial filters. Covers every state, not just the public " +
    "site: pass `status` to see drafts or articles awaiting review, or `published: false` for " +
    "everything not currently live. Use `hasImage: false` to find articles missing a lead image, " +
    "`publishedFrom`/`publishedTo` for a date range, and `query` for free text across title, " +
    "summary, body and tags. Returns a page of article summaries plus a total count — call " +
    "get_article for the full body.",
  permissions: ["article.read"],
  mutating: false,
  input: {
    query: f.optional(
      f.string({ description: "Free text matched against title, summary, body and tags.", maxLength: 200 }),
    ),
    status: f.optional(
      f.enum(ARTICLE_STATUSES, "Exact editorial state. Mutually exclusive with `published`."),
    ),
    published: f.optional(
      f.boolean("True for live articles only, false for everything not live. Mutually exclusive with `status`."),
    ),
    categorySlug: f.optional(f.string({ description: "Category slug, e.g. economia.", maxLength: 80 })),
    tag: f.optional(f.string({ description: "Exact tag match.", maxLength: 80 })),
    sourceName: f.optional(
      f.string({ description: "Partial match on the byline / originating outlet.", maxLength: 120 }),
    ),
    authorId: f.optional(f.string({ description: "Exact NotiLab user id of the author.", maxLength: 64 })),
    priority: f.optional(f.enum(ARTICLE_PRIORITIES, "Editorial prominence.")),
    trending: f.optional(f.boolean("Filter on the computed trending flag.")),
    hasImage: f.optional(f.boolean("False returns only articles with no usable lead image.")),
    publishedFrom: f.optional(f.datetime("Earliest publication date, inclusive.")),
    publishedTo: f.optional(f.datetime("Latest publication date, inclusive.")),
    sortBy: f.optional(f.enum(ARTICLE_SORTS, "Result ordering. Defaults to recent.")),
    limit: f.optional(
      f.number({
        description: `Page size, 1–${MAX_PAGE_SIZE}. Defaults to ${DEFAULT_PAGE_SIZE}.`,
        min: 1,
        max: MAX_PAGE_SIZE,
        integer: true,
      }),
    ),
    offset: f.optional(
      f.number({ description: "Rows to skip, for paging.", min: 0, max: 100_000, integer: true }),
    ),
  },
  output: {
    type: "object",
    properties: {
      articles: { type: "array", items: ARTICLE_SUMMARY_SCHEMA },
      pagination: {
        type: "object",
        properties: {
          limit: { type: "integer" },
          offset: { type: "integer" },
          total: { type: "integer" },
          hasMore: { type: "boolean" },
        },
      },
    },
    required: ["articles", "pagination"],
  },
  async handler(input) {
    const result = await searchArticles({
      query: input.query,
      status: input.status,
      published: input.published,
      categorySlug: input.categorySlug,
      tag: input.tag,
      sourceName: input.sourceName,
      authorId: input.authorId,
      priority: input.priority,
      trending: input.trending,
      hasImage: input.hasImage,
      publishedFrom: input.publishedFrom,
      publishedTo: input.publishedTo,
      sortBy: input.sortBy,
      limit: input.limit,
      offset: input.offset,
    })

    return { data: result }
  },
})

export const getArticleTool = defineTool({
  name: "get_article",
  title: "Get one article",
  description:
    "Fetch one article in full — body, category, tags, AI enrichment, engagement counts and any " +
    "pending scheduled publication. Accepts either the article id or its URL slug. Call this " +
    "before editing, so the update is based on the current text rather than on a stale search result.",
  permissions: ["article.read"],
  mutating: false,
  input: {
    id: f.string({ description: "Article id or URL slug.", maxLength: 200 }),
  },
  output: ARTICLE_DETAIL_SCHEMA,
  async handler(input) {
    const article = await getArticle(input.id)
    const schedule = await getSchedule(article.id)
    return { data: { ...article, schedule } }
  },
})
