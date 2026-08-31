"use client"

import Image from "next/image"
import { ArrowRight, Bookmark, MoreHorizontal, Share2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { recencyLabel, sourceLine } from "@/lib/story-format"
import type { NowStory } from "@/lib/story-view"
import { BreakingPill, StoryMetaLine, StoryStatusPill } from "./story-meta"

/**
 * One full-viewport card in the vertical feed (spec § 3/§ 4).
 *
 * Media sits above the text rather than behind it. The spec's layout draws them
 * as separate blocks, and it is also the readable choice: "Why it matters" is
 * the highest-value text on the card and it cannot compete with a photo.
 *
 * Nothing beyond the § 4 list appears here. No read counts, no reaction counts,
 * no public likes — § 5 is explicit that NotiLab is information, not a social
 * scoreboard.
 */

interface StorySlideProps {
  story: NowStory
  /** True for the card the user is on — drives image priority and aria state. */
  active: boolean
  /** True for the card and its two neighbours, so swiping feels instant (§ 30). */
  preload: boolean
  saved: boolean
  onOpenBrief: () => void
  onAsk: () => void
  onToggleSave: () => void
  onShare: () => void
  onOpenSource: () => void
}

export function StorySlide({
  story,
  active,
  preload,
  saved,
  onOpenBrief,
  onAsk,
  onToggleSave,
  onShare,
  onOpenSource,
}: StorySlideProps) {
  const sources = sourceLine(story.sourceNames, story.sourceCount)

  return (
    // `relative` on the article matters: the action rail is absolutely
    // positioned, and without a positioning context here every slide's rail
    // anchors to the feed container and they all stack on the same spot.
    <article
      aria-hidden={!active}
      className="relative flex h-full w-full flex-col overflow-hidden bg-black text-white"
    >
      {/* Media (spec § 25) */}
      <div className="relative h-[38svh] w-full shrink-0 md:h-[42svh]">
        {story.media ? (
          <Image
            src={story.media.url}
            alt={story.headline}
            fill
            priority={preload}
            loading={preload ? undefined : "lazy"}
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          /* No related image. A branded panel, not a stock photo — § 25 warns
             that a generic image can misrepresent what happened. */
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${story.topic.color}33, #000000)`,
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              {story.topic.name || "NotiLab"}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />

        <div className="absolute left-4 top-16 flex flex-wrap items-center gap-2 md:left-8 md:top-20">
          {story.breaking && <BreakingPill />}
          <StoryStatusPill status={story.status} />
        </div>

        {story.media?.credit && (
          <span className="absolute bottom-1 right-3 text-[10px] text-white/40">
            {story.media.credit}
          </span>
        )}
      </div>

      {/* Content — capped width on desktop so it stays readable (§ 26) */}
      {/* Right padding reserves the action rail's column so the headline and
          body never run underneath it — the rail is an overlay, and the text
          has to be laid out around it rather than behind it. */}
      <div className="relative flex min-h-0 flex-1 flex-col pb-24 pl-5 pr-[76px] pt-4 md:mx-auto md:w-full md:max-w-[820px] md:pb-16 md:pl-8 md:pr-24">
        <StoryMetaLine
          topic={story.topic.name}
          location={story.location}
          recency={recencyLabel(story.publishedAt)}
          className="mb-3 text-white/55"
        />

        <h2 className="mb-3 text-[26px] font-bold leading-[1.15] tracking-tight md:text-4xl">
          {story.headline}
        </h2>

        <p className="mb-4 text-[15px] leading-relaxed text-white/80 md:text-lg">
          {story.whatHappened}
        </p>

        {/* Spec § 4: one of the most important parts of the product. Omitted
            outright when we have not generated it — never filled with the
            headline restated. */}
        {story.whyItMatters && (
          <div className="mb-4 rounded-xl border-l-2 border-primary/70 bg-white/[0.04] py-3 pl-4 pr-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              Why it matters
            </p>
            <p className="text-[15px] leading-relaxed text-white/85">{story.whyItMatters}</p>
          </div>
        )}

        <div className="mt-auto space-y-4">
          {sources && (
            <p className="text-xs text-white/50">
              {sources}
              {story.wasUpdated && (
                <span className="ml-2 text-white/40">
                  · Updated {recencyLabel(story.updatedAt)} ago
                </span>
              )}
            </p>
          )}

          <Button onClick={onOpenBrief} className="glow-blue-sm h-11 gap-2 px-5 text-sm font-semibold">
            Understand in 30 sec
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action rail (spec § 5) */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-3 md:bottom-20 md:right-6">
        <RailButton
          label={saved ? "Remove from saved" : "Save"}
          caption="Save"
          pressed={saved}
          onClick={onToggleSave}
        >
          <Bookmark className={cn("h-5 w-5", saved && "fill-current")} />
        </RailButton>

        <RailButton label="Share" caption="Share" onClick={onShare}>
          <Share2 className="h-5 w-5" />
        </RailButton>

        <RailButton label="Ask NotiBot about this story" caption="Ask" onClick={onAsk}>
          <Sparkles className="h-5 w-5" />
        </RailButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More options"
              className="glass flex h-11 w-11 items-center justify-center rounded-full text-white"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="left">
            <DropdownMenuItem onClick={onOpenBrief}>Open the Brief</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSource}>Open original source</DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>Copy link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

interface RailButtonProps {
  label: string
  caption: string
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}

function RailButton({ label, caption, pressed, onClick, children }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="flex flex-col items-center gap-1 text-white"
    >
      <span
        className={cn(
          "glass flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          pressed && "border-primary/50 text-primary",
        )}
      >
        {children}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wide text-white/60">
        {caption}
      </span>
    </button>
  )
}
