# NotiLab Agent Management API

A controlled editorial surface for an external AI agent. It exists so an agent
can operate NotiLab as an **editor**, not as a developer: it reads and edits
articles through NotiLab's own business rules, and it cannot touch code,
infrastructure, users, settings, secrets or the database.

- **Version**: `1.0` (`meta.apiVersion` on every response)
- **Base path**: `/api/agent`
- **Machine-readable spec**: `GET /api/agent/openapi` — generated from the tool
  registry per request, so it cannot drift from the code. `pnpm agent:openapi`
  writes the same document to a file when a platform needs an upload; that file
  is gitignored, because a checked-in spec goes stale the moment a tool changes
  and a stale spec is worse than none — an agent that imported it sends requests
  that cannot succeed.
- **Discovery**: `GET /api/agent/capabilities`

## The guarantee

```
External agent
  → POST /api/agent/tools/<tool>        transport: names the capability in the URL
  → authenticate                        static API key, environment only
  → rate limit                          per agent identity
  → authorise                           per-tool permissions
  → validate                            declared schema, unknown fields rejected
  → confirmation gate                   for operations that require a human
  → idempotency                         Idempotency-Key, replay-safe
  → lib/editorial/*                     business rules: lifecycle, provenance
  → Prisma
  → audit trail                         AdminAction row, before/after
  → { success, data, meta }
```

An agent never receives a connection string, never issues SQL, never writes a
column directly, and cannot reach a code path that skips the review gate.

### There is a second transport, and it shares this pipeline

NotiLab also speaks MCP, at `POST /api/mcp`, for Abacus.ai and other MCP
clients (`docs/mcp.md`). It is **not** a second API: the stages between
"authenticate" and "audit trail" above live in `lib/agent/execute.ts`, and both
transports enter there with an `AgentIdentity` and an untrusted argument object.

```
Other agents → POST /api/agent/tools/<tool> → lib/agent/runner.ts ─┐
Abacus.ai    → POST /api/mcp                → lib/mcp/server.ts   ─┴→ lib/agent/execute.ts
```

Neither transport owns a pipeline stage, so neither can skip one, and the MCP
tool list is derived from this same registry — adding a tool here exposes it
there. The two carry separate credentials (`NOTILAB_AGENT_API_KEY` vs
`NOTILAB_MCP_API_KEY`) so either can be revoked alone, and every audit row
records which door a call came through as `details.transport`.

### There is no generic executor

There is no `POST /execute`, no endpoint that takes an instruction, and no
parameter anywhere that carries a query or a field list to apply. Every
capability is a **declared tool** in `lib/agent/registry.ts` with a fixed name,
a fixed input schema, a fixed permission cost and a fixed audit action. Adding a
capability means adding a line to that file in a reviewed commit.

`/api/agent/tools/[tool]` is one route file rather than seventeen, which can look
like a generic executor at a glance. It is not:

- the tool name is in the **URL**, not in the payload — a call names what it wants
  before any of its data is read;
- the name resolves only against the compile-time registry; an unknown name is a
  404 and never becomes a path, a table name, or anything the database sees;
- each tool keeps its own schema, permissions and audit action.

## Authentication

A static API key per agent identity, held only in the environment.

```
Authorization: Bearer <NOTILAB_AGENT_API_KEY>
```

`X-Agent-Api-Key: <key>` is accepted as a fallback for platforms that cannot set
an `Authorization` header on a custom action.

Properties worth knowing:

| Property | Behaviour |
|---|---|
| Not configured | Every call answers `AGENT_API_DISABLED` (503). The API is opt-in. |
| Key shorter than 32 chars | Refused at load with a server-log error. Generate with `openssl rand -hex 32`. |
| Comparison | SHA-256 then `timingSafeEqual`; all candidates compared with no early exit. |
| Wrong vs missing key | Distinct codes (`INVALID_API_KEY` / `UNAUTHENTICATED`), never echoes the presented key. |
| Human auth | Untouched. `lib/admin-auth.ts` (JWT cookie) is for people; this is separate on purpose. |

