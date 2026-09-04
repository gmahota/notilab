# NotiLab MCP Server

A remote [Model Context Protocol](https://modelcontextprotocol.io) server that
lets an MCP client — Abacus.ai first — operate NotiLab as an **editor**.

It is a transport, not a second product. Every tool it exposes is a tool from
`lib/agent/registry.ts`, executed through the same pipeline the Agent Management
API uses. There is no editorial logic in `lib/mcp/`, and there must never be.

- **Endpoint**: `POST /api/mcp` (Streamable HTTP, stateless)
- **Health**: `GET /api/mcp/health` (unauthenticated)
- **Protocol versions**: `2025-06-18`, `2025-03-26`, `2024-11-05`
- **Tools**: 15, listed below
- **Companion transport**: `/api/agent` — unchanged, see `docs/agent-api.md`

## Architecture

```
Abacus.ai (MCP client)
  → POST /api/mcp                      JSON-RPC 2.0, Streamable HTTP
  → authenticate                       NOTILAB_MCP_API_KEY, environment only
  → lib/mcp/server.ts                  method dispatch, nothing else
  → lib/agent/execute.ts               ── the one pipeline ──
       rate limit  → resolve tool → authorise → validate
       → confirmation gate → idempotency → audit
  → lib/agent/registry.ts              the 15 declared tools
  → lib/editorial/*                    business rules: lifecycle, provenance
  → Prisma
  → PostgreSQL
```

The Agent API enters the same pipeline one layer up:

```
Other agents → POST /api/agent/tools/<tool> → lib/agent/runner.ts ─┐
Abacus.ai    → POST /api/mcp                → lib/mcp/server.ts   ─┴→ lib/agent/execute.ts
```

Both transports authenticate their own credential and then hand an
`AgentIdentity` plus an untrusted argument object to `executeToolCall`. Neither
owns a single step of the pipeline, so neither can skip one.

### Why there is no drift

The MCP tool list is *derived*, not written:

| MCP field | Source |
|---|---|
| `name`, `title`, `description` | the tool declaration in `lib/agent/tools/*` |
| `inputSchema` | `toJsonSchema(tool.input)` — the same function that produces `/api/agent/capabilities` and the OpenAPI document |
| visibility | `tool.permissions` vs. the credential's grants |
| `annotations` | `lib/mcp/tools.ts`, the one MCP-only table |

Adding a tool to `lib/agent/registry.ts` exposes it over MCP. Removing one
removes it. Changing a schema changes both transports in the same commit.

The annotation table is the only hand-maintained list, and it is guarded: a
mutating tool with no entry is presented as destructive and non-idempotent, and
`__tests__/lib/mcp/server.test.ts` fails until someone classifies it.

### What it cannot do

Not filtered out — structurally absent. There is no tool for any of it, which is
a stronger guarantee than a permission an operator could grant by mistake.

- No SQL, no query parameter, no free-form filter.
- No generic executor, no `{ action, params }` envelope, no arbitrary tool name:
  a name resolves only against the compile-time registry, and an unknown one is
  a JSON-RPC `-32602`.
- No file system, no shell, no code execution, no HTTP fetch on a caller-supplied URL.
- No Prisma client reachable from a tool argument.
- No users, roles, settings or secrets endpoint.
- No hard delete. `archive_article` is the strongest destructive action, and it
  is a status change — the row, its provenance and its history survive.
- No writes to `status`, `publishedAt`, `sourceUrl`, `sourceName`, `trending`,
  `rankingScore`, `importanceScore`, `authorId` or `reviewerId`. Those fields are
  not in any input schema and unknown fields are rejected, not dropped.

### Design decision: no MCP SDK

`@modelcontextprotocol/sdk` is the reference implementation and would be the
right choice for a standalone server. It was rejected here on three grounds,
recorded so the decision can be revisited rather than rediscovered:

1. **Dependency weight.** Its tree pulls `express`, `hono`, `cors`, `jose`,
   `ajv`, `zod`, `eventsource`, `pkce-challenge` and `express-rate-limit` — two
   complete HTTP server stacks — into a Next.js application that already has
   routing, a validator (`lib/agent/schema.ts`) and a rate limiter.
   `AGENTS.md` § Dependency Policy says prefer what is installed.
2. **Shape mismatch.** `StreamableHTTPServerTransport` is written against Node's
   `IncomingMessage`/`ServerResponse`, which the App Router does not expose. The
   usual bridge, `mcp-handler`, peer-depends on a *different* package
   (`@modelcontextprotocol/server`) and its SSE mode expects Redis — neither
   available in this stateless serverless deployment.
3. **Surface size.** Stateless Streamable HTTP is JSON-RPC 2.0 over one POST
   with five methods, no sessions and no server-initiated messages. That is
   `lib/mcp/protocol.ts` plus `lib/mcp/server.ts`, fully covered by tests.

**Zero dependencies were added.** Revisit if NotiLab ever needs server-initiated
notifications, sampling, elicitation or OAuth resource-server behaviour — at
that point the SDK earns its weight, and only `lib/mcp/` changes, because
`lib/agent/execute.ts` knows nothing about MCP.

## Transport

Stateless Streamable HTTP, which is a deliberate reading of the spec rather than
a partial implementation:

| Behaviour | Choice | Why |
|---|---|---|
| Session id | None issued; any `Mcp-Session-Id` is ignored | A serverless function has no process to hold a session in. The spec makes the id optional. |
| Response body | Always `application/json` | The spec permits JSON instead of SSE. With no server-initiated messages, a stream would carry one event and close. |
| `GET /api/mcp` | `405` | Prescribed for a server that offers no SSE channel. |
| `DELETE /api/mcp` | `405` | Nothing to terminate. |
| JSON-RPC batch | Accepted | Legal in `2025-03-26`, removed in `2025-06-18`. Refusing a frame an older client may send buys nothing. |
| Notifications | `202`, no body | `notifications/initialized` and friends need no answer. |
| CORS | Not enabled | Server-to-server only. A browser-based MCP client is not a supported caller. |

Methods implemented: `initialize`, `ping`, `tools/list`, `tools/call`.
`resources/list`, `resources/templates/list` and `prompts/list` answer with empty
lists — the server declares neither capability, but several clients probe anyway
and an empty list is clearer than an error the client has to decide is benign.
Anything else is `-32601`.

`initialize` returns an `instructions` string that states the editorial workflow
up front. It grants nothing — every rule in it is enforced in
`lib/editorial/article-service.ts` — it just saves the model a refused call.

## Authentication

```
Authorization: Bearer <NOTILAB_MCP_API_KEY>
```

Bearer only. The Agent API additionally accepts `X-Agent-Api-Key` because some
platforms cannot set an `Authorization` header on a hand-built HTTP action; a
first-class MCP client always can, so the extra surface buys nothing.

| Property | Behaviour |
|---|---|
| Not configured | Every call answers `503` / `AGENT_API_DISABLED`. MCP is opt-in. |
| Key shorter than 32 chars | Refused at load with a server-log error naming the variable, never the key. |
| Fallback to the Agent API key | **None.** A deploy with an agent key but no MCP key exposes no MCP. |
| Comparison | Double-HMAC then `timingSafeEqual` (`lib/agent/secret-compare.ts`), shared with the Agent API. |
| Key in responses, logs, audit | Never. Verified by test. |
| Human auth | Untouched. `lib/admin-auth.ts` is for people and is not reachable from here. |

The credential is checked **before the body is read**, so an unauthenticated
caller never has its payload parsed.

`GET /api/mcp/health` is the only unauthenticated endpoint, for the same reason
`/api/agent/health` is: a platform's connection test runs before a credential
exists.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NOTILAB_MCP_API_KEY` | yes | — | The MCP credential. Min 32 chars. `openssl rand -hex 32` |
| `NOTILAB_MCP_AGENT_ID` | no | `abacus-mcp` | Identity in audit rows (`agent:<id>`) |
| `NOTILAB_MCP_PERMISSIONS` | no | `readonly` | Same vocabulary and presets as `NOTILAB_AGENT_PERMISSIONS` |
| `NOTILAB_MCP_IDEMPOTENCY_WINDOW_MS` | no | `900000` | Retry window for derived idempotency keys |
| `NOTILAB_AGENT_RATE_LIMIT` | no | `120` | Shared with the Agent API; MCP gets its own counter because its `agentId` differs |
| `NOTILAB_AGENT_RATE_WINDOW_MS` | no | `60000` | As above |

None are `NEXT_PUBLIC_*`, so none reach the browser bundle. Omitting
`NOTILAB_MCP_PERMISSIONS` grants **less**, never more.

```bash
NOTILAB_MCP_API_KEY=$(openssl rand -hex 32)
NOTILAB_MCP_AGENT_ID=abacus-mcp
NOTILAB_MCP_PERMISSIONS=editorial
```

## Identity and permissions

MCP calls are never disguised as a human. Every audit row carries
`userId = agent:abacus-mcp` and `details.transport = "mcp"`, so an operator can
separate the two transports even if both credentials resolved to the same id.

Permissions come from `lib/agent/permissions.ts` — the same catalogue, the same
presets (`readonly`, `editorial`, `seo`), no parallel model.

| Permission | Grants |
|---|---|
| `article.read` | Read articles, including drafts and full bodies |
| `article.create` | Create an article (always as DRAFT) |
| `article.update` | Title, summary, body, category, tags, priority, read time |
| `article.review` | Submit for review, approve, reject |
| `article.publish` | Publish an already-approved article |
| `article.unpublish` | Withdraw a published article |
| `article.schedule` | Schedule or cancel a future publication |
| `article.archive` | Archive an article |
| `media.update` | Set or clear the lead image |
| `seo.update` | Slug, headline and summary |
| `taxonomy.read` | List categories |

`tools/list` is filtered to what the credential holds. A `readonly` credential is
shown three tools and is not told the other twelve exist — a model shown a tool
it cannot call will call it, be refused, and try again.

**`article.review` + `article.publish` on one credential is self-approval.** The
MCP agent can approve its own drafts and publish them. That is a real property
and the operator's decision; issue two credentials if a human should stand
between drafting and the public site.

## Tools

All fifteen, exactly as named in `lib/agent/registry.ts`.

### Read

| Tool | Permission | Notes |
|---|---|---|
| `search_articles` | `article.read` | `query` is **optional**. Filters: `query`, `status`, `published`, `categorySlug`, `tag`, `sourceName`, `authorId`, `priority`, `trending`, `hasImage`, `publishedFrom`, `publishedTo`, `sortBy`, `limit`, `offset`. Max 50 per page. `status` and `published` are mutually exclusive. |
| `get_article` | `article.read` | `id` accepts an **article id or a URL slug**. Returns the full body, AI enrichment, engagement counts and any pending schedule. |
| `list_categories` | `taxonomy.read` | No arguments. Slugs to use as `categorySlug`, with article counts. |

Reads are authenticated, authorised and rate-limited, but **not audited** — an
audit table that records every search stops being readable.

### Editorial

| Tool | Permission | Notes |
|---|---|---|
| `create_article` | `article.create` | Required: `title`, `content`, `categorySlug`. Optional: `summary`, `tags`, `imageUrl`, `sourceUrl`, `sourceName`, `publishedAt`, `readTime`. **Always creates a DRAFT** — there is no status parameter. |
| `update_article` | `article.update` | `title`, `summary`, `content`, `categorySlug`, `tags`, `priority`, `readTime`. Only the fields sent are touched. |
| `update_article_seo` | `seo.update` | `slug`, `title`, `summary`. The slug changes **only when supplied** — changing it breaks existing links, so a client must ask for it explicitly. |
| `set_article_image` | `media.update` | `imageUrl` (absolute http/https), or `clear: true`. One of the two is required — an omitted field never wipes an image. |

`update_article` **cannot** reach `sourceUrl`, `sourceName`, `status`,
`trending`, `rankingScore`, `importanceScore`, `authorId` or `reviewerId`. Those
are not in the schema, and unknown fields are rejected with `VALIDATION_FAILED`.

### Lifecycle

| Tool | Permission | Transition |
|---|---|---|
| `submit_article_for_review` | `article.review` | DRAFT → PENDING_REVIEW |
| `approve_article` | `article.review` | PENDING_REVIEW → APPROVED |
| `reject_article` | `article.review` | → REJECTED (terminal) |
| `publish_article` | `article.publish` | **APPROVED → PUBLISHED only** |
| `unpublish_article` | `article.unpublish` | PUBLISHED → APPROVED |
| `schedule_article` | `article.schedule` | Records intent for an APPROVED article |
| `unschedule_article` | `article.schedule` | Cancels pending intent |
| `archive_article` | `article.archive` | → ARCHIVED (terminal) |

The state machine, from `docs/memory/business-rules.md`:

```
DRAFT           → PENDING_REVIEW, REJECTED, ARCHIVED
PENDING_REVIEW  → APPROVED, REJECTED, DRAFT
APPROVED        → PUBLISHED, DRAFT, REJECTED, ARCHIVED
PUBLISHED       → APPROVED, ARCHIVED
REJECTED        → (terminal)
ARCHIVED        → (terminal)
```

**The publish gate is a business rule, not a permission.** A credential holding
`article.publish` still cannot publish a DRAFT — it gets `ARTICLE_NOT_APPROVED`
with the current status and what to do about it. There is no shortcut over MCP,
because MCP does not implement the transition; `lib/editorial/article-service.ts`
does, for every caller.

Moving to a state an article already holds succeeds and reports `changed: []`,
so every lifecycle tool is safe to retry.

### Annotations

Hints for the client's confirmation UI. The spec treats them as untrusted; the
real guarantees are the permissions and the business layer.

| Tool group | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---|---|---|
| the three read tools | `true` | — | — |
| `reject_article`, `archive_article` | `false` | `true` (terminal) | `true` |
| `create_article` | `false` | `false` | `false` |
| every other mutating tool | `false` | `false` | `true` |

`openWorldHint` is `false` everywhere: no tool reaches outside NotiLab's database.

## Error handling

Two kinds of failure, deliberately distinguished.

**Domain failures** come back as a *successful* JSON-RPC response carrying
`isError: true`. This is what the MCP spec prescribes and what a model needs: a
protocol error is swallowed by the client, while an error result is handed to the
model, which can read `ARTICLE_NOT_APPROVED` and approve the article instead of
retrying a call that can never succeed.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [{
      "type": "text",
      "text": "NotiLab refused this call.\n\ncode: ARTICLE_NOT_APPROVED\nmessage: An article must be APPROVED before publishing. This one is DRAFT. Use submit_article_for_review and approve_article first.\ndetails: {\"currentStatus\":\"DRAFT\"}\nrequestId: 0f0c…"
    }],
    "structuredContent": {
      "error": {
        "code": "ARTICLE_NOT_APPROVED",
        "message": "An article must be APPROVED before publishing. This one is DRAFT. …",
        "details": { "currentStatus": "DRAFT" }
      },
      "requestId": "0f0c…"
    },
    "isError": true
  }
}
```

The `code`, `message` and `details` are the Agent API's own, unchanged. The full
vocabulary is in `lib/agent/errors.ts` and documented in `docs/agent-api.md`; the
codes a model will actually meet:

`VALIDATION_FAILED` · `FORBIDDEN` · `ARTICLE_NOT_FOUND` · `CATEGORY_NOT_FOUND` ·
`DUPLICATE_SOURCE_URL` · `INVALID_STATUS_TRANSITION` · `ARTICLE_NOT_APPROVED` ·
`ARTICLE_NOT_SCHEDULED` · `SCHEDULE_IN_THE_PAST` · `NO_FIELDS_TO_UPDATE` ·
`CONFIRMATION_REQUIRED` · `RATE_LIMITED` · `IDEMPOTENCY_PAYLOAD_MISMATCH` ·
`IDEMPOTENCY_IN_PROGRESS` · `INTERNAL_ERROR`

**Protocol failures** are JSON-RPC errors, which the model never sees:

| Situation | JSON-RPC code | HTTP |
|---|---|---|
| Body is not JSON | `-32700` | 400 |
| Not a JSON-RPC 2.0 request | `-32600` | 200 (in the frame) |
| Missing credential / wrong key | `-32600`, message prefixed `UNAUTHENTICATED:` / `INVALID_API_KEY:` | 401 |
| MCP not configured | `-32600`, message prefixed `AGENT_API_DISABLED:` | 503 |
| Unknown tool name | `-32602` | 200 |
| Unsupported method | `-32601` | 200 |
| Unhandled exception | `-32603` | 200 or 500 |

**No stack trace ever leaves the server.** An unplanned exception is logged in
full with its `requestId` and answered as `INTERNAL_ERROR` with its message
dropped — its text could carry a query fragment or a connection string. There is
a test for exactly this.

## Idempotency

MCP has no `Idempotency-Key` header, so one is derived. The mechanism itself is
unchanged — the derived string goes to the same `claimIdempotencyKey` the Agent
API uses, with the same replay, mismatch and in-progress semantics.

| Source | Key |
|---|---|
| Client supplies `_meta["notilab/idempotencyKey"]` | Used verbatim (≤ 200 chars) |
| Otherwise | `mcp:<fingerprint(agentId, tool, arguments)>:<time bucket>` |

The fingerprint is canonical (object keys sorted at every level), so a model
regenerating the same call in a different key order is recognised as a repeat.

The time bucket matters: a key derived from the payload alone would be
*permanent*, and the same `create_article` payload sent a month later would
replay a stale response instead of creating an article. Bucketing by
`NOTILAB_MCP_IDEMPOTENCY_WINDOW_MS` (default 15 minutes) means a retry dedupes
and a genuine repeat later does not.

Only mutating tools claim a key. Reads need no protection, and claiming one
would write a bookkeeping row per search.

`create_article` is the tool that genuinely needs this — every other tool is
naturally idempotent.

**Honest limits:** two calls that straddle a bucket boundary will not dedupe, and
`AdminAction` has no unique index on `resourceId`, so two genuinely simultaneous
first-calls with the same key can both pass the lookup (a millisecond-wide race
inherited from the Agent API — see `docs/agent-api.md` § Limitations).

## Audit

Every mutation over MCP produces an `AdminAction` row, exactly as over HTTP.

| Column | Value |
|---|---|
| `userId` | `agent:abacus-mcp` |
| `action` | `ARTICLE_UPDATE`, `ARTICLE_PUBLISH`, `ARTICLE_SEO_UPDATE`, … |
| `resource` | `ARTICLE`, `ARTICLE_SCHEDULE`, `AGENT_IDEMPOTENCY` |
| `resourceId` | Article id |
| `details` | `{ agentId, transport, tool, outcome, requestId, durationMs, input, changes, errorCode, errorMessage, idempotencyKey }` |

`transport` is the one added key; the rest of the format is unchanged, so
existing queries keep working.

```json
{
  "agentId": "abacus-mcp",
  "transport": "mcp",
  "tool": "update_article",
  "outcome": "success",
  "requestId": "0f0c…",
  "durationMs": 41,
  "input": { "id": "cmg…", "summary": "Resumo corrigido." },
  "changes": { "summary": { "before": "Resumo antigo.", "after": "Resumo corrigido." } },
  "errorCode": null,
  "errorMessage": null,
  "idempotencyKey": "mcp:9f3a…:1786400"
}
```

Refused and invalid attempts are recorded too — "this agent tried to publish a
draft nine times" is what an operator needs to see afterwards. Rate-limited calls
are logged to the console but not to the database, so a throttled loop does not
amplify itself.

Nothing sensitive is stored: every payload passes `redact()`, which replaces any
key matching `pass|secret|token|api_key|authorization|credential|cookie|session`,
truncates strings at 2 000 characters and bounds nesting depth.

Reading the trail:

```sql
SELECT "createdAt", "action", "resourceId",
       "details"->>'outcome'   AS outcome,
       "details"->>'errorCode' AS error
FROM admin_actions
WHERE "details"->>'transport' = 'mcp'
ORDER BY "createdAt" DESC
LIMIT 100;
```

## Examples

`curl` is the quickest way to prove the endpoint works before pointing a client
at it. The tool call below is one round trip; a real client sends `initialize`
first, but this server is stateless and does not require it.

```bash
BASE=https://notilab.vercel.app
AUTH="Authorization: Bearer $NOTILAB_MCP_API_KEY"
JSON="Content-Type: application/json"
ACCEPT="Accept: application/json, text/event-stream"
```

Health, no credential needed:

```bash
curl -s $BASE/api/mcp/health
# {"status":"ok","configured":true,"protocolVersion":"2025-06-18","timestamp":"…"}
```

Handshake:

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":1,"method":"initialize",
  "params":{"protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"curl","version":"1.0"}}}'
```

List the tools this credential may use:

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

"Procura as últimas 5 notícias do NotiLab."

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":3,"method":"tools/call",
  "params":{"name":"search_articles",
            "arguments":{"limit":5,"sortBy":"recent"}}}'
```

"Abre a primeira notícia e mostra o conteúdo completo."

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":4,"method":"tools/call",
  "params":{"name":"get_article","arguments":{"id":"cmg…"}}}'
```

"Corrige apenas o resumo desta notícia."

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":5,"method":"tools/call",
  "params":{"name":"update_article",
            "arguments":{"id":"cmg…","summary":"Resumo corrigido."}}}'
```

Creating an article safely under retry, with an explicit key:

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":6,"method":"tools/call",
  "params":{"name":"create_article",
            "_meta":{"notilab/idempotencyKey":"brief-2026-09-04-01"},
            "arguments":{"title":"Título da peça",
                         "content":"Corpo completo do artigo…",
                         "categorySlug":"economia",
                         "summary":"Resumo curto."}}}'
