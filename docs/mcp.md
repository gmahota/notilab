# NotiLab MCP Server

A remote [Model Context Protocol](https://modelcontextprotocol.io) server that
lets MCP clients — Abacus.ai, ChatGPT and Claude today, any agent tomorrow — operate
NotiLab as an **editor**.

It is a transport, not a second product. Every tool it exposes is a tool from
`lib/agent/registry.ts`, executed through the same pipeline the Agent Management
API uses. There is no editorial logic in `lib/mcp/`, and there must never be.

- **Endpoint**: `POST /api/mcp` (Streamable HTTP, stateless) — **one endpoint for every client**
- **Health**: `GET /api/mcp/health` (unauthenticated)
- **Auth**: `Authorization: Bearer <that client's key>`, one key per client
- **Protocol versions**: `2025-06-18`, `2025-03-26`, `2024-11-05`
- **Tools**: 15, listed below. Four of them require confirmation
- **Companion transport**: `/api/agent` — unchanged, see `docs/agent-api.md`

## Architecture

```
Abacus.ai ─┐
ChatGPT   ─┤
Claude    ─┤  each with its own API key
future    ─┘
  → POST /api/mcp                      one endpoint, JSON-RPC 2.0, Streamable HTTP
  → authenticate                       NOTILAB_MCP_CLIENTS_JSON, environment only
                                       → clientId + permissions, from the secret
  → lib/mcp/server.ts                  method dispatch, nothing else
  → lib/agent/execute.ts               ── the one pipeline ──
       rate limit  → resolve tool → authorise → validate
       → confirmation gate → idempotency → audit
  → lib/agent/registry.ts              the 15 declared tools
  → lib/editorial/*                    business rules: lifecycle, provenance
  → Prisma
  → PostgreSQL
```

There is **one** endpoint. There is no `/api/mcp/abacus` and no
`/api/mcp/chatgpt`, because a per-client route is a per-client code path, and a
per-client code path is where a rule eventually gets implemented twice. Clients
differ by credential, never by URL.

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
Authorization: Bearer <that client's API key>
```

Bearer only. The Agent API additionally accepts `X-Agent-Api-Key` because some
platforms cannot set an `Authorization` header on a hand-built HTTP action; a
first-class MCP client always can, so the extra surface buys nothing.

**The identity is resolved from the secret, and only from the secret.** There is
no header, tool argument or `clientInfo` field that names the calling client. A
request that claims to be Abacus is not believed, it is authenticated — which is
the property that makes the per-client audit trail worth anything. There is a
test that sends `_meta` and `clientInfo` naming another client and asserts the
call is still attributed to the credential that made it.

| Property | Behaviour |
|---|---|
| No client configured | Every call answers `503` / `AGENT_API_DISABLED`. MCP is opt-in. |
| Key shorter than 32 chars | That client is refused at load, with a server-log error naming the client, never the key. |
| Two clients sharing a key | **Both refused.** A request could not be attributed to either, so the roster fails visibly rather than picking whichever entry came first. |
| Duplicate client id | The second is dropped and logged. Ids must be unique — they key the rate limiter and the audit trail. |
| `disabled: true` | Revoked. The config stays, the key stops working. |
| Fallback to the Agent API key | **None.** A deploy with an agent key but no MCP client exposes no MCP. |
| Comparison | Double-HMAC then `timingSafeEqual` (`lib/agent/secret-compare.ts`), against every candidate with no early exit, so response time does not reveal roster position. |
| Key in responses, logs, audit | Never. Verified by test. |
| Human auth | Untouched. `lib/admin-auth.ts` is for people and is not reachable from here. |

The credential is checked **before the body is read**, so an unauthenticated
caller never has its payload parsed.

`GET /api/mcp/health` is the only unauthenticated endpoint, for the same reason
`/api/agent/health` is: a platform's connection test runs before a credential
exists. It reports that the service is up and whether *any* client is
configured. It never reports which, how many, or with what permissions.

## Clients

One endpoint, several clients. Abacus.ai, ChatGPT and any future internal agent
POST to the same URL and run the same tools; what separates them is the
credential they present.

Everything downstream keys off the identity that credential resolves to:

| Concern | Isolation |
|---|---|
| Audit | Every row is `userId = agent:<clientId>` with `details.agentId` and `details.transport = "mcp"` |
| Rate limit | Counted per client id. A looping ChatGPT session cannot exhaust Abacus's budget |
| Idempotency | Keys are namespaced by client id, so two clients retrying `brief-01` do not collide |
| Discovery | `tools/list` is narrowed to that client's permissions |
| Revocation | Per client, by `disabled: true` or by removing the entry |

### Configuring the roster

`NOTILAB_MCP_CLIENTS_JSON` — a JSON object keyed by client id:

```json
{
  "abacus":  { "apiKey": "…", "permissions": "editorial", "label": "Abacus.ai" },
  "chatgpt": { "apiKey": "…", "permissions": "readonly",  "label": "ChatGPT"  }
}
```

A JSON array is also accepted, matching `NOTILAB_AGENT_API_KEYS`:

```json
[{ "id": "abacus", "apiKey": "…", "permissions": "editorial" }]
```

| Field | Required | Meaning |
|---|---|---|
| `apiKey` (or `key`) | yes | Minimum 32 characters, unique across clients |
| `permissions` | no | `readonly` \| `editorial` \| `seo` \| comma-separated list. **Omitted grants `readonly`, never more** |
| `label` | no | Human name for logs |
| `disabled` | no | `true` revokes the client without deleting its configuration |
| `skipCriticalConfirmation` | no | `true` exempts it from the confirmation gate. A deliberate risk acceptance — see § Critical actions |

The client id is the string an operator will read in every audit row, so it is
worth choosing: `abacus`, `chatgpt`, `newsroom-batch`.

**Secrets never live in the repository.** The roster is one environment
variable, set in Vercel and in a local `.env` that is git-ignored. Nothing in
`lib/`, `docs/` or `.env.example` carries a real key, and none of these variables
is `NEXT_PUBLIC_*`, so none reaches the browser bundle.

### Revoking one client

Three ways, in increasing severity:

1. Set `"disabled": true` on that client and redeploy. Its key stops working;
   nothing else changes.
2. Remove the entry entirely and redeploy.
3. Replace its `apiKey` with a fresh `openssl rand -hex 32` and redeploy, then
   hand the new value to that platform.

None of these touch any other client. That is the reason not to share one key.

### Migrating from the single-key setup

`NOTILAB_MCP_API_KEY`, `NOTILAB_MCP_AGENT_ID` and `NOTILAB_MCP_PERMISSIONS` are
still honoured, and they **coexist** with the roster — the legacy credential is
simply one more client. So the migration has no window in which MCP is down:

1. Deploy this version. The existing single key keeps working, unchanged.
2. Add `NOTILAB_MCP_CLIENTS_JSON` with a fresh key per client. Redeploy.
3. Point each platform at its own key and confirm from the audit trail that the
   right client id appears.
4. Clear the three legacy variables. Redeploy.

New configuration should use the roster. The legacy variables are a migration
path, not a second supported shape.

## Environment variables

Names only. **No real value appears in this repository, in `.env.example`, or in
any log line.**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NOTILAB_MCP_CLIENTS_JSON` | one of the two | — | The client roster. See § Clients |
| `NOTILAB_MCP_API_KEY` | one of the two | — | Legacy single client. Min 32 chars |
| `NOTILAB_MCP_AGENT_ID` | no | `abacus-mcp` | Identity of the legacy client |
| `NOTILAB_MCP_PERMISSIONS` | no | `readonly` | Grants of the legacy client |
| `NOTILAB_MCP_IDEMPOTENCY_WINDOW_MS` | no | `900000` | Retry window for derived idempotency keys |
| `NOTILAB_AGENT_CONFIRMATION_SECRET` | no | a constant | HMAC key for confirmation tokens. **Set it** — see § Critical actions |
| `NOTILAB_AGENT_RATE_LIMIT` | no | `120` | Requests per window, counted per client |
| `NOTILAB_AGENT_RATE_WINDOW_MS` | no | `60000` | As above |

None are `NEXT_PUBLIC_*`, so none reach the browser bundle. Omitting a
permissions value grants **less**, never more.

Generating a key, per client:

```bash
openssl rand -hex 32
```

## Permissions

Two levels answer the brief, and both come from `lib/agent/permissions.ts` — the
same catalogue and the same presets as every other transport. There is no
parallel permission model in `lib/mcp/`.

| Preset | Tools | For |
|---|---|---|
| `readonly` | `search_articles`, `get_article`, `list_categories` | A client that answers questions about the newsroom |
| `editorial` | all 15 | A client that operates it |

Authorisation is enforced in one place — `assertPermissions` inside
`lib/agent/execute.ts`, between resolving the tool and validating the input.
There is no permission check in any route handler, in `lib/mcp/`, or in any tool
handler, so there is no door where the rule could be spelled differently.

`tools/list` is filtered to what the credential holds, which is not cosmetic: a
model shown a tool it cannot call will call it, be refused, and try again. A
`readonly` client is told about three tools and not that the other twelve exist.

The finer-grained permissions behind the presets, for a client that needs
something in between:

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

**`article.review` + `article.publish` on one credential is self-approval.** An
`editorial` client can approve its own drafts and publish them. That is a real
property and the operator's decision; the confirmation gate below slows it down
but does not remove it. Issue two clients if a human must stand between drafting
and the public site.

## Critical actions

Tools are classified into three tiers in `lib/agent/critical-actions.ts`, which
is the single place the classification lives.

| Tier | Tools | Confirmation | Audited |
|---|---|---|---|
| **read** | `search_articles`, `get_article`, `list_categories` | no | no |
| **write** | `create_article`, `update_article`, `update_article_seo`, `set_article_image`, `submit_article_for_review`, `reject_article`, `schedule_article`, `unschedule_article` | no | yes |
| **critical** | `approve_article`, `publish_article`, `unpublish_article`, `archive_article` | **yes** | yes |

What the critical four have in common is not that they are irreversible —
`unpublish` and `approve` are both walk-backable — but that their blast radius is
outside NotiLab. `publish` and `unpublish` change what a reader sees right now;
`approve` is the gate that makes publishing possible at all; `archive` is
terminal and only an operator can undo it.

`reject_article` is terminal too and is deliberately **not** critical: it removes
a story that was never public. Adding it would train agents to treat the
confirmation step as noise, which is how a real gate stops working.

### The two-call flow

1. The client calls the tool normally.
2. NotiLab refuses with `CONFIRMATION_REQUIRED`, carrying a summary and a
   `confirmationToken` in `details.confirmation`.
3. The client shows the summary to its operator.
4. On approval, it repeats the **identical** call with the token in `_meta`:

```json
{
  "jsonrpc": "2.0", "id": 7, "method": "tools/call",
  "params": {
    "name": "publish_article",
    "arguments": { "id": "cmg…" },
    "_meta": { "notilab/confirmationToken": "9f3a…" }
  }
}
```

The token travels in `_meta` rather than in `arguments` because every tool
advertises `additionalProperties: false`, so a strict client would drop an
undeclared argument before it reached the server. Over the Agent API the same
token goes in the request body as `confirmationToken`. Both reach the same check.

The token is an HMAC of `(clientId, tool, validated input)`, so it is bound to
the exact act approved. A token minted for `archive_article {id: A}` does not
authorise `{id: B}`, and a token minted for Abacus does not work for ChatGPT.
Both are tested.

**Set `NOTILAB_AGENT_CONFIRMATION_SECRET`.** With it unset the HMAC falls back to
a constant, which was harmless while no policy fired and is not any more.

### What the gate does and does not buy

Be precise about this, because it is easy to overstate. The token proves payload
integrity, not human approval — an autonomous client can read the token out of
the refusal and repeat the call by itself. What the gate buys:

- the act becomes **visible**: two audit rows, one with
  `confirmation: {required: true, satisfied: false}` and one with
  `satisfied: true`;
- a client's confirmation UI has something to hook, and MCP clients surface an
  `isError` result to their user;
- an agent that was looping cannot publish on the first misfire.

Turning it into real human approval needs an approval queue with an identity
attached, tracked in `docs/agent-api.md`. This is the seam for it.

### Exempting a client

```json
{ "newsroom-batch": { "apiKey": "…", "permissions": "editorial",
                      "skipCriticalConfirmation": true } }
```

For an unattended internal pipeline whose operator has accepted that it can
publish and archive on a single call. It is opt-out rather than opt-in, so a
client configured by someone who never considered confirmation gets the gate.
Exempting one client does not affect any other.

## Tools

All fifteen, exactly as named in `lib/agent/registry.ts`. At a glance:

| Tool | Permission | Confirmation | Description |
|---|---|---|---|
| `search_articles` | `article.read` | — | Find articles by text, status, category, tag, source, date range. Paged, max 50 |
| `get_article` | `article.read` | — | One article by id or slug, with full body, AI enrichment and any pending schedule |
| `list_categories` | `taxonomy.read` | — | The category taxonomy, with article counts. The only source of a valid `categorySlug` |
| `create_article` | `article.create` | — | Create an article. **Always a DRAFT** — there is no status parameter |
| `update_article` | `article.update` | — | Rewrite editorial fields in place, at any status. Only the fields sent are touched |
| `update_article_seo` | `seo.update` | — | Slug, headline and summary. The slug changes only when explicitly supplied |
| `set_article_image` | `media.update` | — | Set or clear the lead image. An omitted field never wipes one |
| `submit_article_for_review` | `article.review` | — | DRAFT → PENDING_REVIEW. The first editorial gate |
| `reject_article` | `article.review` | — | → REJECTED. Terminal, but the story was never public |
| `schedule_article` | `article.schedule` | — | Record a future publication for an APPROVED article. Intent only |
| `unschedule_article` | `article.schedule` | — | Cancel a pending schedule. The article keeps its status |
| `approve_article` | `article.review` | **required** | PENDING_REVIEW → APPROVED. Clears the article for publication |
| `publish_article` | `article.publish` | **required** | APPROVED → PUBLISHED. Visible to every reader, immediately |
| `unpublish_article` | `article.unpublish` | **required** | PUBLISHED → APPROVED. Off the public site immediately |
| `archive_article` | `article.archive` | **required** | → ARCHIVED. Terminal — nothing in this API restores it |

The full text a model sees for each tool is the `description` on its declaration
in `lib/agent/tools/*`, which states the required and optional fields, the
states the call can fail in, the consequences, and when *not* to reach for it.
Those descriptions and this table come from the same declarations, so neither can
drift from the other.

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

| Tool | Permission | Transition | Confirmation |
|---|---|---|---|
| `submit_article_for_review` | `article.review` | DRAFT → PENDING_REVIEW | — |
| `approve_article` | `article.review` | PENDING_REVIEW → APPROVED | **required** |
| `reject_article` | `article.review` | → REJECTED (terminal) | — |
| `publish_article` | `article.publish` | **APPROVED → PUBLISHED only** | **required** |
| `unpublish_article` | `article.unpublish` | PUBLISHED → APPROVED | **required** |
| `schedule_article` | `article.schedule` | Records intent for an APPROVED article | — |
| `unschedule_article` | `article.schedule` | Cancels pending intent | — |
| `archive_article` | `article.archive` | → ARCHIVED (terminal) | **required** |

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
| `userId` | `agent:<clientId>` — `agent:abacus`, `agent:chatgpt`, … |
| `action` | `ARTICLE_UPDATE`, `ARTICLE_PUBLISH`, `ARTICLE_SEO_UPDATE`, … |
| `resource` | `ARTICLE`, `ARTICLE_SCHEDULE`, `AGENT_IDEMPOTENCY` |
| `resourceId` | Article id |
| `details` | `{ agentId, transport, tool, outcome, requestId, durationMs, input, changes, errorCode, errorMessage, idempotencyKey, confirmation }` |

Every question the brief asks the trail to answer, and where it is answered:

| Question | Field |
|---|---|
| Who executed it? | `userId` / `details.agentId` — the client id, resolved from the credential |
| Over which transport? | `details.transport` (`"mcp"` or `"http"`) |
| Which tool? | `details.tool` |
| When? | `createdAt` |
| With what arguments? | `details.input` — validated, then `redact()`ed |
| What changed? | `details.changes`, per field, before and after |
| Success or failure? | `details.outcome`, plus `errorCode` / `errorMessage` |
| Which article? | `resourceId` |
| Was confirmation used? | `details.confirmation` — `null` when the gate did not apply |
| Which idempotency key? | `details.idempotencyKey` |
| Correlation id? | `details.requestId` — shared by every log line and audit row of one call |

`transport` and `confirmation` are the added keys; the rest of the format is
unchanged, so existing queries keep working.

```json
{
  "agentId": "abacus",
  "transport": "mcp",
  "tool": "publish_article",
  "outcome": "success",
  "requestId": "0f0c…",
  "durationMs": 41,
  "input": { "id": "cmg…" },
  "changes": { "status": { "before": "APPROVED", "after": "PUBLISHED" } },
  "errorCode": null,
  "errorMessage": null,
  "idempotencyKey": "mcp:9f3a…:1786400",
  "confirmation": { "required": true, "satisfied": true }
}
```

A confirmed critical action leaves **two** rows: the refusal, with
`confirmation: {required: true, satisfied: false}` and
`errorCode: "CONFIRMATION_REQUIRED"`, and then the call that went through.

Refused and invalid attempts are recorded too — "this agent tried to publish a
draft nine times" is what an operator needs to see afterwards. Rate-limited calls
are logged to the console but not to the database, so a throttled loop does not
amplify itself.

Nothing sensitive is stored: every payload passes `redact()`, which replaces any
key matching `pass|secret|token|api_key|authorization|credential|cookie|session`,
truncates strings at 2 000 characters and bounds nesting depth.

Reading the trail:

```sql
-- Everything one client did, newest first.
SELECT "createdAt", "action", "resourceId",
       "details"->>'tool'       AS tool,
       "details"->>'outcome'    AS outcome,
       "details"->>'errorCode'  AS error,
       "details"->'confirmation' AS confirmation,
       "details"->>'requestId'  AS request_id
FROM admin_actions
WHERE "details"->>'transport' = 'mcp'
  AND "details"->>'agentId'   = 'abacus'
ORDER BY "createdAt" DESC
LIMIT 100;
```

```sql
-- Every critical action that was actually carried out, by client.
SELECT "details"->>'agentId' AS client, "details"->>'tool' AS tool, count(*)
FROM admin_actions
WHERE "details"->'confirmation'->>'satisfied' = 'true'
  AND "details"->>'outcome' = 'success'
GROUP BY 1, 2 ORDER BY 3 DESC;
```

## Examples

`curl` is the quickest way to prove the endpoint works before pointing a client
at it. The tool call below is one round trip; a real client sends `initialize`
first, but this server is stateless and does not require it.

```bash
BASE=https://notilab.vercel.app
KEY=…                                   # one client's key from the roster
AUTH="Authorization: Bearer $KEY"
JSON="Content-Type: application/json"
ACCEPT="Accept: application/json, text/event-stream"
```

Health, no credential needed:

```bash
curl -s $BASE/api/mcp/health
# {"status":"ok","service":"notilab-mcp","version":"1.0","transport":"streamable-http","protocolVersion":"2025-06-18","configured":true,"timestamp":"…"}
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

A critical action, both halves. First the refusal, which carries the token:

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":7,"method":"tools/call",
  "params":{"name":"publish_article","arguments":{"id":"cmg…"}}}'
```

```json
{ "result": { "isError": true, "structuredContent": { "error": {
  "code": "CONFIRMATION_REQUIRED",
  "message": "Publishing makes this article visible to every reader of the public site. Confirm to proceed.",
  "details": {
    "confirmation": { "reason": "critical_action", "summary": "…", "confirmationToken": "9f3a…" },
    "howToConfirm": "Repeat this exact call with _meta: {\"notilab/confirmationToken\": \"9f3a…\"} …"
  } } } } }
```

Then the identical call, carrying it:

```bash
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":8,"method":"tools/call",
  "params":{"name":"publish_article",
            "arguments":{"id":"cmg…"},
            "_meta":{"notilab/confirmationToken":"9f3a…"}}}'
```

The full path from a draft to the public site — no shortcut, and the last two
steps are each two calls because `approve_article` and `publish_article` are
critical:

```bash
# 1. DRAFT → PENDING_REVIEW, ungated
curl -s -X POST $BASE/api/mcp -H "$AUTH" -H "$JSON" -H "$ACCEPT" -d '{
  "jsonrpc":"2.0","id":9,"method":"tools/call",
  "params":{"name":"submit_article_for_review","arguments":{"id":"cmg…"}}}'

# 2. approve_article, then repeat it with the token it hands back
# 3. publish_article, then repeat it with the token it hands back
```

## Connecting a client

The steps are the same for every client, because there is one endpoint and one
authentication scheme. What differs is where that platform's UI puts the URL and
the bearer token.

### 1. Generate a key for that client

```bash
openssl rand -hex 32
```

One per client. Never reuse a key across two clients — the server refuses both if
you do, because a request could not then be attributed to either.

### 2. Add it to the roster

Vercel → Settings → Environment Variables (Production, and Preview if you use it),
as **one line**:

```
NOTILAB_MCP_CLIENTS_JSON = {"abacus":{"apiKey":"<key A>","permissions":"editorial","label":"Abacus.ai"},"chatgpt":{"apiKey":"<key B>","permissions":"readonly","label":"ChatGPT"}}
```

Also set, once:

```
NOTILAB_AGENT_CONFIRMATION_SECRET = <openssl rand -hex 32>
```

**Redeploy after adding them** — new variables only take effect in a new build.

Start every client at `readonly` and widen to `editorial` once the round trip
works. Widening is one edit; un-publishing something an agent published on its
first attempt is not.

### 3. Check the deployment before configuring anything

```bash
curl -s https://<your-deployment>/api/mcp/health
```

```json
{"status":"ok","service":"notilab-mcp","version":"1.0","transport":"streamable-http",
 "protocolVersion":"2025-06-18","configured":true,"timestamp":"…"}
```

`"configured": false` means no client parsed — the variable is missing, is not
valid JSON, or every key is under 32 characters. Fix that first; every
authenticated call answers `503` until it is true. The health endpoint will not
tell you *which* client failed, on purpose — the server log will, by id.

Then confirm one credential:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<your-deployment>/api/mcp \
  -H "Authorization: Bearer <key A>" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
# 200 → the key is right.  401 → it is not.
```

### 4. Confirm the tool catalogue

```bash
curl -s -X POST https://<your-deployment>/api/mcp \
  -H "Authorization: Bearer <key A>" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).result.tools.map(t=>t.name)))"
