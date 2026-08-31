import type { Metadata } from "next"

import { NowFeed } from "@/components/now/now-feed"
import { NowNav } from "@/components/now/now-nav"
import { isFeedLane, type FeedLane } from "@/lib/story-view"

export const metadata: Metadata = {
  title: "NOW — NotiLab",
  description: "Understand the world in 30 seconds. One story at a time.",
}

/**
 * `/now` — the NOW V2 vertical feed (spec § 3).
 *
 * `?lane=world` selects a lane on a cold load; while browsing, the feed swaps
 * lanes client-side. Once a story is on screen the URL becomes `/now/[slug]`
 * (§ 28), which is why the deep-linked variant lives in `[slug]/page.tsx`.
 */
export default async function NowPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>
}) {
  const { lane } = await searchParams
  const initialLane: FeedLane = isFeedLane(lane) ? lane : "for-you"

  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-black md:pl-20">
      <NowFeed lane={initialLane} />
      <NowNav />
    </div>
  )
}