```

The full path from a draft to the public site — three calls, no shortcut:

```bash
for tool in submit_article_for_review approve_article publish_article; do
  curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",
         \"params\":{\"name\":\"$tool\",\"arguments\":{\"id\":\"cmg…\"}}}"
done
```

## Abacus.ai connection

### 1. MCP Server URL

```
https://<your-deployment>/api/mcp
```

For the default Vercel project: `https://notilab.vercel.app/api/mcp`.

Configure it as a **remote / HTTP MCP server** (Streamable HTTP), not as a local
stdio command. There is no NotiLab process to run locally.

### 2. Authentication method

Static bearer token, sent on every request. Generate and set it first:

```bash
openssl rand -hex 32
```

In Vercel → Settings → Environment Variables (Production, and Preview if you use it):

| Variable | Value |
|---|---|
| `NOTILAB_MCP_API_KEY` | the 64-character hex string |
| `NOTILAB_MCP_AGENT_ID` | `abacus-mcp` |
| `NOTILAB_MCP_PERMISSIONS` | `readonly` to start; `editorial` once the round trip works |

**Redeploy after adding them** — new variables only take effect in a new build.

### 3. Bearer header format

```
Authorization: Bearer 8f3c1a…   ← the value of NOTILAB_MCP_API_KEY, nothing else
```

