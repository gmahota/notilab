import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function healthCheck() {
  console.log("🔍 Checking NotiLab system health...\n")

  try {
    // Check database connection
    console.log("📊 Testing database connection...")
    await prisma.$connect()
    console.log("✅ Database connected")

    // Check core tables (User, News, Category)
    const userCount = await prisma.user.count()
    const newsCount = await prisma.news.count()
    const categoryCount = await prisma.category.count()

    console.log(`📈 Database statistics:`)
    console.log(`   - Users: ${userCount}`)
    console.log(`   - News: ${newsCount}`)
    console.log(`   - Categories: ${categoryCount}`)

    // Check essential environment variables
    console.log("\n🔧 Checking configuration...")
    const requiredEnvs = ["DATABASE_URL"]
    const missingEnvs = requiredEnvs.filter((env) => !process.env[env])

    if (missingEnvs.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingEnvs.join(", ")}`)
    } else {
      console.log("✅ Basic configuration OK")
    }

    // Check optional integrations
    console.log("\n🔌 Optional integrations:")
    const optionalEnvs = ["OPENAI_API_KEY", "GROQ_API_KEY", "WHATSAPP_TOKEN", "TELEGRAM_BOT_TOKEN"]

    optionalEnvs.forEach((env) => {
      const status = process.env[env] ? "✅" : "⚪"
      console.log(`   ${status} ${env}`)
    })

    console.log("\n🎉 NotiLab system running correctly!")
  } catch (error) {
    console.error("❌ Error during health check:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

healthCheck()
