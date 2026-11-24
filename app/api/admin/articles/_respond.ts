/**
 * Shared plumbing for the admin article routes.
 *
 * The routes under `app/api/admin/articles/**` are deliberately thin — they
 * authenticate, parse, call `lib/editorial/`, and translate errors. Every
 * editorial rule lives in the service layer so that the Agent API, the cron
 * and the CMS cannot drift into three different answers to the same question.
 *
 * Leading underscore so Next.js does not route this file.
 */

import { NextResponse } from "next/server"
import { httpStatusForCode, isAgentError } from "@/lib/agent/errors"
import { checkAdminAuth, type AdminUser } from "@/lib/admin-auth"
import type { TransitionActor } from "@/lib/editorial/article-service"

/**
 * Resolves the signed-in admin, or the 401 to return instead.
 *
 * No role list is passed: *reaching* the CMS is open to every administrative
 * role, and what each may do to an article is decided per transition in
 * `lib/editorial/permissions.ts`. Gating the whole surface by role here would
 * hide the queue from a REDATOR who legitimately needs to see their own drafts.
 */
export async function requireAdmin(): Promise<
  { user: AdminUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await checkAdminAuth()
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { user, error: null }
}

export function actorFrom(user: AdminUser): TransitionActor {
  return { id: user.id, name: user.name, role: user.role }
}

/**
 * Turns a thrown error into a response.
 *
 * An `AgentError` is a decision the service layer made on purpose — its code
 * and its Portuguese message are both meant for the editor reading the screen,
 * so they are passed through. Anything else is logged and flattened to a 500
 * with no detail: an unplanned exception may carry a query fragment or a
 * connection string, and the CMS is not where that should surface.
 */
export function respondToError(scope: string, err: unknown): NextResponse {
  if (isAgentError(err)) {
    return NextResponse.json(
      { error: err.message, code: err.code, details: err.details ?? null },
      { status: httpStatusForCode(err.code) },
    )
  }

  console.error(`[${scope}]`, err)
  return NextResponse.json(
    { error: "Erro interno. A acção não foi aplicada.", code: "INTERNAL_ERROR" },
    { status: 500 },
  )
}

/** Parses a JSON body, or returns the 400 to send instead. */
export async function readJson(
  request: Request,
): Promise<{ body: Record<string, unknown>; error: null } | { body: null; error: NextResponse }> {
  try {
    const parsed = await request.json()
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object")
    }
    return { body: parsed as Record<string, unknown>, error: null }
  } catch {
    return {
      body: null,
      error: NextResponse.json(
        { error: "Corpo do pedido inválido.", code: "MALFORMED_JSON" },
        { status: 400 },
      ),
    }
  }
}