No `Basic`, no query parameter, no cookie. In Abacus's connector configuration
this goes in the custom-headers / authorization field.

### 4. Health test

Before configuring anything in Abacus:

```bash
curl -s https://<your-deployment>/api/mcp/health
```

Expected:

```json
{"status":"ok","configured":true,"protocolVersion":"2025-06-18","timestamp":"…"}
```

`"configured": false` means the environment variable is missing or shorter than
32 characters, and the deploy has not picked it up. Fix that before going on —
every authenticated call will answer `503` until it is true.

Then confirm the credential itself:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<your-deployment>/api/mcp \
  -H "Authorization: Bearer $NOTILAB_MCP_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
# 200 → the key is right.  401 → it is not.
```

### 5. Confirming the tools were discovered

In Abacus, after adding the connector, the tool list should show **exactly**
these names and no others:

```
search_articles          get_article              list_categories
create_article           update_article           update_article_seo
set_article_image
submit_article_for_review  approve_article        reject_article
publish_article          unpublish_article        schedule_article
unschedule_article       archive_article
```

Fifteen with `NOTILAB_MCP_PERMISSIONS=editorial`; **three** with `readonly`
(`search_articles`, `get_article`, `list_categories`). If you see three when you
expected fifteen, the permissions variable did not reach the running deploy.

Same check from the shell:

```bash
curl -s -X POST https://<your-deployment>/api/mcp \
  -H "Authorization: Bearer $NOTILAB_MCP_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | python -c "import json,sys; print([t['name'] for t in json.load(sys.stdin)['result']['tools']])"
