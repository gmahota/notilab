/**
 * lib/base-url.ts resolves the public origin at module load, from environment
 * variables, and every share link, referral link and digest email is built on
 * top of it. It is exactly the kind of code that breaks quietly: a wrong value
 * still renders a link, it just points nowhere — which is what happened when
 * seven modules each hardcoded a fallback to a domain that did not resolve.
 *
 * BASE_URL is a module-level const, so each case has to load the module afresh
 * under a controlled environment. jest.isolateModules gives us that.
 */

/** The variables under test, cleared before each case. */
const ORIGIN_VARS = [
  "NEXT_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const

/**
 * NODE_ENV is typed as a narrow union, and the env is typed readonly in some
 * @types/node versions, so go through a widened view of process.env.
 */
const env = process.env as Record<string, string | undefined>

const originalEnv = { ...process.env }

beforeEach(() => {
  // next/jest loads .env, so these can arrive set even though CI has no such
  // variables. Clear them rather than trusting the ambient environment.
  for (const key of ORIGIN_VARS) delete env[key]
  env.NODE_ENV = "test"
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete env[key]
  }
  Object.assign(process.env, originalEnv)
})

/** Loads a fresh copy of the module against whatever process.env currently holds. */
function loadModule(): typeof import("@/lib/base-url") {
  let mod!: typeof import("@/lib/base-url")
  jest.isolateModules(() => {
    mod = require("@/lib/base-url") as typeof import("@/lib/base-url")
  })
  return mod
}

function baseUrlWith(overrides: Record<string, string | undefined>): string {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  return loadModule().BASE_URL
}

describe("BASE_URL resolution order", () => {
  it("prefers NEXT_PUBLIC_BASE_URL over everything else", () => {
    expect(
      baseUrlWith({
        NEXT_PUBLIC_BASE_URL: "https://staging.notilab.app",
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app",
      }),
    ).toBe("https://staging.notilab.app")
  })

  it("falls back to the browser-visible Vercel variable", () => {
    expect(
      baseUrlWith({ NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app" }),
    ).toBe("https://notilab.vercel.app")
  })

  it("prefers the browser-visible Vercel variable over the server-only one", () => {
    // They normally hold the same value; if they ever diverge, the one the
    // client bundle can also see is the one that keeps links consistent.
    expect(
      baseUrlWith({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "notilab.app",
        VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app",
      }),
    ).toBe("https://notilab.app")
  })

  it("uses the server-only Vercel variable when the prefixed one is absent", () => {
    expect(baseUrlWith({ VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app" })).toBe(
      "https://notilab.vercel.app",
    )
  })

  it("picks up a custom production domain without a code change", () => {
    // The point of reading Vercel's variable: attaching notilab.app in the
    // dashboard has to be enough.
    expect(baseUrlWith({ NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "notilab.app" })).toBe(
      "https://notilab.app",
    )
  })

  it("ignores an empty string, which is how an unset dashboard variable arrives", () => {
    expect(
      baseUrlWith({
        NEXT_PUBLIC_BASE_URL: "",
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app",
      }),
    ).toBe("https://notilab.vercel.app")
  })
})

describe("fallback when nothing is configured", () => {
  it("uses localhost in development", () => {
    env.NODE_ENV = "development"
    expect(baseUrlWith({})).toBe("http://localhost:3000")
  })

  it("never uses localhost in production", () => {
    // The regression this guards: a production build with no env configured
    // shipping http://localhost:3000/news/123 inside a digest email.
    env.NODE_ENV = "production"
    const url = baseUrlWith({})
    expect(url).not.toContain("localhost")
    expect(url).toBe("https://notilab.vercel.app")
  })
})

describe("normalisation", () => {
  it("adds the scheme Vercel omits", () => {
    // Vercel's values never carry https://.
    expect(baseUrlWith({ VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app" })).toMatch(
      /^https:\/\//,
    )
  })

  it("keeps a scheme the value already carries", () => {
    expect(baseUrlWith({ NEXT_PUBLIC_BASE_URL: "https://notilab.app" })).toBe(
      "https://notilab.app",
    )
  })

  it("keeps http for a local tunnel or proxy", () => {
    expect(baseUrlWith({ NEXT_PUBLIC_BASE_URL: "http://localhost:4000" })).toBe(
      "http://localhost:4000",
    )
  })

  it("strips trailing slashes, single or repeated", () => {
    // Without this, every composed link gets a double slash: //news/123.
    expect(baseUrlWith({ NEXT_PUBLIC_BASE_URL: "https://notilab.app/" })).toBe(
      "https://notilab.app",
    )
    expect(baseUrlWith({ NEXT_PUBLIC_BASE_URL: "https://notilab.app///" })).toBe(
      "https://notilab.app",
    )
  })

  it("produces a parseable origin in every branch", () => {
    const cases: Record<string, string | undefined>[] = [
      {},
      { NEXT_PUBLIC_BASE_URL: "notilab.app/" },
      { VERCEL_PROJECT_PRODUCTION_URL: "notilab.vercel.app" },
      { NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "https://notilab.app" },
    ]

    for (const overrides of cases) {
      for (const key of ORIGIN_VARS) delete env[key]
      const url = baseUrlWith(overrides)
      expect(() => new URL(url)).not.toThrow()
      expect(url.endsWith("/")).toBe(false)
    }
  })
})

describe("absoluteUrl", () => {
  it("joins an absolute path", () => {
    env.NEXT_PUBLIC_BASE_URL = "https://notilab.app"
    expect(loadModule().absoluteUrl("/news/123")).toBe("https://notilab.app/news/123")
  })

  it("adds the missing leading slash", () => {
    env.NEXT_PUBLIC_BASE_URL = "https://notilab.app"
    expect(loadModule().absoluteUrl("news/123")).toBe("https://notilab.app/news/123")
  })

  it("never doubles the slash, whatever shape the origin arrived in", () => {
    env.NEXT_PUBLIC_BASE_URL = "https://notilab.app/"
    const { absoluteUrl } = loadModule()
    expect(absoluteUrl("/news/123")).toBe("https://notilab.app/news/123")
    expect(absoluteUrl("news/123")).toBe("https://notilab.app/news/123")
  })

  it("keeps query strings and fragments intact for referral links", () => {
    // lib/growth/referral.ts builds ?ref=<code> on top of this.
    env.NEXT_PUBLIC_BASE_URL = "https://notilab.app"
    expect(loadModule().absoluteUrl("/news/123?ref=abc123")).toBe(
      "https://notilab.app/news/123?ref=abc123",
    )
  })

  it("handles the root path", () => {
    env.NEXT_PUBLIC_BASE_URL = "https://notilab.app"
    expect(loadModule().absoluteUrl("/")).toBe("https://notilab.app/")
  })
})
