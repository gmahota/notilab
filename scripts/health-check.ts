import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function healthCheck() {
  console.log("🔍 Verificando saúde do sistema NotiLab...\n")

  try {
    // Verificar conexão com banco
    console.log("📊 Testando conexão com banco de dados...")
    await prisma.$connect()
    console.log("✅ Banco de dados conectado")

    // Verificar tabelas principais
    const userCount = await prisma.user.count()
    const newsCount = await prisma.news.count()
    const categoryCount = await prisma.category.count()

    console.log(`📈 Estatísticas do banco:`)
    console.log(`   - Utilizadores: ${userCount}`)
    console.log(`   - Notícias: ${newsCount}`)
    console.log(`   - Categorias: ${categoryCount}`)

    // Verificar variáveis de ambiente essenciais
    console.log("\n🔧 Verificando configuração...")
    const requiredEnvs = ["DATABASE_URL"]
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env])

    if (missingEnvs.length > 0) {
      console.log(`⚠️  Variáveis de ambiente em falta: ${missingEnvs.join(", ")}`)
    } else {
      console.log("✅ Configuração básica OK")
    }

    // Verificar integrações opcionais
    console.log("\n🔌 Integrações opcionais:")
    const optionalEnvs = ["OPENAI_API_KEY", "GROQ_API_KEY", "WHATSAPP_TOKEN", "TELEGRAM_BOT_TOKEN"]

    optionalEnvs.forEach((env) => {
      const status = process.env[env] ? "✅" : "⚪"
      console.log(`   ${status} ${env}`)
    })

    console.log("\n🎉 Sistema NotiLab funcionando corretamente!")
  } catch (error) {
    console.error("❌ Erro na verificação:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

healthCheck()
