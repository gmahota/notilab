/**
 * Scheduling is the one capability with no column behind it — a schedule is an
 * append-only intent row in `AdminAction`, and "the newest row wins" is the
 * whole state machine. These cases pin that reduction, because getting it wrong
 * means either a cancelled story publishing itself or a scheduled one never
 * going out.
 */

import {
  closeSchedule,
  getSchedule,
  listDueSchedules,
  scheduleArticle,
  unscheduleArticle,
} from "@/lib/editorial/schedule-service"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    news: { findUnique: jest.fn() },
    adminAction: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  },
}))

const news = prisma.news as unknown as Record<string, jest.Mock>
const adminAction = prisma.adminAction as unknown as Record<string, jest.Mock>

const NOW = new Date("2026-08-31T12:00:00Z")
const TOMORROW = new Date("2026-09-01T08:00:00Z")

function row(action: string, resourceId: string, publishAt: string, createdAt: string) {
  return {
    action,
    resourceId,
    createdAt: new Date(createdAt),
    details: { publishAt, agentId: "abacus" },
  }
}

describe("scheduleArticle", () => {
  it("refuses to schedule anything that is not approved", async () => {
    // Scheduling is publishing with a delay. Allowing a draft would move the
    // review gate to a moment when nobody is watching.
    news.findUnique.mockResolvedValue({ id: "article-1", status: "DRAFT" })

    await expect(scheduleArticle("article-1", TOMORROW, "abacus", NOW)).rejects.toMatchObject({
      code: "ARTICLE_NOT_APPROVED",
    })
    expect(adminAction.create).not.toHaveBeenCalled()
  })

  it("refuses a moment that has already passed", async () => {
    news.findUnique.mockResolvedValue({ id: "article-1", status: "APPROVED" })

    await expect(
      scheduleArticle("article-1", new Date("2026-08-30T08:00:00Z"), "abacus", NOW),
    ).rejects.toMatchObject({ code: "SCHEDULE_IN_THE_PAST" })
  })

  it("records the intent against the article", async () => {
    news.findUnique.mockResolvedValue({ id: "article-1", status: "APPROVED" })
    adminAction.create.mockResolvedValue({ id: "row-1" })

    const schedule = await scheduleArticle("article-1", TOMORROW, "abacus", NOW)

    expect(schedule.publishAt).toBe("2026-09-01T08:00:00.000Z")
    expect(adminAction.create.mock.calls[0][0].data).toMatchObject({
      userId: "agent:abacus",
      action: "ARTICLE_SCHEDULE_SET",
      resource: "ARTICLE_SCHEDULE",
      resourceId: "article-1",
    })
  })

  it("reports a missing article", async () => {
    news.findUnique.mockResolvedValue(null)
    await expect(scheduleArticle("nope", TOMORROW, "abacus", NOW)).rejects.toMatchObject({
      code: "ARTICLE_NOT_FOUND",
    })
  })
})

describe("getSchedule", () => {
  it("returns the pending schedule when the newest row is a SET", async () => {
    adminAction.findFirst.mockResolvedValue(
      row("ARTICLE_SCHEDULE_SET", "article-1", TOMORROW.toISOString(), "2026-08-31T11:00:00Z"),
    )

    const schedule = await getSchedule("article-1")
    expect(schedule?.publishAt).toBe(TOMORROW.toISOString())
    expect(schedule?.scheduledBy).toBe("abacus")
  })

  it("returns null once the newest row is a cancellation", async () => {
    adminAction.findFirst.mockResolvedValue(
      row("ARTICLE_SCHEDULE_CANCEL", "article-1", TOMORROW.toISOString(), "2026-08-31T11:30:00Z"),
    )
    expect(await getSchedule("article-1")).toBeNull()
  })

  it("returns null for an article that was never scheduled", async () => {
    adminAction.findFirst.mockResolvedValue(null)
    expect(await getSchedule("article-1")).toBeNull()
  })
})

