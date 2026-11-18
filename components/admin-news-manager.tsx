"use client"

/**
 * The newsroom's working queue.
 *
 * This component used to render three hard-coded articles — "Benfica vence
 * clássico", an author called "João Redator", dates in 2024 — above four stat
 * cards with invented percentages. It looked like a CMS and was a mock-up, so
 * nothing collected by ingestion was ever actually seen by anyone before it
 * went live. Phase 4(iii) of `docs/manager/strategy/ingestion-editorial-gate.md`
 * replaces all of it with the real queue.
 *
 * The counts are the ones the API returns. There are no trend percentages: we
 * do not store yesterday's totals, so "+12% desde ontem" could only ever have
 * been decoration, and a number nobody can check is worse than no number.
 */

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ReviewPanel } from "@/components/editorial/review-panel"
import { STATUS_LABELS, QUEUE_LABELS, stageLabel } from "@/lib/editorial/labels"
import { ARTICLE_STATUSES, type ArticleStatus } from "@/lib/editorial/transitions"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ImageOff,
  Loader2,
  PenLine,
  Search,
} from "lucide-react"

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

interface QueueItem {
  id: string
  sourceTitle: string
  rewrittenTitle: string | null
  status: ArticleStatus
  stage: string | null
  rewriteState: "none" | "pending" | "failed" | "ready"
  sourceName: string
  imagePublishable: boolean
  category: { name: string; color: string } | null
  author: { name: string } | null
  reviewer: { name: string } | null
  importanceScore: number
  createdAt: string
}

interface QueueResponse {
  items: QueueItem[]
  pagination: { limit: number; offset: number; total: number; hasMore: boolean }
  counts: Record<ArticleStatus, number>
}

const REWRITE_FILTERS = [
  { value: "all", label: "Qualquer redacção" },
  { value: "ready", label: "Com texto da NotiLab" },
  { value: "pending", label: "Por redigir" },
  { value: "failed", label: QUEUE_LABELS.rewriteFailed },
  { value: "none", label: "Escrito por nós" },
] as const

/** The rewrite state as one short, non-alarming phrase. */
function rewriteBadge(state: QueueItem["rewriteState"]) {
  switch (state) {
    case "ready":
      return { label: "Redigido", className: "bg-emerald-700 text-white" }
    case "failed":
      return { label: QUEUE_LABELS.rewriteFailed, className: "bg-red-700 text-white" }
    case "pending":
      return { label: "Por redigir", className: "bg-gray-700 text-gray-200" }
    case "none":
      return { label: "Nosso texto", className: "bg-sky-800 text-white" }
  }
}

export function AdminNewsManager({ user }: { user: AdminUser }) {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW")
  const [rewriteFilter, setRewriteFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [reviewing, setReviewing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (rewriteFilter !== "all") params.set("rewrite", rewriteFilter)
      if (search.trim()) params.set("q", search.trim())

      const res = await fetch(`/api/admin/articles?${params}`, { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Não foi possível carregar a fila.")
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, rewriteFilter, search])

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per key.
    const timer = setTimeout(() => void load(), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  if (reviewing) {
    return (
      <ReviewPanel
        articleId={reviewing}
        onClose={() => setReviewing(null)}
        onChanged={() => void load()}
      />
    )
  }

  const counts = data?.counts

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão de Notícias</h1>
          <p className="text-gray-400 mt-1">
            {user.name} · {user.role} — as acções disponíveis dependem do seu papel
          </p>
        </div>
      </div>

      {/* Real counts, no invented trends. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(
          [
            { status: "DRAFT" as const, icon: FileText, tint: "text-gray-400" },
            { status: "PENDING_REVIEW" as const, icon: Clock, tint: "text-yellow-400" },
            { status: "APPROVED" as const, icon: CheckCircle, tint: "text-blue-400" },
            { status: "PUBLISHED" as const, icon: CheckCircle, tint: "text-green-400" },
          ] satisfies { status: ArticleStatus; icon: typeof FileText; tint: string }[]
        ).map(({ status, icon: Icon, tint }) => (
          <Card key={status} className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {STATUS_LABELS[status].label}
              </CardTitle>
              <Icon className={`w-4 h-4 ${tint}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {counts ? counts[status].toLocaleString("pt-PT") : "—"}
              </div>
              <p className="text-xs text-gray-400">{STATUS_LABELS[status].hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar por título ou fonte…"
                className="pl-9 bg-gray-950 border-gray-800 text-gray-200"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-52 bg-gray-950 border-gray-800 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {ARTICLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s].label}
                    {counts ? ` (${counts[s]})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={rewriteFilter} onValueChange={setRewriteFilter}>
              <SelectTrigger className="w-full lg:w-52 bg-gray-950 border-gray-800 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWRITE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/50 p-3 text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />A carregar a fila…
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <p className="text-sm">Nada nesta fila.</p>
              <p className="text-xs mt-1">
                Uma fila vazia em “Em revisão” é o objectivo, não um erro.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Título</TableHead>
                  <TableHead className="text-gray-400">Estado</TableHead>
                  <TableHead className="text-gray-400">Redacção</TableHead>
                  <TableHead className="text-gray-400">Fonte</TableHead>
                  <TableHead className="text-gray-400">Responsável</TableHead>
                  <TableHead className="text-gray-400 text-right">Importância</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => {
                  const badge = rewriteBadge(item.rewriteState)
                  const status = STATUS_LABELS[item.status]
                  return (
                    <TableRow key={item.id} className="border-gray-800">
                      <TableCell className="max-w-md">
                        <div className="space-y-1">
                          {/* Our headline where one exists, the source's otherwise —
                              and labelled, so nobody mistakes one for the other. */}
                          <p className="text-white font-medium leading-snug">
                            {item.rewrittenTitle ?? item.sourceTitle}
                          </p>
                          {item.rewrittenTitle && (
                            <p className="text-xs text-gray-500 leading-snug">
                              Fonte: {item.sourceTitle}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            {item.category && (
                              <Badge
                                style={{ backgroundColor: item.category.color }}
                                className="text-white text-[10px]"
                              >
                                {item.category.name}
                              </Badge>
                            )}
                            {!item.imagePublishable && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                                <ImageOff className="w-3 h-3" />
                                {QUEUE_LABELS.noImage}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={`${status.color} text-white`}>{status.label}</Badge>
                          {item.stage && (
                            <p className="text-[10px] text-gray-500">{stageLabel(item.stage)}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={badge.className}>
                          {item.rewriteState === "failed" && (
                            <AlertTriangle className="w-3 h-3 mr-1" />
                          )}
                          {badge.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-gray-300 text-sm">{item.sourceName}</TableCell>

                      <TableCell className="text-sm">
                        <p className="text-gray-300">{item.author?.name ?? "—"}</p>
                        {item.reviewer && (
                          <p className="text-[10px] text-gray-500">rev. {item.reviewer.name}</p>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-gray-300 tabular-nums">
                        {item.importanceScore.toFixed(1)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-700 text-gray-200"
                          onClick={() => setReviewing(item.id)}
                        >
                          <PenLine className="w-3 h-3 mr-1" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {data && data.pagination.total > data.items.length && (
            <p className="mt-4 text-xs text-gray-500">
              A mostrar {data.items.length} de {data.pagination.total}. Os mais importantes
              primeiro.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
