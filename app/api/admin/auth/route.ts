import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { generateAdminToken } from "@/lib/admin-auth"

// Mock admin users - em produção, buscar do banco de dados
const adminUsers = [
  {
    id: "1",
    email: "admin@notilab.com",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
  },
  {
    id: "2",
    email: "redator@notilab.com",
    name: "João Redator",
    role: "REDATOR",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
  },
  {
    id: "3",
    email: "revisor@notilab.com",
    name: "Maria Revisora",
    role: "REVISOR",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
  },
]

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const user = adminUsers.find((u) => u.email === email)
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 })
    }

    const token = generateAdminToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const cookieStore = cookies()
    cookieStore.set("admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 horas
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
