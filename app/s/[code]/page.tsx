/**
 * app/s/[code]/page.tsx
 *
 * WhatsApp viral loop landing page.
 *
 * Mobile-first entry point for users who tapped a shared link.
 * Shows: article summary → Explain button → Full article CTA → Ask NotiBot CTA.
 * Records a visit on server render via the visit API.
 * Conversion tracking (NotiBot / article open) fires from client component.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getLandingData } from "@/lib/growth/referral"
import { ShareLandingClient } from "./client"

interface PageProps {
  params: Promise<{ code: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const data = await getLandingData(code)
  if (!data) return { title: "NotiLab" }

  const ai = data.article.articleAI
  const description = ai?.shareText ?? ai?.tldr ?? data.article.summary ?? ""

  return {
    title: data.article.title,
    description,
    openGraph: {
      title: data.article.title,
      description,
      images: data.article.imageUrl ? [data.article.imageUrl] : [],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: data.article.title,
      description,
      images: data.article.imageUrl ? [data.article.imageUrl] : [],
    },
  }
}

export default async function ShareLandingPage({ params }: PageProps) {
  const { code } = await params
  const data = await getLandingData(code)

  if (!data) notFound()

  const { article, share } = data
  const ai = article.articleAI

  const snippet = share.snippet ?? ai?.shareText ?? ai?.tldr ?? article.summary ?? ""
  const whyItMatters = ai?.whyItMatters ?? ""
  const explain = ai?.explainLikeIm10 ?? ""

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://notilab.app"
  const articleUrl = article.slug
    ? `${BASE_URL}/article/${article.slug}`
    : `${BASE_URL}/news/${article.id}`

  const chatUrl = `${BASE_URL}/chat?ref=${code}&article=${article.id}`
  const explainUrl = `${BASE_URL}/explain/${article.id}?ref=${code}`

  return (
    <ShareLandingClient
      shareId={share.id}
      code={code}
      article={{
        id: article.id,
        title: article.title,
        sourceName: article.sourceName,
        publishedAt: article.publishedAt.toISOString(),
        categoryName: article.category?.name ?? null,
        categoryColor: article.category?.color ?? "#007BFF",
        imageUrl: article.imageUrl ?? null,
      }}
      snippet={snippet}
      whyItMatters={whyItMatters}
      explain={explain}
      articleUrl={articleUrl}
      chatUrl={chatUrl}
      explainUrl={explainUrl}
    />
  )
}
