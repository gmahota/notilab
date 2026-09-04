import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

export async function checkAdminAuth(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("admin-token")?.value

    if (!token) return null

    const decoded = jwt.verify(token, JWT_SECRET) as any

    // Check whether the user has administrative permissions
    const adminRoles = ["REDATOR", "REVISOR", "SUPERVISOR", "MARKETING", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"]

    if (!adminRoles.includes(decoded.role)) {
      return null
    }

    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    }
  } catch (error) {
    return null
  }
}

export function generateAdminToken(user: AdminUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "8h" })
}
