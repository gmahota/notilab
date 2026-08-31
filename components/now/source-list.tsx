"use client"

import { ExternalLink } from "lucide-react"

import { absoluteDate, basedOnLine } from "@/lib/story-format"
import { trackStoryEvent } from "@/lib/utils"
import type { StorySourceKind, StorySourceView } from "@/lib/story-view"

/**
 * Spec § 12 — sources are a feature, not a footnote.
 *
 * Every source is openable, and the section says plainly what NotiLab is doing:
 * explaining an event *from* these sources, not replacing them. The type label
 * matters too — a government statement and a wire report are both "sources" but
 * they are not the same kind of evidence.
 */

const KIND_LABEL: Record<StorySourceKind, string> = {
  news: "News",
  official: "Official",
  document: "Document",
  social: "Social",
}

interface SourceListProps {
  sources: StorySourceView[]
  sourceCount: number
  /** For attributing `story_source_open`. */
  storySlug: string
}

export function SourceList({ sources, sourceCount, storySlug }: SourceListProps) {
  if (sources.length === 0) return null

  return (
    <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-6">
      <h2
        id="sources-heading"
        className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
      >
        Sources
      </h2>
      <p className="mb-3 text-sm font-medium">{basedOnLine(sourceCount)}</p>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackStoryEvent("story_source_open", storySlug, {
                  publisher: source.publisher,
                  sourceType: source.sourceType,
                })
              }
              className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{source.publisher}</span>
                  {source.sourceType !== "news" && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {KIND_LABEL[source.sourceType]}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {absoluteDate(source.publishedAt)}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{source.headline}</span>
              </span>
              <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                Open original
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        NotiLab explains this event based on these sources. It does not replace them.
      </p>
    </section>
  )
}
