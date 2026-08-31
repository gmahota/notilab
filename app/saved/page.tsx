import type { Metadata } from "next"

import { NowNav } from "@/components/now/now-nav"
import { SavedStories } from "@/components/now/saved-stories"

export const metadata: Metadata = {
  title: "Saved — NotiLab",
  description: "Stories you saved to come back to.",
}

/** `/saved` — the SAVED tab of the NOW navigation (spec § 7). */
export default function SavedPage() {
  return (
    <div className="min-h-dvh bg-background pb-20 md:pb-0 md:pl-20">
      <main className="mx-auto w-full max-w-[760px] px-5 pt-6 md:px-8">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Saved</h1>
        <p className="mb-4 text-sm text-muted-foreground">Stories you kept to come back to.</p>
        <SavedStories />
      </main>
      <NowNav />
    </div>
  )
}
