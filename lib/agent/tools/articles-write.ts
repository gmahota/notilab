/**
 * lib/agent/tools/articles-write.ts — Content-editing tools.
 *
 * Each of these is a narrow verb over a fixed field list. The field lists are
 * the point: `update_article` cannot reach `status`, `publishedAt`, `sourceUrl`,
 * `trending` or any computed score, because those fields are not in its schema
 * and the schema rejects unknown keys. An agent cannot publish by writing a
 * status, only by calling the tool that has a publish gate behind it.
 *
 * The split between `update_article`, `update_article_seo` and
 * `set_article_image` is not cosmetic — it is what lets an operator grant an
 * SEO agent the ability to rewrite headlines and slugs without also granting it
 * the ability to rewrite the body of a story.
 */

import { defineTool } from "../types"
import { f } from "../schema"
import { AUDIT_RESOURCE } from "../audit"
import { AgentError } from "../errors"
import {
  ARTICLE_PRIORITIES,
  createArticle,
  setArticleImage,
  updateArticle,
  updateArticleSeo,
} from "@/lib/editorial/article-service"
import { ARTICLE_DETAIL_SCHEMA, ARTICLE_MUTATION_SCHEMA } from "./shapes"

export const createArticleTool = defineTool({
  name: "create_article",
  title: "Create an article",
  description:
    "Create a new article. It is always created as a DRAFT — this tool cannot publish, and there " +
    "is no parameter that skips review. Provenance is mandatory in NotiLab: supply `sourceUrl` " +
    "and `sourceName` when the story comes from an outlet; omit both when the agent wrote it and " +
    "the article will be stamped as agent-authored. Never attribute agent-written text to an " +
    "outlet that did not publish it. Send an Idempotency-Key header so a retry does not create a " +
    "second copy.",
  permissions: ["article.create"],
  mutating: true,
  audit: { action: "ARTICLE_CREATE", resource: AUDIT_RESOURCE.ARTICLE },
  input: {
    title: f.string({ description: "Headline.", minLength: 3, maxLength: 300 }),
    content: f.string({ description: "Article body.", minLength: 20, maxLength: 100_000 }),
    categorySlug: f.string({ description: "Slug of an existing category.", maxLength: 80 }),
    summary: f.optional(
      f.string({ description: "Short summary. Also serves as the meta description.", maxLength: 2_000 }),
    ),
    tags: f.optional(f.stringArray({ description: "Topic tags." })),
    imageUrl: f.optional(f.string({ description: "Absolute http(s) URL of the lead image.", maxLength: 2_000 })),
    sourceUrl: f.optional(
      f.string({ description: "Absolute http(s) URL of the original story. Immutable once set.", maxLength: 2_000 }),
    ),
    sourceName: f.optional(f.string({ description: "Byline — the outlet that published it.", maxLength: 200 })),
    publishedAt: f.optional(f.datetime("Original publication date. Defaults to now.")),
    readTime: f.optional(
      f.number({ description: "Estimated reading time in minutes.", min: 1, max: 120, integer: true }),
    ),
  },
  output: ARTICLE_DETAIL_SCHEMA,
  async handler(input, ctx) {
    const article = await createArticle(
      {
        title: input.title,
        content: input.content,
        categorySlug: input.categorySlug,
        summary: input.summary,
        tags: input.tags,
        imageUrl: input.imageUrl,
        sourceUrl: input.sourceUrl,
        sourceName: input.sourceName,
        publishedAt: input.publishedAt,
        readTime: input.readTime,
      },
      ctx.agent.id,
    )

    return {
      data: article,
      audit: {
        resourceId: article.id,
        changes: {
          status: { before: null, after: "DRAFT" },
          title: { before: null, after: article.title },
        },
      },
    }
  },
})

