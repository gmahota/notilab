/**
 * POST /api/admin/auth — staff login.
 *
 * Thin by design (AGENTS.md § Next.js Rules): parse the body, ask
 * lib/admin/staff-auth.ts, set the cookie, map the result. The credential check
 * itself lives in lib/ and is unit-tested there.
 *
 * What used to be here was a three-entry array of accounts sharing the
 * published bcrypt test vector for the password `password`, live in production.
 * See lib/admin/staff-auth.ts. (ROADMAP #39.)
 */

import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { generateAdminToken, MissingSigningSecretError } from "@/lib/admin-auth"
import { authenticateStaff } from "@/lib/admin/staff-auth"

/**
 * One message for every rejection.
 *
 * The previous code answered "Usuário não encontrado" or "Senha incorreta",
 * which let anyone test whether an address has an account here. Unknown
 * address, wrong password, deactivated account and reader-without-admin-rights
 * are now indistinguishable to the caller: same status, same body.
 */
const GENERIC_FAILURE = "Credenciais inválidas"

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 })
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown }

  try {
    const result = await authenticateStaff(email, password)

    if (!result.ok) {
      // The reason is logged, the address is not: an email is personal data
      // (AGENTS.md § Security First) and the log is not the place for it.
      console.warn(`[admin/auth] login rejected (${result.reason})`)
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 })
    }

    // Issued only after the credentials check, so an anonymous caller cannot
    // probe a misconfigured deployment by watching for a 503.
    const token = generateAdminToken(result.user)

    const cookieStore = await cookies()
    cookieStore.set("admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours
    })

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    })
  } catch (error) {
    if (error instanceof MissingSigningSecretError) {
      // Correct credentials, no way to sign a session. This is an operator
      // problem and the log has to say so plainly — the message names
      // JWT_SECRET and the fix, and contains no secret value.
      console.error(`[admin/auth] ${error.message}`)
      return NextResponse.json(
        { error: "Serviço de autenticação indisponível. Contacte o administrador do sistema." },
        { status: 503 },
      )
    }

    console.error("[admin/auth] unexpected failure", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