describe("unscheduleArticle", () => {
  it("refuses when there is nothing pending", async () => {
    adminAction.findFirst.mockResolvedValue(null)
    await expect(unscheduleArticle("article-1", "abacus")).rejects.toMatchObject({
      code: "ARTICLE_NOT_SCHEDULED",
    })
  })

  it("appends a cancellation rather than deleting the history", async () => {
    adminAction.findFirst.mockResolvedValue(
      row("ARTICLE_SCHEDULE_SET", "article-1", TOMORROW.toISOString(), "2026-08-31T11:00:00Z"),
    )
    adminAction.create.mockResolvedValue({ id: "row-2" })

    const result = await unscheduleArticle("article-1", "abacus")

    expect(result.cancelled.publishAt).toBe(TOMORROW.toISOString())
    expect(adminAction.create.mock.calls[0][0].data.action).toBe("ARTICLE_SCHEDULE_CANCEL")
  })
})

describe("listDueSchedules", () => {
  it("returns only articles whose newest row is a SET whose moment has passed", async () => {
    adminAction.findMany.mockResolvedValue([
      // Newest first, as the query orders them.
      row("ARTICLE_SCHEDULE_CANCEL", "cancelled", "2026-08-30T08:00:00Z", "2026-08-31T11:30:00Z"),
      row("ARTICLE_SCHEDULE_SET", "cancelled", "2026-08-30T08:00:00Z", "2026-08-31T11:00:00Z"),
      row("ARTICLE_SCHEDULE_SET", "due", "2026-08-31T08:00:00Z", "2026-08-30T09:00:00Z"),
      row("ARTICLE_SCHEDULE_SET", "future", "2026-09-05T08:00:00Z", "2026-08-30T09:00:00Z"),
      row("ARTICLE_SCHEDULE_FULFILLED", "done", "2026-08-29T08:00:00Z", "2026-08-29T08:00:01Z"),
    ])

    const due = await listDueSchedules(NOW)
    expect(due.map((entry) => entry.articleId)).toEqual(["due"])
  })

  it("honours the newest SET when an article was rescheduled", async () => {
    adminAction.findMany.mockResolvedValue([
      row("ARTICLE_SCHEDULE_SET", "moved", "2026-09-10T08:00:00Z", "2026-08-31T11:00:00Z"),
      row("ARTICLE_SCHEDULE_SET", "moved", "2026-08-30T08:00:00Z", "2026-08-29T11:00:00Z"),
    ])

    // The original moment has passed, but it was superseded — publishing now
    // would ignore the operator's correction.
    expect(await listDueSchedules(NOW)).toEqual([])
  })

  it("drains a backlog oldest-first", async () => {
    adminAction.findMany.mockResolvedValue([
      row("ARTICLE_SCHEDULE_SET", "b", "2026-08-31T09:00:00Z", "2026-08-30T09:00:00Z"),
      row("ARTICLE_SCHEDULE_SET", "a", "2026-08-31T07:00:00Z", "2026-08-30T09:00:00Z"),
    ])

    const due = await listDueSchedules(NOW)
    expect(due.map((entry) => entry.articleId)).toEqual(["a", "b"])
  })

  it("ignores a row with an unparseable publishAt instead of throwing", async () => {
    adminAction.findMany.mockResolvedValue([
      row("ARTICLE_SCHEDULE_SET", "broken", "not-a-date", "2026-08-30T09:00:00Z"),
    ])
    expect(await listDueSchedules(NOW)).toEqual([])
  })
})

describe("closeSchedule", () => {
  it("attributes the closing row to the cron, not to an agent", async () => {
    adminAction.create.mockResolvedValue({ id: "row-3" })
    await closeSchedule("article-1", "fulfilled", { publishAt: TOMORROW.toISOString() })

    expect(adminAction.create.mock.calls[0][0].data).toMatchObject({
      userId: "system:cron",
      action: "ARTICLE_SCHEDULE_FULFILLED",
    })
  })
})