export const updateArticleTool = defineTool({
  name: "update_article",
  title: "Update article content",
  description:
    "Update the editorial fields of an existing article: headline, summary, body, category, tags, " +
    "reading time, and `priority` — which is NotiLab's editorial prominence flag, the field to " +
    "change when asked to feature a story or drop it from the highlights. Only the fields you send " +
    "are touched. This tool cannot change publication state, publication date, provenance, the " +
    "trending flag or any computed score; use the lifecycle tools for state.",
  permissions: ["article.update"],
  mutating: true,
  audit: { action: "ARTICLE_UPDATE", resource: AUDIT_RESOURCE.ARTICLE },
  input: {
    id: f.string({ description: "Article id.", maxLength: 200 }),
    title: f.optional(f.string({ description: "New headline.", minLength: 3, maxLength: 300 })),
    summary: f.optional(f.string({ description: "New summary.", maxLength: 2_000 })),
    content: f.optional(f.string({ description: "New body.", minLength: 20, maxLength: 100_000 })),
    categorySlug: f.optional(f.string({ description: "Slug of an existing category.", maxLength: 80 })),
    tags: f.optional(f.stringArray({ description: "Replaces the whole tag list." })),
    priority: f.optional(
      f.enum(
        ARTICLE_PRIORITIES,
        "Editorial prominence: HIGH or URGENT to feature a story, NORMAL or LOW to take it out of the highlights.",
      ),
    ),
    readTime: f.optional(
      f.number({ description: "Estimated reading time in minutes.", min: 1, max: 120, integer: true }),
    ),
  },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await updateArticle(input.id, {
      title: input.title,
      summary: input.summary,
      content: input.content,
      categorySlug: input.categorySlug,
      tags: input.tags,
      priority: input.priority,
      readTime: input.readTime,
    })

    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const updateArticleSeoTool = defineTool({
  name: "update_article_seo",
  title: "Update article SEO",
  description:
    "Update how an article presents in search results: its URL slug, its headline, and its summary " +
    "(NotiLab has no separate meta-description field — the summary is what a crawler reads). " +
    "Changing the slug changes the article's public URL and breaks existing links to it, so only " +
    "do so when explicitly asked. Slugs are normalised and must be unique.",
  permissions: ["seo.update"],
  mutating: true,
  audit: { action: "ARTICLE_SEO_UPDATE", resource: AUDIT_RESOURCE.ARTICLE },
  input: {
    id: f.string({ description: "Article id.", maxLength: 200 }),
    slug: f.optional(
      f.string({ description: "New URL slug. Normalised to lowercase and hyphens.", maxLength: 120 }),
    ),
    title: f.optional(f.string({ description: "New headline.", minLength: 3, maxLength: 300 })),
    summary: f.optional(
      f.string({ description: "New summary, used as the meta description.", maxLength: 2_000 }),
    ),
  },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    const result = await updateArticleSeo(input.id, {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
    })

    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})

export const setArticleImageTool = defineTool({
  name: "set_article_image",
  title: "Set or clear the lead image",
  description:
    "Set an article's lead image to an absolute http(s) URL, or pass `clear: true` to remove it. " +
    "Pair with search_articles `hasImage: false` to work through articles that are missing one.",
  permissions: ["media.update"],
  mutating: true,
  audit: { action: "ARTICLE_MEDIA_UPDATE", resource: AUDIT_RESOURCE.ARTICLE },
  input: {
    id: f.string({ description: "Article id.", maxLength: 200 }),
    imageUrl: f.optional(
      f.string({ description: "Absolute http(s) URL. Required unless `clear` is true.", maxLength: 2_000 }),
    ),
    clear: f.optional(f.boolean("Remove the current image instead of setting one.")),
  },
  output: ARTICLE_MUTATION_SCHEMA,
  async handler(input) {
    // Modelled as two explicit intents rather than "null means delete": an
    // agent that omits a field by accident must not silently wipe the image.
    if (input.clear !== true && !input.imageUrl) {
      throw new AgentError(
        "VALIDATION_FAILED",
        "Provide `imageUrl`, or `clear: true` to remove the current image.",
      )
    }

    const result = await setArticleImage(input.id, input.clear === true ? null : input.imageUrl!)

    return {
      data: { article: result.article, changed: Object.keys(result.changes) },
      audit: { resourceId: input.id, changes: result.changes },
    }
  },
})
