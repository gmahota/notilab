/**
 * GET /api/reddit-news interpolated the caller's `subreddit` parameter straight
 * into the outbound URL (`https://www.reddit.com/r/${subreddit}.json`), on a
 * public unauthenticated route. That let an unauthenticated caller steer the
 * server's outbound request: `../../` walked the path off /r/, and a raw `?`
 * or `#` rewrote the query or truncated the URL. `limit` had a second problem
 * of its own -- `Math.min(Number.parseInt("abc"), 15)` is NaN, which reached
 * the URL as the literal string "NaN".
 *
 * These tests assert on the URL handed to fetch, and on fetch NOT being called
 * at all for a rejected parameter. That is the invariant: validation has to
 * happen before the request leaves the server, not after. The 400 matters for
 * a second reason -- the route wraps its fetch in a try/catch that falls back
 * to canned demo articles and reports `success: true`, so a validation error
 * thrown in the wrong place would be laundered into a 200.
 */

import { NextRequest } from "next/server"

import { GET } from "@/app/api/reddit-news/route"

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  // An empty listing keeps the per-post translate() calls (which also use
  // fetch) out of these tests -- the URL is what is under test here.
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { children: [] } }),
  })
  global.fetch = fetchMock as unknown as typeof fetch
})

function call(query: string) {
  return GET(new NextRequest(`https://notilab.test/api/reddit-news${query}`))
}

/** The URL string the route passed to fetch. */
function fetchedUrl(): string {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  return fetchMock.mock.calls[0][0] as string
}

describe("GET /api/reddit-news parameter validation", () => {
  it("defaults to r/worldnews with limit 10", async () => {
    const response = await call("")

    expect(response.status).toBe(200)
    expect(fetchedUrl()).toBe("https://www.reddit.com/r/worldnews.json?limit=10")
  })

  it("passes a well-formed subreddit through", async () => {
    await call("?subreddit=technology&limit=5")

    expect(fetchedUrl()).toBe("https://www.reddit.com/r/technology.json?limit=5")
  })

  it("clamps limit to the 15-post maximum", async () => {
    await call("?limit=99")

    expect(fetchedUrl()).toBe("https://www.reddit.com/r/worldnews.json?limit=15")
  })

  // Each of these steered the outbound URL before validation was added.
  it.each([
    ["path traversal", "?subreddit=..%2F..%2Fr%2Fall"],
    ["unencoded traversal", "?subreddit=../../r/all"],
    ["query injection", "?subreddit=worldnews%3Fafter%3Dx"],
    ["fragment truncation", "?subreddit=worldnews%23"],
    ["absolute url", "?subreddit=https%3A%2F%2Fevil.test%2F"],
    ["too short", "?subreddit=ab"],
    ["too long", "?subreddit=abcdefghijklmnopqrstuvwxyz"],
    ["disallowed character", "?subreddit=world-news"],
  ])("rejects %s without making a request", async (_label, query) => {
    const response = await call(query)

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid subreddit",
    })
  })

  it.each([
    ["non-numeric", "?limit=abc"],
    ["zero", "?limit=0"],
    ["negative", "?limit=-5"],
    ["float", "?limit=1.5"],
  ])("rejects a %s limit without making a request", async (_label, query) => {
    const response = await call(query)

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Invalid limit",
    })
  })

  it("never puts NaN in the outbound URL", async () => {
    await call("?limit=abc")

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
