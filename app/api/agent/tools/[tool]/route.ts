/**
 * POST /api/agent/tools/[tool]
 *
 * The one entry point for agent tool calls. Worth being precise about why it is
 * a dynamic segment and not fifteen hand-written route files, because at a
 * glance it can look like the generic `/execute` endpoint the design explicitly
 * rejects. It is not, and the difference is where the tool name comes from:
 *
 *   - The name is in the URL, not in the payload. A call names the capability
 *     it wants before any of its data is read.
 *   - `getTool` resolves only against the compile-time registry. An unknown
 *     name is a 404 and nothing else — it never becomes a path, a table name,
 *     or anything the database sees.
 *   - Each tool still has its own schema, its own permissions and its own audit
 *     action. Nothing is shared except the pipeline every call must pass through.
 *
 * What a generic executor would look like — a body carrying an instruction, or
 * a query, or a field list to apply — is exactly what the registry makes
 * impossible. Fifteen route files would give the same guarantees and fifteen
 * chances to forget one of the pipeline steps.
 *
 * The handler stays thin per AGENTS.md § Next.js Rules: it unwraps the route
 * parameter and hands off. All logic lives in lib/agent/runner.ts.
 */

import type { NextRequest } from "next/server"
import { methodNotAllowed, runTool } from "@/lib/agent/runner"

/** Never cached, never statically analysed — every call is authenticated. */
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tool: string }> },
): Promise<Response> {
  const { tool } = await context.params
  return runTool(tool, request)
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ tool: string }> },
): Promise<Response> {
  // Answered explicitly rather than left to Next's default 405, so an agent
  // that guessed the verb gets the same envelope it gets everywhere else.
  const { tool } = await context.params
  return methodNotAllowed(tool)
}
