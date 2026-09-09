/**
 * The risk classification, and the guarantee that it has not drifted from the
 * registry.
 *
 * `lib/agent/critical-actions.ts` deliberately cannot import the registry — the
 * tools import it, so the dependency only goes one way. That leaves one thing
 * unchecked at compile time: whether the four names it lists still exist, and
 * whether every tool the list names actually declares the policy. Both are
 * checked here, so a rename or a dropped policy fails a test instead of quietly
 * removing a gate.
 */

import { TOOLS, describeTools } from "@/lib/agent/registry"
import {
  CRITICAL_ACTION_TOOLS,
  criticalActionConfirmation,
  isCriticalActionTool,
  toolRisk,
} from "@/lib/agent/critical-actions"

const byName = new Map(TOOLS.map((tool) => [tool.name, tool]))

describe("the critical action list", () => {
  it("names only tools that exist in the registry", () => {
    for (const name of CRITICAL_ACTION_TOOLS) {
      expect(byName.has(name)).toBe(true)
    }
  })

  it("names only mutating tools", () => {
    for (const name of CRITICAL_ACTION_TOOLS) {
      expect(byName.get(name)!.mutating).toBe(true)
    }
  })

  it("matches the four acts the brief classifies as critical", () => {
    expect([...CRITICAL_ACTION_TOOLS].sort()).toEqual([
      "approve_article",
      "archive_article",
      "publish_article",
      "unpublish_article",
    ])
  })
})

describe("confirmation policies", () => {
  it("is declared on every critical tool", () => {
    for (const name of CRITICAL_ACTION_TOOLS) {
      const tool = byName.get(name)!
      expect(typeof tool.confirmation).toBe("function")
      expect(tool.confirmation!({}).required).toBe(true)
    }
  })

  it("is declared on no other tool", () => {
    // A gate that fired somewhere unexpected would train agents to treat the
    // confirmation step as noise, which is how a real gate stops working.
    const gated = TOOLS.filter((tool) => tool.confirmation).map((tool) => tool.name)
    expect(gated.sort()).toEqual([...CRITICAL_ACTION_TOOLS].sort())
  })

  it("carries a summary a human can act on", () => {
    for (const name of CRITICAL_ACTION_TOOLS) {
      const decision = byName.get(name)!.confirmation!({})
      expect(decision.reason).toBe("critical_action")
      expect(decision.summary!.length).toBeGreaterThan(30)
    }
  })

  it("stands down only for an explicitly exempted identity", () => {
    const policy = criticalActionConfirmation("Summary long enough to be useful to a human.")
    const identity = { id: "x", label: "x", permissions: [] as const }

    expect(policy({}, { agent: identity }).required).toBe(true)
    expect(policy({}, { agent: { ...identity, skipCriticalConfirmation: false } }).required).toBe(
      true,
    )
    expect(policy({}, { agent: { ...identity, skipCriticalConfirmation: true } }).required).toBe(
      false,
    )
    // No context at all — the catalogue's probe — still reports the gate.
    expect(policy({}).required).toBe(true)
  })
})

describe("toolRisk", () => {
  it("puts every read tool in the read tier", () => {
    for (const tool of TOOLS.filter((candidate) => !candidate.mutating)) {
      expect(toolRisk(tool)).toBe("read")
    }
    expect(TOOLS.filter((tool) => toolRisk(tool) === "read").map((tool) => tool.name).sort()).toEqual(
      ["get_article", "list_categories", "search_articles"],
    )
  })

  it("splits mutating tools into write and critical", () => {
    const critical = TOOLS.filter((tool) => toolRisk(tool) === "critical").map((tool) => tool.name)
    const write = TOOLS.filter((tool) => toolRisk(tool) === "write").map((tool) => tool.name)

    expect(critical.sort()).toEqual([...CRITICAL_ACTION_TOOLS].sort())
    expect(write.sort()).toEqual([
      "create_article",
      "reject_article",
      "schedule_article",
      "set_article_image",
      "submit_article_for_review",
      "unschedule_article",
      "update_article",
      "update_article_seo",
    ])
  })

  it("agrees with isCriticalActionTool", () => {
    for (const tool of TOOLS) {
      expect(toolRisk(tool) === "critical").toBe(isCriticalActionTool(tool.name))
    }
  })
})

describe("the published catalogue", () => {
  it("carries risk and requiresConfirmation for every tool", () => {
    for (const descriptor of describeTools()) {
      expect(["read", "write", "critical"]).toContain(descriptor.risk)
      expect(descriptor.requiresConfirmation).toBe(descriptor.risk === "critical")
    }
  })
})

describe("tool descriptions", () => {
  it("warns about the confirmation step on every critical tool", () => {
    // A model that learns about the gate only by being refused wastes a call
    // and often gives up on the task.
    for (const name of CRITICAL_ACTION_TOOLS) {
      expect(byName.get(name)!.description).toContain("CRITICAL ACTION")
    }
  })

  it("says when NOT to use the tools most likely to be misapplied", () => {
    for (const name of [
      "publish_article",
      "archive_article",
      "approve_article",
      "update_article",
      "schedule_article",
    ]) {
      expect(byName.get(name)!.description).toMatch(/Do NOT use/)
    }
  })
})