`GET /api/agent/health` is the only unauthenticated endpoint — an agent
platform's connection test runs before a credential exists. It reveals nothing
beyond liveness, the API version and whether *any* credential is configured.

## Permissions

Granted per credential. Finer-grained than the tool list, so one agent can be
"read + fix SEO" without also being able to publish.

| Permission | Grants |
|---|---|
| `article.read` | Read articles, including drafts and full bodies |
| `article.create` | Create an article (always as DRAFT) |
| `article.update` | Edit title, summary, body, category, tags, priority, read time |
| `article.review` | Submit for review, approve, reject |
| `article.publish` | Publish an already-approved article |
| `article.unpublish` | Withdraw a published article |
| `article.schedule` | Schedule or cancel a future publication |
| `article.archive` | Archive an article (NotiLab's alternative to delete) |
| `media.update` | Set or clear the lead image |
| `seo.update` | Slug, headline and summary — the search-facing fields |
| `taxonomy.read` | List categories |

Presets, so an operator does not hand-list eleven strings and get one wrong:

| Preset | Contents |
|---|---|
| `readonly` | `article.read`, `taxonomy.read` |
| `editorial` | everything above |
| `seo` | `article.read`, `seo.update`, `media.update`, `taxonomy.read` |

**Default with no list configured: `readonly`.** A forgotten variable
under-grants; it never over-grants.

Two things this model does not do, deliberately:

- **`article.review` + `article.publish` on one credential lets that agent
  approve its own drafts and publish them.** That is a real property, and it is
  the operator's decision. Split them across two credentials if a human should
  stand between drafting and publication.
- There is **no permission** for user management, role changes, global settings,
  secrets, audit deletion, hard deletion, or arbitrary queries. Those have no
  tool at all — a stronger guarantee than a permission someone could grant by
  mistake.

## Tools

Seventeen paths; fifteen tools plus health and capabilities. Full schemas live in
the OpenAPI document — this is the map.

### Read

| Tool | Permission | Notes |
|---|---|---|
| `search_articles` | `article.read` | Free text, `status`, `published`, category, tag, `sourceName`, `authorId`, `priority`, `trending`, `hasImage`, `publishedFrom`/`publishedTo`, `sortBy`. Max 50 per page. |
| `get_article` | `article.read` | By id **or slug**. Returns body, AI enrichment, engagement counts and any pending schedule. |
| `list_categories` | `taxonomy.read` | Slugs to use as `categorySlug`, with article counts. |

Reads are authenticated, authorised and rate-limited, but **not audited** — an
audit table that records every search stops being readable, and the question an
audit answers is what changed.

### Write

| Tool | Permission | Notes |
|---|---|---|
| `create_article` | `article.create` | **Always creates a DRAFT.** No parameter skips review. |
| `update_article` | `article.update` | Title, summary, content, category, tags, `priority`, read time. |
| `update_article_seo` | `seo.update` | Slug, title, summary. |
| `set_article_image` | `media.update` | Set a URL, or `clear: true`. |

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

The transition table, from `docs/memory/business-rules.md`:

```
DRAFT           → PENDING_REVIEW, REJECTED, ARCHIVED
PENDING_REVIEW  → APPROVED, REJECTED, DRAFT
APPROVED        → PUBLISHED, DRAFT, REJECTED, ARCHIVED
PUBLISHED       → APPROVED, ARCHIVED
REJECTED        → (terminal)
ARCHIVED        → (terminal)
```

**The publish gate is a business rule, not a permission.** An agent holding
`article.publish` still cannot publish a draft — it gets `ARTICLE_NOT_APPROVED`
with the current status and what to do about it.

### What no tool can write

Absent from every mutating schema, and the validator rejects unknown fields, so
this is structural rather than a filter someone has to remember:

`status` · `publishedAt` (except through publish/schedule) · `sourceUrl` ·
`sourceName` (immutable after creation) · `trending` · `rankingScore` ·
`importanceScore` · `authorId` · `reviewerId` · anything on `ArticleAI`

`trending`, `rankingScore` and `importanceScore` are computed by the ranking
cron from real signals. `business-rules.md` requires they stay derived, so
"remove old stories from the highlights" maps to `priority`, which is authored.

## Response envelope

Identical on every path — success, validation failure, auth failure, crash.

```json
{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "0f0c…",
    "timestamp": "2026-08-31T12:00:00.000Z",
    "apiVersion": "1.0",
    "tool": "update_article",
    "agentId": "abacus",
    "durationMs": 41,
    "auditRecorded": true
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "ARTICLE_NOT_APPROVED",
    "message": "An article must be APPROVED before publishing. This one is DRAFT. Use submit_article_for_review and approve_article first.",
    "details": { "currentStatus": "DRAFT" }
  },
  "meta": { "requestId": "0f0c…", "timestamp": "…", "apiVersion": "1.0" }
}
```

`requestId` is also returned as `X-Agent-Request-Id`, and appears in every audit
row and server log line for that call.

`GET /api/agent/openapi` is the one deliberate exception to the envelope: it
returns a bare OpenAPI document, because importers expect one at that URL.

### Error codes

Part of the contract — treat the strings as frozen.

| Code | HTTP | Meaning |
|---|---|---|
| `AGENT_API_DISABLED` | 503 | No credential configured on this deployment |
| `UNAUTHENTICATED` | 401 | No key presented |
| `INVALID_API_KEY` | 401 | Key not recognised |
| `FORBIDDEN` | 403 | Missing a permission; `details.missing` names it |
| `RATE_LIMITED` | 429 | Window exceeded; `Retry-After` set |
| `TOOL_NOT_FOUND` | 404 | Not in the registry; `details.availableTools` lists what is |
| `MALFORMED_JSON` | 400 | Body is not JSON |
| `METHOD_NOT_ALLOWED` | 405 | Tools are POST |
| `VALIDATION_FAILED` | 422 | `details.fields` lists field and reason |
| `ARTICLE_NOT_FOUND` | 404 | No such article |
| `CATEGORY_NOT_FOUND` | 404 | No such category slug |
| `DUPLICATE_SOURCE_URL` | 409 | That source URL already exists |
| `INVALID_STATUS_TRANSITION` | 409 | Illegal move; `details.allowed` lists legal ones |
| `ARTICLE_NOT_APPROVED` | 409 | Publish or schedule attempted before approval |
| `ARTICLE_NOT_SCHEDULED` | 409 | Nothing pending to cancel |
| `SCHEDULE_IN_THE_PAST` | 422 | `publishAt` is not in the future |
| `NO_FIELDS_TO_UPDATE` | 422 | Every supplied field already holds that value |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | Same key still running |
| `IDEMPOTENCY_PAYLOAD_MISMATCH` | 409 | Key reused with a different payload |
| `CONFIRMATION_REQUIRED` | 409 | A human must approve; token in `meta.confirmation` |
| `INTERNAL_ERROR` | 500 | Unexpected. Detail goes to the server log, never to the caller |

## Audit trail

Every write — successful, refused, or invalid — produces an `AdminAction` row.
The model already existed for this, and has no foreign key to `users`, so an
agent identity can own a row without pretending to be a person.

| Column | Value |
|---|---|
| `userId` | `agent:<id>`, e.g. `agent:abacus` |
| `action` | `ARTICLE_UPDATE`, `ARTICLE_PUBLISH`, `ARTICLE_SEO_UPDATE`, … |
| `resource` | `ARTICLE`, `ARTICLE_SCHEDULE`, `AGENT_IDEMPOTENCY` |
| `resourceId` | Article id |
| `createdAt` | Timestamp |
| `details` | `{ agentId, transport, tool, outcome, requestId, durationMs, input, changes, errorCode, errorMessage, idempotencyKey }` |

`transport` is `"http"` for an Agent API call and `"mcp"` for one that arrived
over `/api/mcp`.

```json
{
  "agentId": "abacus",
  "tool": "update_article",
  "outcome": "success",
  "requestId": "0f0c…",
  "durationMs": 41,
  "input": { "id": "cmg…", "title": "Orçamento aprovado" },
  "changes": {
    "title": { "before": "Orcamento aprovado", "after": "Orçamento aprovado" }
  },
  "errorCode": null,
  "errorMessage": null,
  "idempotencyKey": "retry-1"
}
```

Two rules the audit module enforces so no caller can get them wrong:

1. **Nothing sensitive is stored.** Every payload passes `redact()`, which
   replaces any key matching `pass|secret|token|api_key|authorization|credential|cookie|session`,
   truncates long strings at 2 000 characters, and bounds nesting depth.
   Exception messages are redacted too — they can carry a connection string.
2. **A failed audit write never fails the request.** The mutation already
   happened; throwing would report failure for completed work. The gap is
   surfaced as `meta.auditRecorded: false` instead of hidden.

Refused attempts are recorded on purpose: "this agent tried to publish a draft
nine times" is what an operator needs to be able to see afterwards. Rate-limited
calls are logged to the console but not to the database — a row per throttled
request would amplify the load being throttled.

## Idempotency

Send `Idempotency-Key: <opaque string>` on any mutating call.

| Situation | Result |
|---|---|
| First call | Executes; the response is stored under the key |
| Repeat, same payload | Stored response replayed, `meta.idempotentReplay: true` |
| Repeat, different payload | `IDEMPOTENCY_PAYLOAD_MISMATCH` |
| Repeat while the first is running | `IDEMPOTENCY_IN_PROGRESS` |
| First call failed | Key is released, so the same key can be retried |

The payload fingerprint is canonical (keys sorted at every level), so a model
regenerating the same call in a different key order is recognised as a repeat.

Most lifecycle tools are naturally idempotent without a key — publishing an
already-published article succeeds and reports `changed: []`. `create_article` is
the one that genuinely needs it.

## Human confirmation

Four tools require it. The classification lives in
`lib/agent/critical-actions.ts` and is attached to the tool declarations, so it
applies here and over MCP identically — a gate that were stricter on one
transport is a gate an agent can shop around.

| Tier | Tools | Confirmation | Audited |
|---|---|---|---|
| **read** | `search_articles`, `get_article`, `list_categories` | no | no |
| **write** | `create_article`, `update_article`, `update_article_seo`, `set_article_image`, `submit_article_for_review`, `reject_article`, `schedule_article`, `unschedule_article` | no | yes |
| **critical** | `approve_article`, `publish_article`, `unpublish_article`, `archive_article` | **yes** | yes |

What the critical four have in common is not that they are irreversible —
`unpublish` and `approve` are both walk-backable — but that their blast radius is
outside NotiLab. `reject_article` is terminal too and is deliberately **not**
critical: it removes a story that was never public, and gating it would train
agents to treat the confirmation step as noise.

The flow:

1. The API answers `409` / `CONFIRMATION_REQUIRED` with
   `meta.confirmation = { reason, summary, confirmationToken }`.
2. The agent shows `summary` to its operator.
3. On approval, the agent repeats the **identical** call with
   `confirmationToken` in the body.

```bash
# 1. Refused, and told how to proceed
curl -s -X POST $BASE/api/agent/tools/publish_article \
  -H "$AUTH" -H "$JSON" -d '{"id":"cmg…"}'
# → 409  meta.confirmation.confirmationToken = "9f3a…"

# 2. The same call, carrying the token
curl -s -X POST $BASE/api/agent/tools/publish_article \
  -H "$AUTH" -H "$JSON" -d '{"id":"cmg…","confirmationToken":"9f3a…"}'
```

The token is an HMAC of `(agentId, tool, canonical input)`, not a random nonce.
It is bound to the exact act approved: a token minted for `{id: A}` does not
authorise `{id: B}`, and a token minted for one agent identity does not work for
another. Both are tested.

**Be precise about what this buys.** The token proves payload integrity, not
that a human approved — an autonomous agent can read it out of the refusal and
repeat the call itself. What is gained is visibility (two audit rows, one with
`confirmation: {required: true, satisfied: false}` and one with
`satisfied: true`), and that a looping agent cannot publish on its first misfire.
A real approval queue with an identity attached is listed under Next steps; this
is the seam for it, not the thing itself.

**Set `NOTILAB_AGENT_CONFIRMATION_SECRET`.** With it unset the HMAC falls back to
a constant, which was harmless while no policy fired and is not any more.

An operator can exempt one credential with `skipCriticalConfirmation` on its
entry in `NOTILAB_AGENT_API_KEYS` (or `NOTILAB_MCP_CLIENTS_JSON`). Opt-out rather
than opt-in, so a credential configured by someone who never considered
confirmation gets the gate.

`confirmationToken` is the only reserved body key. It is stripped before
validation, so it never trips the unknown-field check. Over MCP the same token
travels in `_meta["notilab/confirmationToken"]` instead, because the advertised
input schemas set `additionalProperties: false` — see `docs/mcp.md`.

## Scheduling

NotiLab has no `scheduledFor` column and no `SCHEDULED` status. Adding one was
rejected: this project's local environment points at the **same Neon database as
production**, and its deploys do not run `prisma migrate deploy`, so a schema
change is a manual production operation dressed up as a code change — the
operator's call, not a side effect of adding an agent API.

A schedule is therefore stored as **intent**, append-only, in `AdminAction`:

```
resource   ARTICLE_SCHEDULE
resourceId <article id>
action     ARTICLE_SCHEDULE_SET | _CANCEL | _FULFILLED | _FAILED
details    { publishAt, agentId }
```

The newest row for an article is its current state. Rescheduling appends a new
`SET`; cancelling appends a `CANCEL`. The history of who moved a story and when
is readable, which a nullable column would not have given.

**What turns intent into publication:** `GET /api/cron/publish-scheduled`. It
exists and is tested, and it is **deliberately not registered in
`vercel.json`**. Every other cron in this project reads, enriches or sends; this
one puts stories on the public site with no human in the loop, which `AGENTS.md`
treats as the project's core risk. Until an operator enables it, a schedule is a
recorded intent that nothing acts on — and `schedule_article`'s own description
tells the agent so.

To enable (mind the Hobby plan's once-a-day frequency cap — see `DEPLOYMENT.md`):

```json
{ "path": "/api/cron/publish-scheduled", "schedule": "0 8 * * *" }
```

It publishes only APPROVED articles, applies the same review gate as any other
caller, closes out each schedule whether it succeeded or failed, and writes an
audit row attributed to `system:cron`.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NOTILAB_AGENT_API_KEY` | yes¹ | — | The agent's key. Min 32 chars. `openssl rand -hex 32` |
| `NOTILAB_AGENT_ID` | no | `default` | Identity in audit rows |
| `NOTILAB_AGENT_PERMISSIONS` | no | `readonly` | Comma list of permissions and/or presets |
| `NOTILAB_AGENT_API_KEYS` | yes¹ | — | JSON array, for more than one agent. Takes precedence |
| `NOTILAB_AGENT_RATE_LIMIT` | no | `120` | Requests per window, per agent |
| `NOTILAB_AGENT_RATE_WINDOW_MS` | no | `60000` | Window length |
| `NOTILAB_AGENT_CONFIRMATION_SECRET` | no | constant | HMAC key for confirmation tokens. Set before enabling a confirmation policy |
| `CRON_SECRET` | existing | — | Also guards `/api/cron/publish-scheduled` |

¹ One of the two. With neither, the API answers `AGENT_API_DISABLED`.

None of these are `NEXT_PUBLIC_*`, so none reach the browser bundle.

Single agent:

```bash
NOTILAB_AGENT_API_KEY=$(openssl rand -hex 32)
NOTILAB_AGENT_ID=abacus
NOTILAB_AGENT_PERMISSIONS=editorial
```

Several agents with different grants:

```bash
NOTILAB_AGENT_API_KEYS='[
  {"id":"abacus-editorial","key":"<64 hex chars>","permissions":"editorial"},
  {"id":"abacus-seo","key":"<64 hex chars>","permissions":["article.read","seo.update"]},
  {"id":"analytics","key":"<64 hex chars>","permissions":"readonly"}
]'
```

## Example calls

Discover what this credential can do:

```bash
curl -s -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  https://notilab.vercel.app/api/agent/capabilities
```

"Mostra as notícias ainda não publicadas."

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/search_articles \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"published": false, "sortBy": "updated", "limit": 20}'
```

"Encontra notícias sem imagem."

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/search_articles \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hasImage": false, "published": true, "limit": 50}'
```

"Edita o título desta notícia."

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/update_article \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "cmg…", "title": "Orçamento do Estado aprovado na generalidade"}'
```

"Muda esta notícia para a categoria Economia."

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/update_article \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "cmg…", "categorySlug": "economia"}'
```

"Retira do destaque notícias antigas." — `priority` is the authored prominence
field; `trending` is computed and read-only.

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/update_article \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "cmg…", "priority": "LOW"}'
```

