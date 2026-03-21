import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function ArticleBySlugPage({ params }: { params: { slug: string } }) {
  const { slug } = params

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
