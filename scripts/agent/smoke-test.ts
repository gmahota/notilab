/**
 * scripts/agent/smoke-test.ts — End-to-end smoke test for the Agent API.
 *
 *   pnpm agent:smoke                        -> NEXT_PUBLIC_BASE_URL, else production
 *   pnpm agent:smoke http://localhost:3000  -> a deployment of your choosing
 *
 * What it answers: can the credential in NOTILAB_AGENT_API_KEY actually operate
 * this deployment, and does the pipeline in front of every tool still behave —
 * authentication, the header fallback, schema validation, the verb guard, an
 * unknown tool name. A different question from `pnpm test`, which runs the units
 * in isolation with no deployment involved.
 *
 * **Every call here is read-only.** The Agent API's write tools reach the same
 * database production uses, so a smoke test that created or published an article
 * would be editing the live newsroom. If you add a case, keep it to
 * search_articles / get_article / list_categories / capabilities.
 *
 * The key is read from the environment or, failing that, parsed out of .env —
 * tsx does not load .env on its own. It is never printed, not even in part.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Reads one variable out of .env, for the common case of running this locally. */
function fromEnvFile(name: string): string | undefined {
  try {
    const contents = readFileSync(resolve(process.cwd(), ".env"), "utf8")
    // Split on either ending: a .env written on Windows carries \r, which `.`
    // in the pattern below will not match, so the line has to be clean first.
    for (const line of contents.split(/\r?\n/)) {
      const match = new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`).exec(line)
      if (match) return match[1].trim().replace(/^["']|["']$/g, "")
    }
  } catch {
    // No .env is normal in CI; there the environment is expected to carry the key.
  }
  return undefined
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || fromEnvFile(name)
}

const baseUrl = (
  process.argv[2] ??
  env("AGENT_API_BASE_URL") ??
  env("NEXT_PUBLIC_BASE_URL") ??
  "https://notilab.vercel.app"
).replace(/\/+$/, "")

const apiKey = env("NOTILAB_AGENT_API_KEY")

if (!apiKey) {
  console.error("NOTILAB_AGENT_API_KEY is not set (checked the environment and .env).")
  process.exit(1)
}

/** A key of an acceptable length that is definitely not the configured one. */
const WRONG_KEY = "0".repeat(64)

interface Envelope {
  success?: boolean
  data?: unknown
  error?: { code?: string; message?: string; details?: unknown }
  meta?: { tool?: string; agentId?: string; requestId?: string; durationMs?: number }
}

interface Result {
  status: number
  body: Envelope
}

async function call(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<Result> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  let body: Envelope = {}
  try {
    body = (await response.json()) as Envelope
  } catch {
    // A non-JSON answer is itself a failure; the assertion below reports it.
  }
  return { status: response.status, body }
}

function authed(key: string = apiKey!): Record<string, string> {
  return { Authorization: `Bearer ${key}` }
}

function tool(
  name: string,
  input: Record<string, unknown>,
  headers: Record<string, string> = authed(),
): Promise<Result> {
  return call(`/api/agent/tools/${name}`, { method: "POST", headers, body: input })
}

let failures = 0

/** One named assertion. `detail` prints on both outcomes, so a pass is legible too. */
function check(name: string, passed: boolean, detail: string): void {
  if (passed) {
    console.log(`  PASS  ${name} — ${detail}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name} — ${detail}`)
  }
}

async function main(): Promise<void> {
  console.log(`Agent API smoke test against ${baseUrl}\n`)

  // 1. Liveness. The only unauthenticated endpoint, and the one an agent
  //    platform's connection test hits before a credential exists.
  const health = await call("/api/agent/health")
  const configured = (health.body as { configured?: boolean }).configured
  check(
    "health reports a configured API",
    health.status === 200 && configured === true,
    `${health.status} configured=${configured}`,
  )

  // 2. Discovery is not public.
  const anonymous = await call("/api/agent/capabilities")
  check(
    "capabilities refuses an anonymous caller",
    anonymous.status === 401 && anonymous.body.error?.code === "UNAUTHENTICATED",
    `${anonymous.status} ${anonymous.body.error?.code}`,
  )

  // 3. The credential resolves to an identity, and search_articles is on its list.
  const capabilities = await call("/api/agent/capabilities", { headers: authed() })
  const catalogue = capabilities.body.data as
    | { agent?: { id?: string; permissions?: string[] }; tools?: { name?: string }[] }
    | undefined
  const toolNames = (catalogue?.tools ?? []).map((entry) => entry.name)
  check(
    "capabilities resolves the credential",
    capabilities.status === 200 && Boolean(catalogue?.agent?.id),
    `${capabilities.status} agent=${catalogue?.agent?.id ?? "?"} permissions=${catalogue?.agent?.permissions?.length ?? 0}`,
  )
  check(
    "search_articles is granted to this credential",
    toolNames.includes("search_articles"),
    `${toolNames.length} tool(s) granted`,
  )

  // 4. The call the integration actually makes.
  const search = await tool("search_articles", { limit: 2 })
  const page = search.body.data as
    | { articles?: unknown[]; pagination?: { limit?: number; total?: number } }
    | undefined
  check(
    "search_articles returns a page",
    search.status === 200 &&
      search.body.success === true &&
      Array.isArray(page?.articles) &&
      page.articles.length <= 2 &&
      typeof page?.pagination?.total === "number",
    `${search.status} ${page?.articles?.length ?? 0} article(s) of ${page?.pagination?.total ?? "?"} total`,
  )
  check(
    "the response carries the standard envelope meta",
    search.body.meta?.tool === "search_articles" && Boolean(search.body.meta?.requestId),
    `tool=${search.body.meta?.tool} agentId=${search.body.meta?.agentId} durationMs=${search.body.meta?.durationMs}`,
  )

  // 5. An omitted body is valid — every filter is optional.
  const noFilters = await tool("search_articles", {})
  check(
    "an empty input is accepted",
    noFilters.status === 200 && noFilters.body.success === true,
    `${noFilters.status}`,
  )

  // 6. The editorial filters — the reason this tool exists rather than the
  //    public feed. Zero rows is a valid answer here; a 4xx is not.
  const drafts = await tool("search_articles", { status: "DRAFT", hasImage: false, limit: 1 })
  const draftPage = drafts.body.data as { pagination?: { total?: number } } | undefined
  check(
    "editorial filters are accepted (status + hasImage)",
    drafts.status === 200 && drafts.body.success === true,
    `${drafts.status} ${draftPage?.pagination?.total ?? "?"} draft(s) without an image`,
  )

  // 7. The fallback header, for platforms that cannot set Authorization.
  const fallbackHeader = await tool("search_articles", { limit: 1 }, { "X-Agent-Api-Key": apiKey! })
  check(
    "X-Agent-Api-Key is accepted as a fallback",
    fallbackHeader.status === 200 && fallbackHeader.body.success === true,
    `${fallbackHeader.status}`,
  )

  // 8. A wrong key and a missing key are both refused, and stay distinguishable.
  const wrongKey = await tool("search_articles", { limit: 1 }, authed(WRONG_KEY))
  check(
    "a wrong key is rejected",
    wrongKey.status === 401 && wrongKey.body.error?.code === "INVALID_API_KEY",
    `${wrongKey.status} ${wrongKey.body.error?.code}`,
  )

  const noKey = await call("/api/agent/tools/search_articles", { method: "POST", body: { limit: 1 } })
  check(
    "a missing key is rejected",
    noKey.status === 401 && noKey.body.error?.code === "UNAUTHENTICATED",
    `${noKey.status} ${noKey.body.error?.code}`,
  )

  // 9. Schema validation. An unknown field is refused rather than ignored, so a
  //    typo in an agent's tool config fails loudly instead of quietly returning
  //    unfiltered results.
  const typo = await tool("search_articles", { limite: 1 })
  check(
    "an unknown field is refused",
    typo.status === 422 && typo.body.error?.code === "VALIDATION_FAILED",
    `${typo.status} ${typo.body.error?.code}`,
  )

  const outOfRange = await tool("search_articles", { limit: 9999 })
  check(
    "an out-of-range value is refused",
    outOfRange.status === 422 && outOfRange.body.error?.code === "VALIDATION_FAILED",
    `${outOfRange.status} ${outOfRange.body.error?.code}`,
  )

  // 10. The verb guard, answered with the same envelope as everything else.
  const wrongVerb = await call("/api/agent/tools/search_articles", { headers: authed() })
  check(
    "GET on a tool is a 405",
    wrongVerb.status === 405 && wrongVerb.body.error?.code === "METHOD_NOT_ALLOWED",
    `${wrongVerb.status} ${wrongVerb.body.error?.code}`,
  )

  // 11. A name that is not in the registry never becomes anything but a 404.
  const unknownTool = await tool("search_articles_v2", { limit: 1 })
  check(
    "an unknown tool name is a 404",
    unknownTool.status === 404,
    `${unknownTool.status} ${unknownTool.body.error?.code}`,
  )

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("\nSmoke test could not complete:", error instanceof Error ? error.message : error)
  process.exit(1)
})
