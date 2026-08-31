/**
 * The audit trail is read by more people than the environment is, and it is
 * written from untrusted input. `redact` is what stands between a tool payload
 * and a credential ending up in a table an operator screenshots into a ticket.
 *
 * `recordAgentAction` is also pinned to never throw: it runs after the mutation
 * has already happened, so raising here would report failure for work that was
 * done.
 */

import { diffFields, recordAgentAction, redact } from "@/lib/agent/audit"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: { adminAction: { create: jest.fn() } },
}))

const create = prisma.adminAction.create as unknown as jest.Mock

describe("redact", () => {
  it("replaces anything whose key names a credential", () => {
    const cleaned = redact({
      title: "Orçamento aprovado",
      apiKey: "sk-live-123",
      api_key: "sk-live-123",
      password: "hunter2",
      accessToken: "abc",
      authorization: "Bearer xyz",
      sessionId: "s-1",
      nested: { clientSecret: "shh", safe: "kept" },
    }) as Record<string, unknown>

    expect(cleaned.title).toBe("Orçamento aprovado")
    expect(cleaned.apiKey).toBe("[redacted]")
    expect(cleaned.api_key).toBe("[redacted]")
    expect(cleaned.password).toBe("[redacted]")
    expect(cleaned.accessToken).toBe("[redacted]")
    expect(cleaned.authorization).toBe("[redacted]")
    expect(cleaned.sessionId).toBe("[redacted]")
    expect((cleaned.nested as Record<string, unknown>).clientSecret).toBe("[redacted]")
    expect((cleaned.nested as Record<string, unknown>).safe).toBe("kept")
  })

  it("truncates a long value rather than storing a copy of the article", () => {
    const cleaned = redact({ content: "x".repeat(5_000) }) as Record<string, string>
    expect(cleaned.content.length).toBeLessThan(2_100)
    expect(cleaned.content.endsWith("[truncated]")).toBe(true)
  })

  it("stops at a bounded depth", () => {
    let deep: unknown = "bottom"
    for (let i = 0; i < 12; i += 1) deep = { next: deep }
    expect(() => redact(deep)).not.toThrow()
    expect(JSON.stringify(redact(deep))).toContain("too deep")
  })

  it("serialises dates rather than dropping them", () => {
    const cleaned = redact({ when: new Date("2026-09-01T08:00:00Z") }) as Record<string, string>
    expect(cleaned.when).toBe("2026-09-01T08:00:00.000Z")
  })
})

describe("recordAgentAction", () => {
  const entry = {
    agentId: "abacus",
    tool: "update_article",
    action: "ARTICLE_UPDATE",
    resource: "ARTICLE",
    resourceId: "article-1",
    outcome: "success" as const,
    requestId: "req-1",
    durationMs: 12,
  }

  it("attributes the row to the agent, not to a person", () => {
    create.mockResolvedValue({ id: "audit-1" })
    return recordAgentAction(entry).then((ok) => {
      expect(ok).toBe(true)
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "agent:abacus",
            action: "ARTICLE_UPDATE",
            resource: "ARTICLE",
            resourceId: "article-1",
          }),
        }),
      )
    })
  })

  it("redacts the recorded input", () => {
    create.mockResolvedValue({ id: "audit-1" })
    return recordAgentAction({ ...entry, input: { title: "ok", apiKey: "sk-live" } }).then(() => {
      const stored = JSON.stringify(create.mock.calls[0][0])
      expect(stored).not.toContain("sk-live")
      expect(stored).toContain("[redacted]")
    })
  })

  it("reports a failed write instead of throwing", () => {
    // The mutation already happened. Throwing here would tell the agent its
    // successful write failed.
    jest.spyOn(console, "error").mockImplementation(() => {})
    create.mockRejectedValue(new Error("connection lost"))

    return expect(recordAgentAction(entry)).resolves.toBe(false)
  })
})

describe("diffFields", () => {
  it("records only fields that actually changed", () => {
    const changes = diffFields(
      { title: "Antes", priority: "NORMAL", tags: ["a"] },
      { title: "Depois", priority: "NORMAL", tags: ["a", "b"] },
    )

    expect(Object.keys(changes).sort()).toEqual(["tags", "title"])
    expect(changes.title).toEqual({ before: "Antes", after: "Depois" })
  })

  it("treats null and undefined as the same absence", () => {
    expect(diffFields({ summary: null }, { summary: undefined })).toEqual({})
  })
})