```

Fifteen names with `editorial`; **three** with `readonly` (`search_articles`,
`get_article`, `list_categories`). Three when you expected fifteen means the
roster reached the deploy but that client's `permissions` did not say
`editorial` — check the server log for
`client "<id>" has unknown permission entries`.

### 5. First calls, in order

**Do not make publishing the first test.** Start with a read, then a read of one
item, then the smallest possible write.

1. **"Procura as últimas 5 notícias do NotiLab."** → `search_articles`. Nothing
   is written; no audit row appears.
2. **"Abre a primeira notícia e mostra o conteúdo completo."** → `get_article`
   with the id from step 1. Still a read.
3. **"Corrige apenas o resumo desta notícia."** → one `update_article` carrying
   `id` and `summary` and nothing else. The first write. Verify it landed *and*
   that it was attributed to the right client:

   ```sql
   SELECT "createdAt", "action", "resourceId",
          "details"->>'agentId' AS client,
          "details"->>'changes' AS changes
   FROM admin_actions
   WHERE "details"->>'transport' = 'mcp'
   ORDER BY "createdAt" DESC LIMIT 5;
   ```

   The row should show `ARTICLE_UPDATE`, the client id you expect, and a
   `changes` object containing only `summary`.

Only after those three behave should you exercise the lifecycle tools, and then
on a test article rather than a live one.

## Connecting Abacus.ai

### Server URL

```
https://notilab.vercel.app/api/mcp
```

Configure it as a **remote / HTTP MCP server** (Streamable HTTP), not as a local
stdio command. There is no NotiLab process to run locally.

### Authentication

Static bearer token, sent on every request, in Abacus's custom-headers /
authorization field:

```
Authorization: Bearer <key A>   ← the value from the roster, nothing else
```

No `Basic`, no query parameter, no cookie.

### Requirements Abacus must meet

| Requirement | Value |
|---|---|
| Transport | Streamable HTTP (remote), not stdio |
| Method | `POST` only. `GET` and `DELETE` answer 405 |
| `Accept` | `application/json, text/event-stream` |
| Session | None. Any `Mcp-Session-Id` is ignored |
| Auth | A static `Authorization: Bearer` header on every request |
| OAuth | Not supported and not required |

## Connecting ChatGPT

ChatGPT is **just another MCP client**. It uses the same endpoint, the same
protocol and the same authentication as Abacus — the only NotiLab-side work is
adding a second entry to the roster with its own key.

There is deliberately no `/api/mcp/chatgpt`, no OpenAI SDK anywhere in the
codebase, and no branch in the pipeline that asks which client is calling. If a
future change needed one, that would be the signal that something had gone wrong.

### Server URL

```
https://notilab.vercel.app/api/mcp
```

### Authentication

```
Authorization: Bearer <key B>
```

### What the server offers, so you can check it against the connector's requirements

| Property | NotiLab |
|---|---|
| Transport | Streamable HTTP, stateless |
| Protocol versions | `2025-06-18`, `2025-03-26`, `2024-11-05` (negotiated on `initialize`) |
| Methods | `initialize`, `ping`, `tools/list`, `tools/call` |
| Capabilities declared | `tools` only. No resources, prompts, sampling or elicitation |
| Server-initiated messages | None. A POST is answered with `application/json`, never SSE |
| Session id | None issued; any sent is ignored |
| Auth | Static bearer token. **No OAuth 2.1 authorization server, no dynamic client registration** |
| CORS | Not enabled — server-to-server only |
| Search / fetch tools | `search_articles` and `get_article` are the closest equivalents, but they are ordinary tools, not the `search`/`fetch` pair some ChatGPT surfaces expect for retrieval connectors |

The last two rows are the ones to check first if a connector will not attach.
Some ChatGPT connector surfaces accept only OAuth-authenticated servers, and
some deep-research surfaces expect tools literally named `search` and `fetch`.
NotiLab implements neither today — see § Limitations 5, and treat the connector
UI's own current requirements as authoritative rather than anything written here,
which will age.

### Recommended starting grant

```json
"chatgpt": { "apiKey": "…", "permissions": "readonly", "label": "ChatGPT" }
```

Read-only until the round trip is proven. When you widen it to `editorial`, the
four critical actions stay behind the confirmation gate — which is exactly the
case that gate exists for, because a conversational client is the most likely to
be asked to publish something on an ambiguous instruction.

## Connecting Claude

Claude is an MCP client like any other — same endpoint, same protocol, same
bearer token, its own entry in the roster. Add it as `claude`:

```json
"claude": { "apiKey": "<key C>", "permissions": "editorial", "label": "Claude" }
```

### Claude Code

Claude Code can set arbitrary headers on a remote MCP server, which is what
NotiLab needs. Check the current flags with `claude mcp add --help` — the CLI is
authoritative and this document is not — but the shape is:

```bash
claude mcp add --transport http notilab https://notilab.vercel.app/api/mcp \
  --header "Authorization: Bearer $NOTILAB_CLAUDE_KEY"