"Actualiza o SEO desta notícia."

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/update_article_seo \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "cmg…", "slug": "orcamento-estado-2027", "summary": "O que muda no IRS e no IVA."}'
```

"Publica esta notícia agora." — the full path from a draft:

```bash
BASE=https://notilab.vercel.app/api/agent/tools
AUTH="Authorization: Bearer $NOTILAB_AGENT_API_KEY"
JSON="Content-Type: application/json"

curl -s -X POST $BASE/submit_article_for_review -H "$AUTH" -H "$JSON" -d '{"id":"cmg…"}'
curl -s -X POST $BASE/approve_article           -H "$AUTH" -H "$JSON" -d '{"id":"cmg…"}'
curl -s -X POST $BASE/publish_article           -H "$AUTH" -H "$JSON" -d '{"id":"cmg…"}'
```

"Agenda esta notícia para amanhã às 08h." — ISO-8601 only. State the offset when
the request is in local time; without one the value is read as UTC.

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/schedule_article \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id": "cmg…", "publishAt": "2026-09-01T08:00:00+01:00"}'
```

Creating an article safely under retry:

```bash
curl -s -X POST https://notilab.vercel.app/api/agent/tools/create_article \
  -H "Authorization: Bearer $NOTILAB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: brief-2026-08-31-01" \
  -d '{
        "title": "Título da peça",
        "content": "Corpo completo do artigo…",
        "categorySlug": "economia",
        "summary": "Resumo curto."
      }'
```

