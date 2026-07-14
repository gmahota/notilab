import type { Metadata } from "next"

import { ImmersiveNav } from "@/components/immersive/immersive-nav"
import { StoryFeed } from "@/components/immersive/story-feed"

export const metadata: Metadata = {
  title: "Agora — NotiLab",
  description: "O feed vertical e imersivo do NotiLab — uma história de cada vez.",
}

export default function NowPage() {
  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-black">
      <StoryFeed />
      <ImmersiveNav />
    </div>
  )
}