```

To share the server with a repository rather than one machine, commit a
`.mcp.json` at the project root **with the key read from the environment, never
inlined**:

```json
{
  "mcpServers": {
    "notilab": {
      "type": "http",
      "url": "https://notilab.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer ${NOTILAB_CLAUDE_KEY}" }
    }
  }
}
```

Then `claude mcp list` to confirm it connected, and ask it to run
`list_categories` as the first call — it is the cheapest tool that proves
authentication, authorisation and the round trip at once.

### Claude Desktop

The Connectors UI accepts a remote MCP server URL. Whether it can also carry a
static `Authorization` header depends on the version in front of you — that
surface is OAuth-oriented, and NotiLab does not implement OAuth (§ Limitations
5). If the connector dialog offers no place for a bearer token, use Claude Code
instead, or treat it as one of the two triggers for revisiting OAuth.

### What to expect once connected

On `initialize` the model receives an `instructions` block stating the editorial
workflow, the fields it must not try to write, the two-call confirmation flow for
critical actions, and how to retry safely. It is not a permission grant — every
rule in it is enforced in `lib/editorial/article-service.ts` for every caller —
it just saves the model a refused call.

Good first prompts, in order:

1. *"Que categorias existem no NotiLab?"* → `list_categories`. No write.
2. *"Procura as últimas 5 notícias."* → `search_articles`. No write.
3. *"Corrige apenas o resumo desta notícia."* → one `update_article`. First write.

Ask it to publish only once those three behave, and expect it to come back for
confirmation — that refusal is the gate working, not a failure.

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
4. **Confirmation proves payload integrity, not human approval.** The token is
   an HMAC of the approved act, so it cannot be replayed onto different
   arguments or by a different client — but an autonomous client can read it out
   of the refusal and repeat the call itself. What the gate buys is visibility
   and a hook for a client's confirmation UI, not a human in the loop. A real
   approval queue with an identity attached is the next step; see
   `docs/agent-api.md`.
5. **Static bearer tokens, not OAuth.** The MCP spec's authorization framework
   (OAuth 2.1 resource server, dynamic client registration, PKCE) is not
   implemented. NotiLab has no authorization server for machine clients, and a
   per-client static key already gives independent identity, permissions,
   revocation, audit and rate limiting. Revisit when a client platform requires
   OAuth, or when third parties rather than the operator start registering
   clients — at that point only `lib/mcp/auth.ts` changes, because
   `lib/agent/execute.ts` receives an `AgentIdentity` and does not care how it
   was proven.
6. **Keys do not expire and do not rotate on their own.** Rotation is an
   operator changing a value in the roster and redeploying. There is no refresh
   token and no expiry, which is the honest cost of not running an
   authorization server.
7. **Rate limits and permissions are per client, but the database is not.** Two
   clients with `editorial` can edit the same article. Isolation is of identity,
   budget and audit — not of content.
8. **No bulk tools.** Every tool acts on one article, which is what keeps the
   audit trail per-article and the rate limit meaningful. A 40-article operation
   is 40 calls.
9. **REJECTED and ARCHIVED are terminal.** `business-rules.md` says so and it
   outranks a task prompt, so nothing here can restore an archived article. Only
   an operator can.
10. **Scheduling is intent-only until the cron is enabled.**
   `/api/cron/publish-scheduled` exists and is deliberately not registered in
   `vercel.json`. Until an operator switches it on, `schedule_article` records an
   intent that nothing acts on — the tool's own description says so.
11. **No `resources` or `prompts`.** Tools only. The empty lists are a courtesy to
   clients that probe.
12. **No CORS.** A browser-based MCP client cannot call this endpoint.
13. **No tests hit a real database.** Every test mocks Prisma. The protocol,
    authentication, permissions, validation, transitions, idempotency and audit
    shape are covered; actual SQL behaviour is not.
14. **The protocol layer is hand-written.** See § Design decision. It tracks the
    2025-06-18 spec for the stateless subset; a future spec revision is a change
    to `lib/mcp/protocol.ts` rather than a dependency bump.

## Debugging

**Everything answers 503 / `AGENT_API_DISABLED`.** No client parsed. Either
`NOTILAB_MCP_CLIENTS_JSON` is unset, is not valid JSON, or every entry was
refused. Check `GET /api/mcp/health` for `configured`, then the server log,
which names each refused client by id:

```
[mcp/auth] NOTILAB_MCP_CLIENTS_JSON is not valid JSON — ignoring it
[mcp/auth] apiKey for client "chatgpt" is shorter than 32 characters — refusing it
[mcp/auth] client "chatgpt" shares its apiKey with another client — refusing both …
[mcp/auth] duplicate client id "abacus" — keeping only the first
```

Remember that a new variable needs a **redeploy**.

**One client answers 401 while another works.** That client's key does not
match, or its entry carries `"disabled": true`, or it was dropped for one of the
reasons above. The server never echoes a key, by design, so compare lengths and
check for a trailing newline or a stray quote in the Vercel value.

**Everything answers 401.** As above, but check the JSON is on one line — a
multi-line value in the Vercel UI is a common cause.

**`tools/list` returns three tools instead of fifteen.** That client's
`permissions` did not reach the running deploy, so it fell back to `readonly`.
Look for `client "<id>" has unknown permission entries: …` in the log.

**A critical action always answers `CONFIRMATION_REQUIRED`, even on the second
call.** Three usual causes, in order of likelihood:

1. The client sent the token in `arguments` rather than `_meta`. Every tool
   advertises `additionalProperties: false`, so the token is rejected as an
   unknown field — the response would be `VALIDATION_FAILED` — or dropped by a
   strict client before it is sent.
2. The arguments changed between the two calls. The token is bound to the exact
   payload; even a reordered array invalidates it.
3. The retry came from a different client. Tokens are bound to the client id.

**The audit trail names the wrong client.** It does not — the id is resolved
from the credential and nothing in the request can influence it. What has
usually happened is that two platforms were configured with the same key, which
the server now refuses outright, or a key was moved between roster entries
without redeploying.

**A tool call fails but the client shows nothing useful.** Read
`result.structuredContent.error` — the code and message are there. Then grep the
server log for the `requestId` from the same object; every log line and every
audit row for that call carries it.

**A write succeeded but no audit row appeared.** Look for
`[agent/audit] FAILED to record …` in the log. The mutation is not rolled back —
the pipeline reports the gap rather than failing completed work.

**Calls suddenly answer `RATE_LIMITED`.** 120 requests per minute per client by
default. A looping model is the usual cause; the log line
`[agent/execute] rate limit hit by agent:<clientId>` names which one.

Local exercise:

```bash
pnpm dev
# in another shell — put this in .env on ONE line, then restart pnpm dev
KEY=$(openssl rand -hex 32)
echo "NOTILAB_MCP_CLIENTS_JSON={\"local\":{\"apiKey\":\"$KEY\",\"permissions\":\"readonly\"}}"
curl -s http://localhost:3000/api/mcp/health
```

Tests:

```bash
pnpm test __tests__/lib/mcp                        # transport, multi-client, gate
pnpm test __tests__/lib/agent/critical-actions     # the risk classification
pnpm test                                          # everything
```

## Source map

| Path | Role |
|---|---|
| `app/api/mcp/route.ts` | HTTP framing: auth, decode, dispatch, 405s |
| `app/api/mcp/health/route.ts` | Unauthenticated liveness |
| `lib/mcp/protocol.ts` | JSON-RPC 2.0 types, version negotiation |
| `lib/mcp/auth.ts` | **The client roster.** Secret → client identity and grants |
| `lib/mcp/tools.ts` | Registry → MCP descriptors, annotations |
| `lib/mcp/server.ts` | Method dispatch, idempotency and confirmation `_meta`, result framing |
| `lib/agent/execute.ts` | **The shared pipeline. Both transports enter here** |
| `lib/agent/registry.ts` | The catalogue — the source of truth for both transports |
| `lib/agent/critical-actions.ts` | **The risk tiers and the confirmation policy the critical tools share** |
| `lib/agent/permissions.ts` | The permission catalogue and the `readonly` / `editorial` presets |
| `lib/agent/confirmation.ts` | Token derivation and comparison |
| `lib/agent/audit.ts` | The `AdminAction` row, including `transport` and `confirmation` |
| `lib/agent/rate-limit.ts` | Per-client-id request budget |
| `lib/agent/idempotency.ts` | Claim / replay / mismatch, namespaced per client |
| `lib/agent/runner.ts` | The Agent API's HTTP adapter over the same pipeline |
| `lib/editorial/article-service.ts` | Business layer: lifecycle, field whitelist, publish gate |
| `__tests__/lib/mcp/server.test.ts` | Transport, containment, audit and idempotency |
| `__tests__/lib/mcp/clients.test.ts` | **Multi-client auth, permissions, isolation, the confirmation gate** |
| `__tests__/lib/agent/critical-actions.test.ts` | Risk classification, and the drift guard against the registry |