## Limitations

Honest list. None of these are hidden behind a workaround.

1. **No dedicated SEO columns.** NotiLab has no `seoTitle` / `seoDescription`,
   and no `generateMetadata` on the article page — so there is nothing dedicated
   to write to, and adding inert columns would have been worse than mapping the
   SEO vocabulary onto `slug`, `title` and `summary`, which is what a crawler
   actually reads today. The proper fix is two nullable columns plus a
   `generateMetadata`, and it is a separate, reviewable change:

   ```sql
   ALTER TABLE "news" ADD COLUMN "seoTitle" TEXT;
   ALTER TABLE "news" ADD COLUMN "seoDescription" TEXT;
   ```

2. **Scheduling is intent-only until the cron is enabled.** See § Scheduling.

3. **`GET /api/news` does not filter by `status`.** A pre-existing bug, not
   introduced here: that endpoint returns drafts and archived articles alongside
   published ones. So `unpublish_article` correctly removes an article from
   `/api/news/feed`, `/api/news/category/[slug]` and `/api/news/[id]`, but **not**
   from `/api/news`. Fixing it changes public behaviour and was left out of
   scope. Worth doing next.

4. **Rate limiting is per serverless instance.** The counter is in module memory,
   so the effective ceiling across a scaled deployment is `limit × instances`. It
   bounds a runaway agent loop within an instance, which is where a single
   agent's requests overwhelmingly land. A shared counter needs Redis.

