import type { Metadata } from "next"

import { NowFeed } from "@/components/now/now-feed"
import { NowNav } from "@/components/now/now-nav"
import { getStoryBrief } from "@/lib/story-service"
import { storyShareText } from "@/lib/story-view"

/**
 * `/now/[slug]` — the feed, entered at one specific story (spec § 28).
 *
 * The same feed as `/now`; the difference is that this URL is shareable, gets
 * its own OpenGraph card, and shows up as a distinct page in analytics and
 * search. `NowFeed` leads with the requested story, fetching it separately if
 * ranking did not put it on the first page.
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

  // Spec § 29: the share card leads with the headline and the consequence, not
  // a truncated body. "Why it matters" is the reason to open it.
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
    twitter: {
      card: story.media ? "summary_large_image" : "summary",
      title: story.headline,
      description,
    },
  }
}

export default async function NowStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-black md:pl-20">
      <NowFeed lane="for-you" initialSlug={slug} />
      <NowNav />
    </div>
  )
}