```

### 6. First recommended test

In order. **Do not make publishing the first test** — start with a read, then a
read of one item, then the smallest possible write.

1. **"Procura as últimas 5 notícias do NotiLab."**
   Expect a `search_articles` call and five article summaries. Nothing is
   written; no audit row appears.

2. **"Abre a primeira notícia e mostra o conteúdo completo."**
   Expect a `get_article` call with the id from step 1, returning the full body.
   Still a read.

3. **"Corrige apenas o resumo desta notícia."**
   Expect one `update_article` call carrying `id` and `summary` and nothing else.
   This is the first write. Verify it landed:

   ```sql
   SELECT "createdAt", "action", "resourceId", "details"->>'changes'
   FROM admin_actions
   WHERE "details"->>'transport' = 'mcp'
   ORDER BY "createdAt" DESC LIMIT 5;
   ```

   The row should show `ARTICLE_UPDATE`, `agent:abacus-mcp`, and a `changes`
   object with only `summary` in it.

Only after those three behave should you exercise the lifecycle tools, and then
on a test article rather than a live one.

## Limitations

Honest list. None of these are hidden behind a workaround.

1. **Rate limiting is per serverless instance.** The counter lives in module
   memory, so the effective ceiling across a scaled deployment is
   `limit × instances`. It bounds a runaway agent loop within an instance, which
   is where one agent's requests overwhelmingly land. A shared counter needs Redis.
2. **Derived idempotency has a window boundary.** Two identical calls that
   straddle a bucket edge will not dedupe. A client that cares should send
   `_meta["notilab/idempotencyKey"]`.
3. **Idempotency has a millisecond-wide race.** `AdminAction` has no unique index
   on `resourceId`. Closing it means a dedicated model with `@@unique` — a schema
   change, deliberately not made.
4. **No confirmation flow over MCP yet.** The gate exists and no current tool
   fires it. If one ever does, the token comes back in the error `details`, but
   `confirmationToken` is not in any tool's `inputSchema`, so a strict client
   would strip it. Adding a confirmation policy means adding the field to the
   schemas of the tools that use it.
5. **No bulk tools.** Every tool acts on one article, which is what keeps the
   audit trail per-article and the rate limit meaningful. A 40-article operation
   is 40 calls.
6. **REJECTED and ARCHIVED are terminal.** `business-rules.md` says so and it
   outranks a task prompt, so nothing here can restore an archived article. Only
   an operator can.
7. **Scheduling is intent-only until the cron is enabled.**
   `/api/cron/publish-scheduled` exists and is deliberately not registered in
   `vercel.json`. Until an operator switches it on, `schedule_article` records an
   intent that nothing acts on — the tool's own description says so.
8. **No `resources` or `prompts`.** Tools only. The empty lists are a courtesy to
   clients that probe.
9. **No CORS.** A browser-based MCP client cannot call this endpoint.
10. **No tests hit a real database.** Every test mocks Prisma. The protocol,
    authentication, permissions, validation, transitions, idempotency and audit
    shape are covered; actual SQL behaviour is not.
11. **The protocol layer is hand-written.** See § Design decision. It tracks the
    2025-06-18 spec for the stateless subset; a future spec revision is a change
    to `lib/mcp/protocol.ts` rather than a dependency bump.

## Debugging

**Everything answers 503 / `AGENT_API_DISABLED`.** `NOTILAB_MCP_API_KEY` is
unset, blank, or under 32 characters. Check `GET /api/mcp/health` for
`configured`. Remember that a new variable needs a **redeploy**.

**Everything answers 401.** The bearer value does not match. The server never
echoes either key, by design, so compare lengths and check for a trailing newline
in the Vercel value.

**`tools/list` returns three tools instead of fifteen.**
`NOTILAB_MCP_PERMISSIONS` did not reach the running deploy, so the credential
fell back to `readonly`. Check for a typo — an unknown entry is reported in the
server log as `NOTILAB_MCP_PERMISSIONS contains unknown entries: …`.

**A tool call fails but the client shows nothing useful.** Read
`result.structuredContent.error` — the code and message are there. Then grep the
server log for the `requestId` from the same object; every log line and every
audit row for that call carries it.

**A write succeeded but no audit row appeared.** Look for
`[agent/audit] FAILED to record …` in the log. The mutation is not rolled back —
the pipeline reports the gap rather than failing completed work.

**Calls suddenly answer `RATE_LIMITED`.** 120 requests per minute per identity by
default. A looping model is the usual cause; the log line
`[agent/execute] rate limit hit by agent:abacus-mcp` names it.

Local exercise:

```bash
pnpm dev
# in another shell
NOTILAB_MCP_API_KEY=$(openssl rand -hex 32)   # also put this in .env, then restart pnpm dev
curl -s http://localhost:3000/api/mcp/health
```

Unit tests (no deployment involved):

```bash
pnpm test __tests__/lib/mcp
```

Smoke test against a running deployment — a different question from `pnpm test`,
which runs the units in isolation. It answers whether *this* deployment can
actually be driven by the credential in `NOTILAB_MCP_API_KEY`:

```bash
pnpm mcp:smoke                                  # NEXT_PUBLIC_BASE_URL, else production
```
```bash
pnpm mcp:smoke http://localhost:3000            # a deployment of your choosing
```

The default run is **strictly read-only and writes nothing at all — not even an
audit row**. That is stricter than it looks: probing a mutating tool with a bad
payload is not read-only either, because a refused write still produces an
`AdminAction` row. So the default run proves containment from the schemas the
server advertises in `tools/list` rather than by attempting a write it expects
to fail.

`--write` opts into the editorial lifecycle. Even then it never publishes: it
creates its own DRAFT, proves the publish gate refuses it, exercises the
containment rules and the review transitions, and archives it.

```bash
pnpm mcp:smoke https://notilab.vercel.app --write
```

Archiving is terminal and NotiLab deletes nothing, so **each `--write` run leaves
one ARCHIVED article behind** — visible to an operator, invisible to a reader.
Point it at a staging deployment if you have one.

## Source map

| Path | Role |
|---|---|
| `app/api/mcp/route.ts` | HTTP framing: auth, decode, dispatch, 405s |
| `app/api/mcp/health/route.ts` | Unauthenticated liveness |
| `lib/mcp/protocol.ts` | JSON-RPC 2.0 types, version negotiation |
| `lib/mcp/auth.ts` | The MCP credential |
| `lib/mcp/tools.ts` | Registry → MCP descriptors, annotations |
| `lib/mcp/server.ts` | Method dispatch, idempotency derivation, result framing |
| `lib/agent/execute.ts` | **The shared pipeline. Both transports enter here** |
| `lib/agent/registry.ts` | The catalogue — the source of truth for both transports |
| `lib/agent/runner.ts` | The Agent API's HTTP adapter over the same pipeline |
| `lib/editorial/article-service.ts` | Business layer: lifecycle, field whitelist, publish gate |
| `__tests__/lib/mcp/server.test.ts` | Transport, containment, audit and idempotency tests |