5. **Idempotency has a millisecond-wide race.** `AdminAction` has no unique index
   on `resourceId`, so two genuinely simultaneous first-calls with the same key
   can both pass the lookup. Closing it means a dedicated model with `@@unique` —
   a schema change, deliberately not made here.

6. **REJECTED and ARCHIVED are terminal.** `business-rules.md` says so, and it
   outranks a task prompt, so the API cannot restore an archived article. An
   agent cannot undo its own archive; only an operator can. If reversibility
   matters more, that is a business-rules decision to make first.

7. **No bulk tools.** Every tool acts on one article. A 40-article operation is
   40 calls, which is also what keeps the audit trail per-article and makes the
   rate limit meaningful. Bulk tools are the first thing that should use the
   confirmation gate.

8. **`article.review` + `article.publish` on one credential is self-approval.**
   See § Permissions.

9. **Audit rows share a table with everything else.** `AdminAction` also carries
   schedule intents and idempotency claims. Filter on `resource` when reading.
   The cron's schedule scan reads at most 500 recent rows, which is a ceiling
   worth revisiting if that table grows large.

10. **No tests hit a real database.** Every test mocks Prisma. The pipeline,
    validation, permissions, transitions and audit shape are covered; actual SQL
    behaviour is not.

## Next steps to connect Abacus.ai

