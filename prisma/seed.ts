import { PrismaClient, Priority } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...")

  // Criar categorias
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "politica" },
      update: {},
      create: {
        name: "Política",
        slug: "politica",
        description: "Notícias sobre política nacional e internacional",
        color: "#007BFF",
      },
    }),
    prisma.category.upsert({
      where: { slug: "desporto" },
      update: {},
      create: {
        name: "Desporto",
        slug: "desporto",
        description: "Notícias desportivas e resultados",
        color: "#39FF14",
      },
    }),
    prisma.category.upsert({
      where: { slug: "cultura" },
      update: {},
      create: {
        name: "Cultura",
        slug: "cultura",
        description: "Arte, música, cinema e eventos culturais",
        color: "#FF6B35",
      },
    }),
    prisma.category.upsert({
      where: { slug: "economia" },
      update: {},
      create: {
        name: "Economia",
        slug: "economia",
        description: "Mercados financeiros e economia",
        color: "#FFD23F",
      },
    }),
    prisma.category.upsert({
      where: { slug: "leis" },
      update: {},
      create: {
        name: "Leis",
        slug: "leis",
        description: "Legislação e mudanças jurídicas",
        color: "#9B59B6",
      },
    }),
  ])

  // Criar usuário demo
  await prisma.user.upsert({
    where: { email: "demo@notilab.com" },
    update: {},
    create: {
      email: "demo@notilab.com",
      name: "Utilizador Demo",
      points: 150,
      level: "2",
      preferences: {
        create: {
          categories: ["politica", "desporto"],
        },
      },
    },
  })

  // Criar notícias de exemplo
  const sampleNews = [
    {
      title: "Nova Lei de IA Aprovada no Parlamento Europeu",
      slug: "nova-lei-ia-parlamento-europeu",
      content:
        "O Parlamento Europeu aprovou hoje uma nova legislação sobre inteligência artificial que estabelece regras claras para o desenvolvimento e uso de sistemas de IA na União Europeia.",
      summary: "UE aprova primeira lei abrangente sobre IA, estabelecendo regras para desenvolvimento responsável.",
      categoryId: categories.find((c) => c.slug === "leis")?.id!,
      priority: Priority.HIGH,
      imageUrl: "/european-parliament-ai-law.png",
      views: 1250,
      isBreaking: true,
      sourceUrl: "https://example.com/news1",
      sourceName: "Notilab",
      publishedAt: new Date(),
    },
    {
      title: "Benfica Vence Clássico por 3-1",
      slug: "benfica-vence-classico-3-1",
      content:
        "O Sport Lisboa e Benfica derrotou o rival por 3-1 num jogo emocionante que mantém a equipa na liderança do campeonato.",
      summary: "Benfica mantém liderança com vitória convincente no clássico.",
      categoryId: categories.find((c) => c.slug === "desporto")?.id!,
      priority: Priority.NORMAL,
      imageUrl: "/benfica-football-stadium-celebration.png",
      views: 890,
      sourceUrl: "https://example.com/news2",
      sourceName: "Notilab",
      publishedAt: new Date(),
    },
    {
      title: "Mercados Sobem com Otimismo Económico",
      slug: "mercados-sobem-otimismo-economico",
      content:
        "As bolsas europeias registaram ganhos significativos hoje, impulsionadas por dados económicos positivos e expectativas de crescimento.",
      summary: "Bolsas europeias em alta com dados económicos positivos.",
      categoryId: categories.find((c) => c.slug === "economia")?.id!,
      priority: Priority.NORMAL,
      imageUrl: "/stock-market-optimism.png",
      views: 650,
      sourceUrl: "https://example.com/news3",
      sourceName: "Notilab",
      publishedAt: new Date(),
    },
  ];

  // Inserir notícias de exemplo
  for (const newsData of sampleNews) {
    await prisma.news.upsert({
      where: { id: newsData.slug }, // Use the correct unique field, e.g., 'id'
      update: {},
      create: { ...newsData, id: newsData.slug }, // Ensure 'id' is set if needed
    });
  }

  // Criar trending topics
  // await prisma.trendingTopic.upsert({
  //   where: { id: "lei-da-ia" }, // Use the correct unique field, e.g., id or slug
  //   update: {},
  //   create: {
  //     id: "lei-da-ia",
  //     topic: "Lei da IA",
  //     count: 1250,
  //     category: "Leis",
  //   },
  // })

  // await prisma.trendingTopic.upsert({
  //   where: { id: "classico-benfica" }, // Use the correct unique field, e.g., id or slug
  //   update: {},
  //   create: {
  //     id: "classico-benfica",
  //     name: "Clássico Benfica",
  //     count: 890,
  //     category: "Desporto",
  //   },
  // })
  // await prisma.trendingTopic.upsert({
  //   where: { topic: "Clássico Benfica" },
  //   update: {},
  //   create: {
  //     topic: "Clássico Benfica",
  //     count: 890,
  //     category: "Desporto",
  //   },
  // })

  console.log("✅ Seed concluído com sucesso!")
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
