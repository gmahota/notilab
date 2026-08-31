/**
 * lib/agent/tools/shapes.ts — Output schemas shared across tools.
 *
 * These describe what a tool returns. They are documentation, not a runtime
 * guard: the payload is ours, produced by the editorial service, so validating
 * it on the way out would only catch our own bugs at the cost of every request.
 * They exist because an agent reading `/api/agent/openapi` needs to know the
 * shape of an article before it calls anything.
 */

import type { JsonSchema } from "../schema"

export const ARTICLE_SUMMARY_SCHEMA: JsonSchema = {
  type: "object",
  description: "An article as it appears in a list.",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    slug: { type: ["string", "null"] },
    summary: { type: ["string", "null"] },
    imageUrl: { type: ["string", "null"] },
    hasImage: {
      type: "boolean",
      description: "False when the article has no image or only the placeholder.",
    },
    sourceUrl: { type: "string", description: "Provenance. Immutable." },
    sourceName: { type: "string", description: "The byline — the originating outlet." },
    status: {
      type: "string",
      enum: ["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "REJECTED", "ARCHIVED"],
    },
    priority: {
      type: "string",
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      description: "Editorial prominence. This is the field to change for 'destaque'.",
    },
    trending: {
      type: "boolean",
      description: "Computed by the ranking job from real signals. Read-only.",
    },
    tags: { type: "array", items: { type: "string" } },
    publishedAt: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    readTime: { type: ["integer", "null"], description: "Estimated reading time in minutes." },
    rankingScore: { type: "number", description: "Computed. Read-only." },
    importanceScore: { type: "number", description: "Computed. Read-only." },
    authorId: { type: ["string", "null"] },
    category: {
      type: ["object", "null"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
        color: { type: "string" },
      },
    },
  },
}

export const ARTICLE_DETAIL_SCHEMA: JsonSchema = {
  type: "object",
  description: "A full article, including its body and AI enrichment.",
  properties: {
    ...(ARTICLE_SUMMARY_SCHEMA.properties as Record<string, JsonSchema>),
    content: { type: "string" },
    aiSummary: { type: ["string", "null"] },
    sentiment: { type: ["string", "null"] },
    articleAI: {
      type: ["object", "null"],
      description: "AI enrichment. Never edited through this API.",
      properties: {
        titleTranslated: { type: ["string", "null"] },
        summary: { type: ["string", "null"] },
        tldr: { type: ["string", "null"] },
        whyItMatters: { type: ["string", "null"] },
        importanceScore: { type: "number" },
        processedAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    stats: {
      type: "object",
      properties: {
        reactions: { type: "integer" },
        reads: { type: "integer" },
        saves: { type: "integer" },
      },
    },
    schedule: {
      type: ["object", "null"],
      description: "A pending scheduled publication, if one exists.",
      properties: {
        publishAt: { type: "string", format: "date-time" },
        scheduledBy: { type: "string" },
        scheduledAt: { type: "string", format: "date-time" },
      },
    },
  },
}

/** What every mutating article tool returns. */
export const ARTICLE_MUTATION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    article: ARTICLE_DETAIL_SCHEMA,
    changed: {
      type: "array",
      items: { type: "string" },
      description: "Names of the fields this call actually changed. Empty when it was a no-op.",
    },
  },
  required: ["article", "changed"],
}
