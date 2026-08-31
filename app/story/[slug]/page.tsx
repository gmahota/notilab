import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { NowNav } from "@/components/now/now-nav"
import { StoryBrief } from "@/components/now/story-brief"
import { getStoryBrief } from "@/lib/story-service"
import { recencyLabel } from "@/lib/story-format"
import { storyShareText } from "@/lib/story-view"

/**
 * `/story/[slug]` — the 30-second Brief (spec § 9/§ 10).
 *
 * The spec's recommendation is to move conceptually from `/news` to `/story`,
 * because one story can hold several news sources. `/news/[id]` is left in place
 * and untouched: existing links, shares and the article-shaped surfaces still
 * point at it, and breaking them is not part of this change.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const story = await getStoryBrief(slug)

  if (!story) {
    return { title: "Story not found — NotiLab" }
  }

  const description = story.whyItMatters
    ? `Why it matters: ${story.whyItMatters}`
    : story.whatHappened

  return {
    title: `${story.headline} — NotiLab`,
    description,
    openGraph: {
      title: story.headline,
      description: `${storyShareText(story)}\n\nUnderstand it in 30 seconds — NotiLab`,
      type: "article",
      publishedTime: story.publishedAt,
      images: story.media ? [{ url: story.media.url }] : undefined,
    },
  }
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const brief = await getStoryBrief(slug)

  // No placeholder Brief: a story we do not hold is a 404, not an empty shell.
  if (!brief) notFound()

  return (
    <div className="min-h-dvh bg-background pb-20 md:pb-0 md:pl-20">
      {/* Formatted on the server and handed down, so the label cannot differ
          between the server render and hydration. */}
      <StoryBrief brief={brief} recency={recencyLabel(brief.publishedAt)} />
      <NowNav />
    </div>
  )
}