1. **Generate a key and grant the minimum.** Start with
   `NOTILAB_AGENT_PERMISSIONS=readonly` and confirm `capabilities` returns the
   three read tools. Widen only once the round trip works.
2. **Confirm liveness.** `GET /api/agent/health` should return
   `{"status":"ok","configured":true}`.
3. **Teach Abacus the tools.** Point it at `GET /api/agent/openapi` with the
   credential, or upload `pnpm agent:openapi` output. The document is generated
   from the registry, so it cannot drift from the code. Prefer the live endpoint:
   it is filtered to the credential's permissions, so Abacus is never shown a
   tool it cannot call.
4. **Decide the split.** One `editorial` credential, or two — a drafting agent
   with `article.review` and a separate publishing credential — so a human stands
   between drafting and the public site. This is the main security decision left.
5. **Instruct Abacus to call `list_categories` before any category change** and to
   call `get_article` before editing, so edits are based on current text.
6. **Decide on scheduling.** Enable `/api/cron/publish-scheduled` in
   `vercel.json`, or tell Abacus not to promise unattended publication.
7. **Watch the trail for a week.**
   ```sql
   SELECT "createdAt", "action", "resourceId", "details"->>'outcome', "details"->>'errorCode'
   FROM admin_actions
   WHERE "userId" LIKE 'agent:%'
   ORDER BY "createdAt" DESC
   LIMIT 100;
   ```
   Refused attempts are the interesting rows — they show where the agent's model
   of NotiLab disagrees with NotiLab.
