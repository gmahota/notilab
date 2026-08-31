"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Bookmark, Share2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn, trackStoryEvent } from "@/lib/utils"
import { toParagraphs } from "@/lib/story-format"
import { storyShareText, type StoryBrief as StoryBriefData } from "@/lib/story-view"
import { AskNotiBot } from "./ask-notibot"
import { KeyFacts } from "./key-facts"
import { SourceList } from "./source-list"
import { StoryMetaLine, StoryStatusPill } from "./story-meta"
import { useSavedStories } from "./use-saved-stories"

/**
 * The 30-second Brief (spec § 10).
 *
 * Sections appear in the spec's order and each one disappears when we have
 * nothing real to put in it — an empty "What's next" heading would imply we
 * looked ahead and found nothing, rather than that no extraction pipeline has
 * run. `recency` is formatted by the server and passed in, so the label cannot
 * disagree across hydration.
 */

interface StoryBriefProps {
  brief: StoryBriefData
  recency: string
}

export function StoryBrief({ brief, recency }: StoryBriefProps) {
  const { isSaved, toggle } = useSavedStories()
  const [askOpen, setAskOpen] = useState(false)
  const saved = isSaved(brief.slug)

  const paragraphs = toParagraphs(brief.narrative)
  // The card-length summary already opens the page as the standfirst; repeating
  // it as the first paragraph of "What happened" reads as an editing mistake.
  const bodyParagraphs =
    paragraphs.length > 0 && paragraphs[0].trim() === brief.whatHappened.trim()
      ? paragraphs.slice(1)
      : paragraphs

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/now/${brief.slug}`
    const text = storyShareText(brief)

    if (navigator.share) {
      try {
        await navigator.share({ title: brief.headline, text, url })
        trackStoryEvent("story_share", brief.slug, { from: "brief", method: "native" })
      } catch {
        // Cancelled — not a share.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`)
      trackStoryEvent("story_share", brief.slug, { from: "brief", method: "clipboard" })
    } catch {
      // Clipboard unavailable.
    }
  }, [brief])

  const handleSave = useCallback(() => {
    if (toggle(brief.slug)) trackStoryEvent("story_save", brief.slug, { from: "brief" })
  }, [brief.slug, toggle])

  return (
    <article className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-4 md:px-8 md:pb-16">
      <Link
        href="/now"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to NOW
      </Link>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StoryStatusPill status={brief.status} />
      </div>

      <StoryMetaLine
        topic={brief.topic.name}
        location={brief.location}
        recency={recency}
        className="mb-3 text-muted-foreground"
      />

      <h1 className="mb-4 text-[30px] font-bold leading-[1.15] tracking-tight md:text-[40px]">
        {brief.headline}
      </h1>

      {/* One-sentence summary (spec § 10). */}
      <p className="mb-6 text-lg leading-relaxed text-foreground/85 md:text-xl">
        {brief.whatHappened}
      </p>

      {brief.media && (
        <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-xl">
          <Image
            src={brief.media.url}
            alt={brief.headline}
            fill
            priority
            unoptimized
            sizes="(min-width: 768px) 760px, 100vw"
            className="object-cover"
          />
          {brief.media.credit && (
            <span className="absolute bottom-1 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">
              {brief.media.credit}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
          {saved ? "Saved" : "Save"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setAskOpen(true)}>
          <Sparkles className="h-4 w-4" />
          Ask NotiBot
        </Button>
      </div>

      <div className="mt-8 space-y-8">
        {bodyParagraphs.length > 0 && (
          <Section title="What happened">
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90 md:text-base">
              {bodyParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Section>
        )}

        {brief.whyItMatters && (
          <Section title="Why it matters">
            <p className="rounded-xl border-l-2 border-primary/70 bg-primary/[0.06] py-3 pl-4 pr-3 text-[15px] leading-relaxed md:text-base">
              {brief.whyItMatters}
            </p>
          </Section>
        )}

        <KeyFacts facts={brief.keyFacts} />

        {brief.context && (
          <Section title="Context">
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90 md:text-base">
              {toParagraphs(brief.context).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Section>
        )}

        {brief.whatsNext && (
          <Section title="What's next">
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90 md:text-base">
              {toParagraphs(brief.whatsNext).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Section>
        )}

        <SourceList
          sources={brief.sources}
          sourceCount={brief.sourceCount}
          storySlug={brief.slug}
        />

        {brief.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {brief.topics.slice(0, 8).map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                #{topic}
              </span>
            ))}
          </div>
        )}
      </div>

      <AskNotiBot
        open={askOpen}
        onOpenChange={setAskOpen}
        storySlug={brief.slug}
        storyHeadline={brief.headline}
        side="bottom"
      />
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}
