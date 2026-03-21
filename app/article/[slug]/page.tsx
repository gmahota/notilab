import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function ArticleBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Look up article by slug
  const article = await prisma.news.findFirst({
    where: { slug },
    select: { id: true },
  })

  if (!article) {
    notFound()
  }

  // Redirect to the canonical news detail page
  redirect(`/news/${article.id}`)
}