8. **Then consider**, in rough order of value: fixing `/api/news`'s missing
   status filter; the SEO columns plus `generateMetadata`; a shared-store rate
   limiter; a dedicated idempotency model with `@@unique`; bulk tools behind the
   confirmation gate with a real approval queue.

## Source map

| Path | Role |
|---|---|
| `lib/agent/registry.ts` | The catalogue. Start here |
| `lib/agent/execute.ts` | The pipeline every call passes through, on either transport |
| `lib/agent/runner.ts` | HTTP adapter over that pipeline |
| `lib/agent/secret-compare.ts` | Timing-safe key comparison, shared with MCP |
| `lib/mcp/*` | The MCP transport. See `docs/mcp.md` |
| `lib/agent/types.ts` | What a tool is |
| `lib/agent/schema.ts` | Validation + JSON Schema generation |
| `lib/agent/auth.ts` | Key authentication, permission assertion |
| `lib/agent/permissions.ts` | Capability catalogue and presets |
| `lib/agent/audit.ts` | Audit writing and redaction |
| `lib/agent/idempotency.ts` | Key claim, replay, release |
| `lib/agent/confirmation.ts` | Human-confirmation seam |
| `lib/agent/rate-limit.ts` | Per-agent window |
| `lib/agent/openapi.ts` | Spec generation |
| `lib/agent/tools/*` | Tool declarations |
| `lib/editorial/article-service.ts` | Business layer: lifecycle, field whitelist |
| `lib/editorial/schedule-service.ts` | Deferred publication |
| `app/api/agent/**` | HTTP transport (thin) |
| `app/api/cron/publish-scheduled/route.ts` | Fulfils schedules (not enabled) |
