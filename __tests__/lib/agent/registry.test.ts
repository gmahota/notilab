/**
 * The registry is the API surface, so these are contract tests rather than unit
 * tests. They guard the properties an external agent depends on and that a
 * future tool could quietly break: stable naming, a real description to choose
 * by, permissions that actually exist, and — the one that matters most — no
 * mutating tool that forgets its audit action.
 */

import { TOOLS, describeTool, describeTools, getTool } from "@/lib/agent/registry"
import { AGENT_PERMISSIONS } from "@/lib/agent/permissions"

describe("tool registry", () => {
  it("exposes only snake_case, unique names", () => {
    const names = TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it("gives every tool a description substantial enough to choose by", () => {
    // These strings are what a language model reads when deciding which tool
    // answers a request. A one-liner is how an agent picks the wrong one.
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(80)
      expect(tool.title.length).toBeGreaterThan(0)
    }
  })

  it("only demands permissions that exist in the catalogue", () => {
    for (const tool of TOOLS) {
      expect(tool.permissions.length).toBeGreaterThan(0)
      for (const permission of tool.permissions) {
        expect(AGENT_PERMISSIONS).toContain(permission)
      }
    }
  })

  it("gives every mutating tool an audit action", () => {
    // Without this, a write would run and leave no trail — the single failure
    // this whole layer exists to prevent.
    for (const tool of TOOLS.filter((entry) => entry.mutating)) {
      expect(tool.audit?.action).toBeTruthy()
      expect(tool.audit?.resource).toBeTruthy()
    }
  })

  it("exposes no tool that deletes, or that touches users or settings", () => {
    const forbidden = /delete|remove_|drop|user|role|setting|secret|execute|query|sql/i
    for (const tool of TOOLS) {
      expect(tool.name).not.toMatch(forbidden)
    }
  })

  it("keeps computed and provenance fields out of every mutating input schema", () => {
    // The guarantee is structural: these fields are absent from the schemas of
    // tools that write, and the validator rejects unknown keys, so no tool can
    // set them. Read tools may name the same fields — they are filters there,
    // which is why the check is scoped to mutating tools.
    const unwritable = [
      "status",
      "trending",
      "rankingScore",
      "importanceScore",
      "sourceUrl",
      "sourceName",
      "authorId",
      "reviewerId",
    ]

    for (const tool of TOOLS.filter((entry) => entry.mutating)) {
      for (const field of unwritable) {
        // create_article is the one place provenance may be supplied, once, at
        // creation. It is immutable afterwards.
        if (tool.name === "create_article" && ["sourceUrl", "sourceName"].includes(field)) continue
        expect(Object.keys(tool.input)).not.toContain(field)
      }
    }
  })

  it("exposes status and trending as read filters only", () => {
    // Confirms the other half of the rule above: search_articles can filter on
    // them, and no tool can write them.
    expect(Object.keys(getTool("search_articles")!.input)).toEqual(
      expect.arrayContaining(["status", "trending"]),
    )
    expect(getTool("search_articles")!.mutating).toBe(false)
  })

  it("resolves only names that are in the registry", () => {
    expect(getTool("search_articles")).not.toBeNull()
    expect(getTool("delete_everything")).toBeNull()
    expect(getTool("../../../etc/passwd")).toBeNull()
    expect(getTool("")).toBeNull()
  })

  it("describes a tool with a schema an agent can act on", () => {
    const described = describeTool(getTool("update_article")!)

    expect(described.endpoint).toBe("/api/agent/tools/update_article")
    expect(described.method).toBe("POST")
    expect(described.supportsIdempotencyKey).toBe(true)
    expect(described.inputSchema.additionalProperties).toBe(false)
    expect((described.inputSchema.required as string[]) ?? []).toEqual(["id"])
  })

  it("hides tools the calling credential cannot use", () => {
    const readOnly = describeTools(["article.read", "taxonomy.read"]).map((tool) => tool.name)

    expect(readOnly).toContain("search_articles")
    expect(readOnly).toContain("list_categories")
    expect(readOnly).not.toContain("publish_article")
    expect(readOnly).not.toContain("create_article")
  })

  it("covers every editorial operation the brief called for", () => {
    const names = TOOLS.map((tool) => tool.name)
    for (const expected of [
      "search_articles",
      "get_article",
      "create_article",
      "update_article",
      "update_article_seo",
      "set_article_image",
      "publish_article",
      "unpublish_article",
      "schedule_article",
      "unschedule_article",
    ]) {
      expect(names).toContain(expected)
    }
  })
})
