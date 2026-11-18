"use client"

/**
 * The newsroom board — one column per `WorkflowStage`.
 *
 * Previously five hard-coded columns of invented articles with a
 * `getCategoryColor` map that guessed hex codes from Portuguese category names.
 * Phase 4(iii): the columns are now the real stages, the cards are real
 * articles, and the colours come from the category rows themselves.
 *
 * Cards open the review screen rather than a drag target. Dragging a card
 * between columns would be a status change made by a gesture, with no note, no
 * confirmation and no sight of the source text — which is exactly the kind of
 * frictionless approval the gate exists to prevent. The move happens in the
 * review screen, where the source sits next to the rewrite.
 */

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ReviewPanel } from "@/components/editorial/review-panel"
import { STAGE_LABELS, QUEUE_LABELS } from "@/lib/editorial/labels"
import type { WorkflowStage } from "@/lib/generated/prisma"
import { AlertTriangle, ImageOff, Loader2, User } from "lucide-react"

interface WorkflowKanbanProps {
  user: { id: string; name: string; role: string }
  filters: {
    assignee: string
    status: string
  }
}

interface BoardItem {
  id: string
  sourceTitle: string
  rewrittenTitle: string | null
  status: string
  stage: string | null
  rewriteState: "none" | "pending" | "failed" | "ready"
  sourceName: string
  imagePublishable: boolean
  category: { name: string; color: string } | null
  author: { name: string } | null
  priority: string
  importanceScore: number
}

/**
 * The board's columns, in the order work moves through them.
 *
 * `REJECTED` is deliberately absent: it is terminal, and a column of dead
 * stories is a graveyard the newsroom has to scroll past every morning. They
 * remain reachable from the queue's status filter.
 */
const COLUMNS: { stage: WorkflowStage; dot: string }[] = [
  { stage: "DRAFT", dot: "bg-gray-500" },
  { stage: "WRITING", dot: "bg-amber-500" },
  { stage: "REVIEW", dot: "bg-yellow-500" },
  { stage: "APPROVAL", dot: "bg-blue-500" },
  { stage: "PUBLISHED", dot: "bg-green-500" },
]

function priorityColor(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-600"
    case "HIGH":
      return "bg-orange-600"
    case "NORMAL":
      return "bg-blue-600"
    default:
      return "bg-gray-600"
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function WorkflowKanban({ user, filters }: WorkflowKanbanProps) {
  const [board, setBoard] = useState<Record<string, BoardItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // One request per column. The API filters stage server-side, and five
      // small queries keep each column's count honest — a single paged query
      // would silently truncate whichever column happened to sort last.
      const results = await Promise.all(
        COLUMNS.map(async ({ stage }) => {
          const params = new URLSearchParams({ stage, limit: "50" })
          if (filters.status && filters.status !== "all") params.set("status", filters.status)
          const res = await fetch(`/api/admin/articles?${params}`, { cache: "no-store" })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? "Não foi possível carregar o quadro.")
          return [stage, body.items as BoardItem[]] as const
        }),
      )
      setBoard(Object.fromEntries(results))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setLoading(false)
    }
  }, [filters.status])

  useEffect(() => {
    void load()
  }, [load])

  if (reviewing) {
    return (
      <ReviewPanel
        articleId={reviewing}
        onClose={() => setReviewing(null)}
        onChanged={() => void load()}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />A carregar o quadro…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-900 bg-red-950/50 p-4 text-sm text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 overflow-x-auto">
      {COLUMNS.map(({ stage, dot }) => {
        const items = board[stage] ?? []
        return (
          <div key={stage} className="min-w-80">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${dot} mr-2`} />
                    {STAGE_LABELS[stage]}
                  </div>
                  <Badge variant="outline" className="text-gray-400">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className="bg-gray-800 border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => setReviewing(item.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-white font-medium text-sm leading-tight">
                          {item.rewrittenTitle ?? item.sourceTitle}
                        </h4>
                        <Badge className={`${priorityColor(item.priority)} text-white text-xs`}>
                          {item.priority}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        {item.category ? (
                          <Badge
                            style={{ backgroundColor: item.category.color }}
                            className="text-white"
                          >
                            {item.category.name}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        <span className="tabular-nums">{item.importanceScore.toFixed(1)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-blue-600 text-white">
                              {item.author ? initials(item.author.name) : "—"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-400">
                            {item.author?.name ?? "Sem autor"}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{item.sourceName}</span>
                      </div>

                      {/* The two states that need a human, named on the card. */}
                      <div className="flex flex-wrap items-center gap-3">
                        {item.rewriteState === "failed" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {QUEUE_LABELS.rewriteFailed}
                          </span>
                        )}
                        {!item.imagePublishable && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                            <ImageOff className="w-3 h-3" />
                            {QUEUE_LABELS.noImage}
                          </span>
                        )}
                        {!item.author && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                            <User className="w-3 h-3" />
                            por atribuir
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Nenhum item nesta fase</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
