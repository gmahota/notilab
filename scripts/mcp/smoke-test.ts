/**
 * scripts/mcp/smoke-test.ts — End-to-end smoke test for the NotiLab MCP server.
 *
 *   pnpm mcp:smoke                         -> NEXT_PUBLIC_BASE_URL, else production
 *   pnpm mcp:smoke http://localhost:3000   -> a deployment of your choosing
 *   pnpm mcp:smoke http://localhost:3000 --write
 *                                          -> also exercise the editorial lifecycle
 *
 * What it answers: can the credential in NOTILAB_MCP_API_KEY actually drive this
 * deployment over MCP, and does the transport in front of every tool still
 * behave — the handshake, the tool catalogue, authentication, the verb guards,
 * an unknown tool name, and the shape a model receives when a call is refused.
 * A different question from `pnpm test`, which runs the units in isolation with
 * no deployment involved.
 *
 * ── Safety ───────────────────────────────────────────────────────────────────
 *
 * **The default run is strictly read-only, and writes nothing at all — not even
 * an audit row.** This project's local environment has historically pointed at
 * the same database as production, so a smoke test that created or published an
 * article would be editing the live newsroom.
 *
 * That is stricter than it may look. Probing a *mutating* tool with a bad
 * payload is not read-only either: a refused write still produces an
 * `AdminAction` row, by design. So the default run proves containment from the
 * schemas the server advertises in `tools/list` rather than by attempting a
 * write it expects to fail. If you add a case to the default run, keep it to
 * `search_articles` / `get_article` / `list_categories` and the protocol methods.
 *
 * `--write` opts into the editorial lifecycle. Even then it never publishes:
 * it creates its own DRAFT, walks it to APPROVED, and archives it. Archiving is
 * terminal and NotiLab deletes nothing, so each `--write` run leaves one
 * ARCHIVED article behind — visible to an operator, invisible to a reader.
 * Point it at a staging deployment if you have one.
 *
 * The key is read from the environment or, failing that, parsed out of .env —
 * tsx does not load .env on its own. It is never printed, not even in part, and
 * a dedicated check asserts it never comes back in a response body.
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

const args = process.argv.slice(2)
const writeMode = args.includes("--write")
const positional = args.find((arg) => !arg.startsWith("--"))

const baseUrl = (
  positional ??
  env("MCP_BASE_URL") ??
  env("NEXT_PUBLIC_BASE_URL") ??
  "https://notilab.vercel.app"
).replace(/\/+$/, "")

const apiKey = env("NOTILAB_MCP_API_KEY")

if (!apiKey) {
  console.error("NOTILAB_MCP_API_KEY is not set (checked the environment and .env).")
  console.error("Generate one with: openssl rand -hex 32")
  process.exit(1)
}

/** A key of an acceptable length that is definitely not the configured one. */
const WRONG_KEY = "0".repeat(64)

/** The version this script negotiates. The server also accepts older ones. */
const PROTOCOL_VERSION = "2025-06-18"

// ── Wire helpers ─────────────────────────────────────────────────────────────

interface McpToolResult {
  content?: Array<{ type?: string; text?: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

interface McpBody {
  jsonrpc?: string
  id?: unknown
  result?: McpToolResult & Record<string, unknown>
  error?: { code?: number; message?: string; data?: unknown }
}

interface Result {
  status: number
  headers: Headers
  body: McpBody
  /** Kept raw so a check can assert what is *not* in it. */
  raw: string
}

let rpcId = 0

async function rpc(
  method: string,
  params?: unknown,
  init: { key?: string | null; notification?: boolean } = {},
): Promise<Result> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Both are required of a client by the Streamable HTTP spec. This server
    // always answers JSON, but a client that omits them is a client that will
    // break against a stricter server later.
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  }

  const key = init.key === undefined ? apiKey! : init.key
  if (key) headers.Authorization = `Bearer ${key}`

  const message: Record<string, unknown> = { jsonrpc: "2.0", method }
  if (!init.notification) message.id = ++rpcId
  if (params !== undefined) message.params = params

  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  })

  const raw = await response.text()
  let body: McpBody = {}
  try {
    body = raw ? (JSON.parse(raw) as McpBody) : {}
  } catch {
    // A non-JSON answer is itself a failure; the assertion reports it.
  }

  return { status: response.status, headers: response.headers, body, raw }
}

