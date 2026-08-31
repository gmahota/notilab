/**
 * scripts/agent/dump-openapi.ts — Writes the Agent API's OpenAPI document to a file.
 *
 *   pnpm agent:openapi              -> docs/agent-api.openapi.json
 *   pnpm agent:openapi ./spec.json  -> a path of your choosing
 *
 * The living document is served from GET /api/agent/openapi, generated from the
 * tool registry on every request; that is the one an integration should import,
 * because it can never be stale. This script exists for the cases where a file
 * is required instead — an agent platform that wants an upload, or a review that
 * wants the spec in a diff.
 *
 * The output is gitignored on purpose. A checked-in spec goes stale the moment
 * a tool changes, and a stale spec is worse than no file at all: an agent that
 * imported it sends requests that cannot succeed. Generate it when you need it.
 *
 * The output is the full document, not one narrowed to a credential's
 * permissions. Treat it as the catalogue of everything the API can do, and the
 * live endpoint as the answer to what a particular agent may do.
 */

import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildOpenApiDocument } from "../../lib/agent/openapi"

const target = resolve(process.argv[2] ?? "docs/agent-api.openapi.json")

writeFileSync(target, JSON.stringify(buildOpenApiDocument(), null, 2) + "\n", "utf8")
console.log(`Wrote ${target}`)
