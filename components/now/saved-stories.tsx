"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Bookmark, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { recencyLabel, sourceLine } from "@/lib/story-format"
import type { NowStory } from "@/lib/story-view"
import { useSavedStories } from "./use-saved-stories"

/**
 * The SAVED tab (spec § 7).
 *
 * The list of what is saved lives on the device (see `use-saved-stories.ts`);
 * the server is only asked to turn those slugs back into cards. A saved story
 * that has since been unpublished simply does not come back — it is dropped
 * from the list rather than shown as a broken row.
 */
export function SavedStories() {
  const { saved, remove, ready } = useSavedStories()
  const [stories, setStories] = useState<NowStory[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ready) return

    if (saved.length === 0) {
      setStories([])
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/stories?slugs=${saved.map(encodeURIComponent).join(",")}`)
      .then((res) => (res.ok ? res.json() : { stories: [] }))
      .then((data: { stories?: NowStory[] }) => {
        if (!cancelled) setStories(data.stories ?? [])
      })
      .catch(() => {
        if (!cancelled) setStories([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [saved, ready])

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your saved stories…
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Bookmark className="h-7 w-7 text-muted-foreground" />
        <p className="font-semibold">Nothing saved yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Save a story from the feed and it shows up here. Saves stay on this device — there is no
          sign-in yet, so they will not follow you to another browser.
        </p>
        <Button asChild variant="outline" className="mt-1">
          <Link href="/now">Go to NOW</Link>
        </Button>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {stories.map((story) => (
        <li key={story.id} className="flex items-start gap-3 py-4">
          <Link
            href={`/story/${story.slug}`}
            className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted"
          >
            {story.media && (
              <Image
                src={story.media.url}
                alt=""
                fill
                unoptimized
                sizes="96px"
                className="object-cover"
              />
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link href={`/story/${story.slug}`} className="block">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {[story.topic.name, story.location, recencyLabel(story.publishedAt)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{story.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {sourceLine(story.sourceNames, story.sourceCount)}
              </p>
            </Link>
          </div>

          <button
            type="button"
            // The stored key is usually the slug, but migrated V1 saves hold an
            // article id — remove whichever one is actually in the list.
            onClick={() => remove(saved.find((k) => k === story.slug || k === story.id) ?? story.slug)}
            aria-label={`Remove ${story.headline} from saved`}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