function callTool(
  name: string,
  toolArguments: Record<string, unknown>,
  meta?: Record<string, unknown>,
): Promise<Result> {
  return rpc("tools/call", {
    name,
    arguments: toolArguments,
    ...(meta ? { _meta: meta } : {}),
  })
}

/** The payload of a successful tool call, or undefined if it was refused. */
function payload(result: Result): Record<string, unknown> | undefined {
  if (result.body.result?.isError) return undefined
  return result.body.result?.structuredContent
}

/** The NotiLab error code of a refused tool call, if it was refused. */
function refusal(result: Result): string | undefined {
  if (!result.body.result?.isError) return undefined
  const error = result.body.result.structuredContent?.error as { code?: string } | undefined
  return error?.code
}

// ── Reporting ────────────────────────────────────────────────────────────────

let failures = 0
let checksRun = 0

/** One named assertion. `detail` prints on both outcomes, so a pass is legible too. */
function check(name: string, passed: boolean, detail: string): void {
  checksRun += 1
  if (passed) {
    console.log(`  PASS  ${name} — ${detail}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name} — ${detail}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

/** Every response seen so far, so one check can sweep them all for the key. */
const seenBodies: string[] = []

function remember(result: Result): Result {
  seenBodies.push(result.raw)
  return result
}

// ── The fifteen tools, as the operator should see them ───────────────────────

const EXPECTED_TOOLS = [
  "search_articles",
  "get_article",
  "list_categories",
  "create_article",
  "update_article",
  "update_article_seo",
  "set_article_image",
  "submit_article_for_review",
  "approve_article",
  "reject_article",
  "publish_article",
  "unpublish_article",
  "schedule_article",
  "unschedule_article",
  "archive_article",
]

const READ_ONLY_TOOLS = ["search_articles", "get_article", "list_categories"]

/** Fields no update_article schema may ever advertise. */
const FORBIDDEN_UPDATE_FIELDS = [
  "status",
  "publishedAt",
  "sourceUrl",
  "sourceName",
  "trending",
  "rankingScore",
  "importanceScore",
  "authorId",
  "reviewerId",
]

// ── Read-only checks ─────────────────────────────────────────────────────────

interface ToolDescriptor {
  name?: string
  description?: string
  inputSchema?: { additionalProperties?: boolean; properties?: Record<string, unknown> }
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

/** Returns the granted tool names, so the write phase can skip what it cannot call. */
async function readOnlyChecks(): Promise<string[]> {
  section("Liveness")

  // The only unauthenticated endpoint, and the one an MCP platform's connection
  // test hits before a credential exists.
  const healthResponse = await fetch(`${baseUrl}/api/mcp/health`)
  const health = (await healthResponse.json()) as {
    status?: string
    configured?: boolean
    protocolVersion?: string
  }
  check(
    "health reports a configured MCP server",
    healthResponse.status === 200 && health.status === "ok" && health.configured === true,
    `${healthResponse.status} configured=${health.configured} protocol=${health.protocolVersion}`,
  )

  section("Authentication")

  const anonymous = remember(await rpc("ping", undefined, { key: null }))
  check(
    "an anonymous caller is refused",
    anonymous.status === 401 && /UNAUTHENTICATED/.test(anonymous.body.error?.message ?? ""),
    `${anonymous.status} ${anonymous.body.error?.message?.split(":")[0]}`,
  )

  const wrongKey = remember(await rpc("ping", undefined, { key: WRONG_KEY }))
  check(
    "a wrong key is refused",
    wrongKey.status === 401 && /INVALID_API_KEY/.test(wrongKey.body.error?.message ?? ""),
    `${wrongKey.status} ${wrongKey.body.error?.message?.split(":")[0]}`,
  )

  section("Handshake")

  const initialize = remember(
    await rpc("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "notilab-smoke-test", version: "1.0" },
    }),
  )
  const capabilities = initialize.body.result?.capabilities as
    | { tools?: unknown; resources?: unknown; prompts?: unknown }
    | undefined
  const serverInfo = initialize.body.result?.serverInfo as { name?: string; version?: string } | undefined

  check(
    "initialize negotiates a protocol version",
    initialize.status === 200 && initialize.body.result?.protocolVersion === PROTOCOL_VERSION,
    `${initialize.status} protocol=${initialize.body.result?.protocolVersion} server=${serverInfo?.name}@${serverInfo?.version}`,
  )
  check(
    "only the tools capability is declared",
    Boolean(capabilities?.tools) && !capabilities?.resources && !capabilities?.prompts,
    `capabilities=${Object.keys(capabilities ?? {}).join(",") || "none"}`,
  )
  check(
    "the protocol version is echoed as a header",
    initialize.headers.get("mcp-protocol-version") === PROTOCOL_VERSION,
    `MCP-Protocol-Version=${initialize.headers.get("mcp-protocol-version")}`,
  )
  check(
    "the response is not cacheable",
    initialize.headers.get("cache-control") === "no-store",
    `Cache-Control=${initialize.headers.get("cache-control")}`,
  )
  check(
    "instructions state the editorial workflow up front",
    typeof initialize.body.result?.instructions === "string" &&
      (initialize.body.result.instructions as string).includes("APPROVED"),
    `${String(initialize.body.result?.instructions ?? "").length} characters`,
  )

  const ping = remember(await rpc("ping"))
  check("ping is answered", ping.status === 200 && Boolean(ping.body.result), `${ping.status}`)

  section("Transport")

  // A notification carries no id and must receive no response body.
  const notified = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  })
  check(
    "a notification is answered with 202 and no body",
    notified.status === 202 && (await notified.text()) === "",
    `${notified.status}`,
  )

  // This server offers no SSE channel and issues no session id, so the spec
  // asks for a 405 on both.
  const getVerb = await fetch(`${baseUrl}/api/mcp`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  check("GET on the endpoint is a 405", getVerb.status === 405, `${getVerb.status}`)

  const deleteVerb = await fetch(`${baseUrl}/api/mcp`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  check("DELETE on the endpoint is a 405", deleteVerb.status === 405, `${deleteVerb.status}`)

  const badJson = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: "{not json",
  })
  const badJsonBody = (await badJson.json()) as McpBody
  check(
    "a malformed body is a JSON-RPC parse error",
    badJson.status === 400 && badJsonBody.error?.code === -32700,
    `${badJson.status} ${badJsonBody.error?.code}`,
  )

  const unknownMethod = remember(await rpc("sampling/createMessage", {}))
  check(
    "an unsupported method is METHOD_NOT_FOUND",
    unknownMethod.body.error?.code === -32601,
    `${unknownMethod.body.error?.code}`,
  )

  section("Tool catalogue")

  const listed = remember(await rpc("tools/list"))
  const tools = (listed.body.result?.tools ?? []) as ToolDescriptor[]
  const names = tools.map((tool) => tool.name ?? "")
  const granted = names.filter(Boolean)

  const unexpected = names.filter((name) => !EXPECTED_TOOLS.includes(name))
  check(
    "the catalogue contains only declared NotiLab tools",
    listed.status === 200 && unexpected.length === 0,
    unexpected.length === 0
      ? `${names.length} tool(s)`
      : `unexpected: ${unexpected.join(", ")}`,
  )

  const readOnlyCredential = READ_ONLY_TOOLS.every((name) => names.includes(name)) && names.length === 3
  if (names.length === EXPECTED_TOOLS.length) {
    check(
      "all fifteen tools are granted to this credential",
      EXPECTED_TOOLS.every((name) => names.includes(name)),
      "NOTILAB_MCP_PERMISSIONS=editorial",
    )
  } else if (readOnlyCredential) {
    check(
      "the three read tools are granted to this credential",
      true,
      "NOTILAB_MCP_PERMISSIONS looks like readonly — widen it to exercise the lifecycle",
    )
  } else {
    check(
      "the catalogue matches a recognised permission preset",
      false,
      `${names.length} tool(s): ${names.join(", ")}`,
    )
  }

  const shortest = tools.reduce(
    (least, tool) => Math.min(least, (tool.description ?? "").length),
    Number.POSITIVE_INFINITY,
  )
  check(
    "every tool advertises a description a model can act on",
    tools.length > 0 && tools.every((tool) => (tool.description ?? "").length > 40),
    tools.length > 0 ? `shortest=${shortest} characters` : "no tools returned",
  )

  check(
    "every schema rejects unknown fields",
    tools.every((tool) => tool.inputSchema?.additionalProperties === false),
    `${tools.length} schema(s) with additionalProperties:false`,
  )

  check(
    "the read tools are annotated read-only",
    READ_ONLY_TOOLS.filter((name) => names.includes(name)).every(
      (name) => tools.find((tool) => tool.name === name)?.annotations?.readOnlyHint === true,
    ),
    "search_articles, get_article, list_categories",
  )

  // Containment, proven from what the server advertises rather than by
  // attempting a write — a refused write would still produce an audit row.
  const update = tools.find((tool) => tool.name === "update_article")
  if (update) {
    const exposed = Object.keys(update.inputSchema?.properties ?? {})
    const leaked = FORBIDDEN_UPDATE_FIELDS.filter((field) => exposed.includes(field))
    check(
      "update_article exposes no protected field",
      leaked.length === 0,
      leaked.length === 0 ? `fields: ${exposed.join(",")}` : `LEAKED: ${leaked.join(", ")}`,
    )
  }

  section("Reads")

  const unknownTool = remember(await callTool("run_sql", { query: "select 1" }))
  check(
    "a tool outside the registry cannot be invoked",
    unknownTool.body.error?.code === -32602,
    `${unknownTool.body.error?.code} ${unknownTool.body.error?.message?.slice(0, 40)}`,
  )

  const categories = remember(await callTool("list_categories", {}))
  const categoryList = (payload(categories)?.categories ?? []) as Array<{ slug?: string }>
  check(
    "list_categories returns the taxonomy",
    categories.status === 200 && Array.isArray(categoryList) && categoryList.length > 0,
    `${categoryList.length} category slug(s)`,
  )

  const search = remember(await callTool("search_articles", { limit: 2, sortBy: "recent" }))
  const page = payload(search) as
    | { articles?: unknown[]; pagination?: { total?: number } }
    | undefined
  check(
    "search_articles returns a page",
    search.status === 200 &&
      Array.isArray(page?.articles) &&
      page.articles.length <= 2 &&
      typeof page?.pagination?.total === "number",
    `${page?.articles?.length ?? 0} article(s) of ${page?.pagination?.total ?? "?"} total`,
  )

  // Every filter is optional — `query` in particular is not required.
  const noFilters = remember(await callTool("search_articles", {}))
  check(
    "an empty argument object is accepted",
    noFilters.status === 200 && !noFilters.body.result?.isError,
    `${noFilters.status}`,
  )

  // The editorial filters, the reason this tool exists rather than the public
  // feed. Zero rows is a valid answer; a refusal is not.
  const drafts = remember(
    await callTool("search_articles", { status: "DRAFT", hasImage: false, limit: 1 }),
  )
  const draftPage = payload(drafts) as { pagination?: { total?: number } } | undefined
  check(
    "editorial filters are accepted (status + hasImage)",
    drafts.status === 200 && !drafts.body.result?.isError,
    `${draftPage?.pagination?.total ?? "?"} draft(s) without an image`,
  )

  const firstArticle = (page?.articles ?? [])[0] as { id?: string; title?: string } | undefined
  if (firstArticle?.id) {
    const article = remember(await callTool("get_article", { id: firstArticle.id }))
    const detail = payload(article) as { id?: string; content?: string } | undefined
    check(
      "get_article returns the full body",
      article.status === 200 && detail?.id === firstArticle.id && typeof detail?.content === "string",
      `${(detail?.content ?? "").length} characters of body`,
    )
  } else {
    check("get_article was exercised", false, "no article available to fetch — is the database empty?")
  }

  const missing = remember(await callTool("get_article", { id: "definitely-not-an-article-id" }))
  check(
    "a missing article is a readable refusal, not a protocol error",
    missing.status === 200 && refusal(missing) === "ARTICLE_NOT_FOUND",
    `isError=${missing.body.result?.isError} code=${refusal(missing)}`,
  )
  check(
    "a refusal carries text a model can read",
    (missing.body.result?.content ?? []).some((part) => (part.text ?? "").includes("ARTICLE_NOT_FOUND")),
    `${missing.body.result?.content?.length ?? 0} content block(s)`,
  )

  return granted
}

// ── Write checks (opt-in) ────────────────────────────────────────────────────

async function writeChecks(granted: string[]): Promise<void> {
  section("Editorial lifecycle (--write)")

  const missing = ["create_article", "update_article", "submit_article_for_review", "approve_article", "archive_article"].filter(
    (name) => !granted.includes(name),
  )
  if (missing.length > 0) {
    check(
      "the credential can exercise the lifecycle",
      false,
      `not granted: ${missing.join(", ")} — set NOTILAB_MCP_PERMISSIONS=editorial`,
    )
    return
  }

  const categories = await callTool("list_categories", {})
  const slug = ((payload(categories)?.categories ?? []) as Array<{ slug?: string }>)[0]?.slug
  if (!slug) {
    check("a category is available to file the test article under", false, "list_categories returned none")
    return
  }

  const stamp = new Date().toISOString()
  // Unmistakable to anyone who finds the row later.
  const title = `[SMOKE TEST] NotiLab MCP ${stamp}`
  const idempotencyKey = `mcp-smoke-${stamp}`

  const created = remember(
    await callTool(
      "create_article",
      {
        title,
        content:
          "Artigo criado automaticamente pelo smoke test do servidor MCP do NotiLab. " +
          "Não é conteúdo editorial e nunca chega a ser publicado.",
        categorySlug: slug,
        summary: "Artigo de teste — arquivado no fim desta execução.",
      },
      { "notilab/idempotencyKey": idempotencyKey },
    ),
  )
  const article = payload(created) as { id?: string; status?: string; sourceName?: string } | undefined

  check(
    "create_article produces a DRAFT",
    created.status === 200 && article?.status === "DRAFT",
    `status=${article?.status} id=${article?.id}`,
  )
  check(
    "an agent-authored article is stamped as such, not attributed to an outlet",
    (article?.sourceName ?? "").includes("agent:"),
    `sourceName=${article?.sourceName}`,
  )

  const id = article?.id
  if (!id) {
    check("the lifecycle can continue", false, "create_article returned no id")
    return
  }

  // Cleanup runs whatever happens below, so a failed assertion does not leave a
  // DRAFT lying in the newsroom.
  try {
    // The same explicit key must replay rather than create a second article.
    const replayed = remember(
      await callTool(
        "create_article",
        {
          title,
          content:
            "Artigo criado automaticamente pelo smoke test do servidor MCP do NotiLab. " +
            "Não é conteúdo editorial e nunca chega a ser publicado.",
          categorySlug: slug,
          summary: "Artigo de teste — arquivado no fim desta execução.",
        },
        { "notilab/idempotencyKey": idempotencyKey },
      ),
    )
    const replayedArticle = payload(replayed) as { id?: string } | undefined
    check(
      "an idempotency key replays instead of creating a second article",
      replayedArticle?.id === id,
      `same id=${replayedArticle?.id === id}`,
    )

    // The gate, on a real deployment rather than in a mock: a DRAFT cannot be
    // published however the request is phrased.
    const prematurePublish = remember(await callTool("publish_article", { id }))
    check(
      "publishing a DRAFT is refused with ARTICLE_NOT_APPROVED",
      refusal(prematurePublish) === "ARTICLE_NOT_APPROVED",
      `code=${refusal(prematurePublish)}`,
    )

    // Containment against a real article. These are the cases that justify the
    // audit rows they produce.
    const provenance = remember(await callTool("update_article", { id, sourceUrl: "https://example.test/fake" }))
    check(
      "provenance cannot be rewritten",
      refusal(provenance) === "VALIDATION_FAILED",
      `code=${refusal(provenance)}`,
    )

    const score = remember(await callTool("update_article", { id, rankingScore: 99 }))
    check(
      "a computed score cannot be set",
      refusal(score) === "VALIDATION_FAILED",
      `code=${refusal(score)}`,
    )

    const status = remember(await callTool("update_article", { id, status: "PUBLISHED" }))
    check(
      "status cannot be written directly",
      refusal(status) === "VALIDATION_FAILED",
      `code=${refusal(status)}`,
    )

    // The edit an operator will actually ask for first.
    const edited = remember(await callTool("update_article", { id, summary: "Resumo corrigido pelo smoke test." }))
    const changed = (payload(edited)?.changed ?? []) as string[]
    check(
      "update_article changes only the field that was sent",
      edited.status === 200 && changed.length === 1 && changed[0] === "summary",
      `changed=[${changed.join(",")}]`,
    )

    if (granted.includes("update_article_seo")) {
      const seo = remember(await callTool("update_article_seo", { id, summary: "Meta description do smoke test." }))
      const seoChanged = (payload(seo)?.changed ?? []) as string[]
      check(
        "update_article_seo leaves the slug alone when none was asked for",
        seo.status === 200 && !seoChanged.includes("slug"),
        `changed=[${seoChanged.join(",")}]`,
      )
    }

    if (granted.includes("set_article_image")) {
      const image = remember(
        await callTool("set_article_image", { id, imageUrl: "https://example.test/smoke.jpg" }),
      )
      const imageChanged = (payload(image)?.changed ?? []) as string[]
      check(
        "set_article_image sets the lead image",
        image.status === 200 && imageChanged.includes("imageUrl"),
        `changed=[${imageChanged.join(",")}]`,
      )
    }

    const submitted = remember(await callTool("submit_article_for_review", { id }))
    check(
      "submit_article_for_review moves DRAFT to PENDING_REVIEW",
      (payload(submitted)?.article as { status?: string } | undefined)?.status === "PENDING_REVIEW",
      `status=${(payload(submitted)?.article as { status?: string } | undefined)?.status}`,
    )

    const approved = remember(await callTool("approve_article", { id }))
    check(
      "approve_article moves PENDING_REVIEW to APPROVED",
      (payload(approved)?.article as { status?: string } | undefined)?.status === "APPROVED",
      `status=${(payload(approved)?.article as { status?: string } | undefined)?.status}`,
    )

    if (granted.includes("schedule_article")) {
      const when = new Date(Date.now() + 24 * 3600_000).toISOString()
      const scheduled = remember(await callTool("schedule_article", { id, publishAt: when }))
      check(
        "schedule_article records a future publication for an APPROVED article",
        scheduled.status === 200 && !scheduled.body.result?.isError,
        `publishAt=${(payload(scheduled)?.publishAt as string | undefined) ?? "?"}`,
      )

      const past = remember(await callTool("schedule_article", { id, publishAt: "2020-01-01T00:00:00Z" }))
      check(
        "a schedule in the past is refused",
        refusal(past) === "SCHEDULE_IN_THE_PAST",
        `code=${refusal(past)}`,
      )

      const unscheduled = remember(await callTool("unschedule_article", { id }))
      check(
        "unschedule_article cancels the pending intent",
        unscheduled.status === 200 && !unscheduled.body.result?.isError,
        `${unscheduled.status}`,
      )
    }

    // Deliberately NOT publishing. The gate has already been proven above, and
    // nothing this script creates belongs on the public site.
    check("nothing was published", true, "publish_article was only ever exercised as a refusal")
  } finally {
    section("Cleanup")
    const archived = remember(await callTool("archive_article", { id }))
    const archivedStatus = (payload(archived)?.article as { status?: string } | undefined)?.status
    check(
      "the test article was archived",
      archivedStatus === "ARCHIVED",
      `status=${archivedStatus} id=${id} (ARCHIVED is terminal — the row is kept, as NotiLab deletes nothing)`,
    )
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`NotiLab MCP smoke test against ${baseUrl}`)
  console.log(
    writeMode
      ? "Mode: --write — creates a DRAFT, walks it to APPROVED, never publishes, archives it at the end.\n"
      : "Mode: read-only — writes nothing, not even an audit row. Pass --write to exercise the lifecycle.\n",
  )

  const granted = await readOnlyChecks()

  if (writeMode) {
    await writeChecks(granted)
  }

  section("Secrets")
  const leaked = seenBodies.filter((body) => body.includes(apiKey!))
  check(
    "the API key never appears in a response body",
    leaked.length === 0,
    `${seenBodies.length} response(s) inspected`,
  )

  console.log(
    failures === 0
      ? `\nAll ${checksRun} checks passed.`
      : `\n${failures} of ${checksRun} check(s) failed.`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("\nSmoke test could not complete:", error instanceof Error ? error.message : error)
  process.exit(1)
})
