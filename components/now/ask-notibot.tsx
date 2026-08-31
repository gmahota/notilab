"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, trackStoryEvent } from "@/lib/utils"

/**
 * Contextual NotiBot (spec § 23).
 *
 * The story is identified by slug on every request, so `/api/chat` pins
 * retrieval to that story's own sources instead of guessing from keywords — the
 * user never has to say which story they mean. Answers come back grounded in
 * those sources, and the cited sources are shown, because § 12 makes provenance
 * a feature rather than a footnote.
 *
 * The suggested prompts are the spec's own list. They are questions the sources
 * can plausibly answer, which matters: a suggestion the corpus cannot support
 * just teaches the user that NotiBot says "I do not know".
 */

const SUGGESTIONS = [
  "Why does this matter?",
  "Explain it simply.",
  "What happened before this?",
  "Who benefits?",
  "Who could lose?",
  "What do critics say?",
  "What happens next?",
  "Compare the sources.",
] as const

interface ChatSource {
  id: string
  title: string
  sourceName: string
}

interface Turn {
  role: "user" | "bot"
  text: string
  sources?: ChatSource[]
  /** False when the answer is an honest "our coverage does not cover this". */
  grounded?: boolean
}

interface AskNotiBotProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storySlug: string | null
  storyHeadline: string
  side?: "right" | "bottom"
}

export function AskNotiBot({
  open,
  onOpenChange,
  storySlug,
  storyHeadline,
  side = "bottom",
}: AskNotiBotProps) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // A new story is a new conversation — carrying turns across stories would let
  // the previous story's answers read as context for this one.
  useEffect(() => {
    setTurns([])
    setDraft("")
  }, [storySlug])

  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || !storySlug || pending) return

      setDraft("")
      setPending(true)
      const history = turns.map((t) => ({ type: t.role === "user" ? "user" : "bot", content: t.text }))
      setTurns((prev) => [...prev, { role: "user", text: trimmed }])
      trackStoryEvent("story_ask_ai", storySlug, { question: trimmed.slice(0, 80) })

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, storyId: storySlug, history }),
        })

        if (!res.ok) throw new Error(`chat failed: ${res.status}`)
        const data = (await res.json()) as {
          message?: string
          sources?: ChatSource[]
          grounded?: boolean
        }

        setTurns((prev) => [
          ...prev,
          {
            role: "bot",
            text: data.message ?? "I could not compose an answer this time.",
            sources: data.sources ?? [],
            grounded: data.grounded ?? false,
          },
        ])
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            role: "bot",
            text: "I could not reach NotiBot just now. Check your connection and try again.",
            grounded: false,
          },
        ])
      } finally {
        setPending(false)
      }
    },
    [storySlug, pending, turns],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="flex max-h-[85svh] flex-col gap-0 p-0 md:max-h-none">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Ask NotiBot
          </SheetTitle>
          <p className="line-clamp-2 text-left text-sm text-muted-foreground">{storyHeadline}</p>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              NotiBot answers from this story&apos;s sources only. Pick a question or write your own.
            </p>
          )}

          {turns.map((turn, i) => (
            <div
              key={`${turn.role}-${i}`}
              className={cn(
                "max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                turn.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{turn.text}</p>

              {turn.role === "bot" && turn.sources && turn.sources.length > 0 && (
                <div className="mt-3 border-t border-border/60 pt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Answered from
                  </p>
                  <ul className="space-y-0.5">
                    {turn.sources.map((source) => (
                      <li key={source.id} className="text-xs text-muted-foreground">
                        {source.sourceName} — {source.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the sources…
            </div>
          )}

          <div ref={endRef} />
        </div>

        {turns.length === 0 && (
          <div className="shrink-0 border-t border-border px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => ask(suggestion)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            ask(draft)
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about this story…"
            aria-label="Ask about this story"
            disabled={pending}
          />
          <Button type="submit" size="icon" disabled={pending || draft.trim().length === 0}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>

        <p className="shrink-0 border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
          <ExternalLink className="mr-1 inline h-3 w-3" />
          Answers come from this story&apos;s sources. NotiBot marks anything it infers rather than
          reads.
        </p>
      </SheetContent>
    </Sheet>
  )
}
