"use client"

/**
 * The review screen — source on the left, NotiLab's rewrite on the right.
 *
 * The two-column layout is a hard requirement of the strategy's R4, not a
 * design preference: **a reviewer who cannot see the source cannot detect a
 * hallucination.** `News.content` is kept immutable precisely so it can be the
 * evidence a fabrication claim is checked against, and this is the one screen
 * where that check actually happens. Collapsing the columns, or defaulting to
 * a tab that hides the source, would throw the guarantee away.
 *
 * Every action offered here is one the API has already told us this viewer may
 * take (`availableTransitions`). The API refuses the rest regardless — this
 * just avoids teaching editors that the buttons are a lottery.
 */

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { STATUS_LABELS, TRANSITION_LABELS, stageLabel } from "@/lib/editorial/labels"
import type { ArticleStatus } from "@/lib/editorial/transitions"
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  ImageOff,
  Loader2,
  ShieldCheck,
} from "lucide-react"

interface Blocker {
  code: string
  message: string
}

interface ReviewArticle {
  id: string
  sourceTitle: string
  rewrittenTitle: string | null
  sourceContent: string
  sourceSummary: string | null
  rewrittenContent: string | null
  rewrittenAt: string | null
  status: ArticleStatus
  stage: string | null
  rewriteState: "none" | "pending" | "failed" | "ready"
  rewriteAttempts: number
  rewriteError: string | null
  sourceName: string
  sourceUrl: string
  imageUrl: string | null
  imagePublishable: boolean
  category: { name: string; color: string } | null
  author: { id: string; name: string } | null
  reviewer: { id: string; name: string } | null
  blockers: Blocker[]
  availableTransitions: ArticleStatus[]
  canClearReview: boolean
}

interface ReviewPanelProps {
  articleId: string
  onClose: () => void
  onChanged: () => void
}

/** What the right-hand column says when there is no rewrite to show. */
const REWRITE_EMPTY: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Ainda sem texto da NotiLab",
    body: "O artigo foi recolhido mas a redacção automática ainda não chegou a ele. Corre todos os dias às 21:00.",
  },
  failed: {
    title: "A redacção automática falhou",
    body: "Escreva o texto à mão ou arquive o artigo. Nunca publique o texto da fonte como se fosse nosso.",
  },
  none: {
    title: "Artigo escrito por nós",
    body: "Este artigo não veio de recolha — o texto à esquerda já é o nosso.",
  },
}

export function ReviewPanel({ articleId, onClose, onChanged }: ReviewPanelProps) {
  const [article, setArticle] = useState<ReviewArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  /** The target awaiting a second click. REJECTED is terminal (§ 3.4). */
  const [confirming, setConfirming] = useState<ArticleStatus | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/articles/${articleId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar o artigo.")
      setArticle(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    void load()
  }, [load])

  async function act(target: ArticleStatus) {
    // Rejection cannot be undone, so it costs a second click. The warning sits
    // next to the button because the cost is invisible at the moment of the
    // first one.
    if (target === "REJECTED" && confirming !== "REJECTED") {
      setConfirming("REJECTED")
      return
    }

    setBusy(target)
    setError(null)
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "A acção não foi aplicada.")
      setNote("")
      setConfirming(null)
      onChanged()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setBusy(null)
    }
  }

  async function clearReview() {
    setBusy("CLEAR_REVIEW")
    setError(null)
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "A acção não foi aplicada.")
      setNote("")
      onChanged()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.")
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />A carregar o artigo…
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={onClose} className="text-gray-300">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <p className="text-red-400">{error ?? "Artigo não encontrado."}</p>
      </div>
    )
  }

  const status = STATUS_LABELS[article.status]
  const empty = REWRITE_EMPTY[article.rewriteState]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-300 -ml-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar à fila
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${status.color} text-white`}>{status.label}</Badge>
            {article.stage && (
              <Badge variant="outline" className="border-gray-700 text-gray-300">
                {stageLabel(article.stage)}
              </Badge>
            )}
            {article.category && (
              <Badge style={{ backgroundColor: article.category.color }} className="text-white">
                {article.category.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-400">{status.hint}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Provenance. Never a footnote — it is what makes the rewrite legitimate. */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-gray-800 bg-gray-900 p-3 text-sm">
        <span className="text-gray-400">Fonte:</span>
        <span className="text-white font-medium">{article.sourceName}</span>
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          abrir original <ExternalLink className="w-3 h-3" />
        </a>
        <span className="text-gray-600">·</span>
        <span className="text-gray-400">Autor:</span>
        <span className="text-white">{article.author?.name ?? "— por atribuir"}</span>
        {article.reviewer && (
          <>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Revisto por:
            </span>
            <span className="text-white">{article.reviewer.name}</span>
          </>
        )}
        {!article.imagePublishable && (
          <span className="inline-flex items-center gap-1 text-amber-400">
            <ImageOff className="w-3 h-3" /> Sem imagem publicável — publicar assim é normal
          </span>
        )}
      </div>

      {/* Why this article cannot yet be submitted. All of them at once. */}
      {article.blockers.length > 0 && (
        <div className="rounded-md border border-amber-900 bg-amber-950/40 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            Ainda não pode seguir para revisão
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-200/90 list-disc list-inside">
            {article.blockers.map((b) => (
              <li key={b.code}>{b.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── The side-by-side. R4: this is the whole point of the screen. ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-md border border-gray-800 bg-gray-900">
          <header className="border-b border-gray-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-300">
              Texto da fonte · {article.sourceName}
            </h2>
            <p className="text-xs text-gray-500">
              Guardado tal como chegou. Nunca é alterado nem publicado como nosso.
            </p>
          </header>
          <div className="p-4 space-y-3">
            <h3 className="text-base font-medium text-white">{article.sourceTitle}</h3>
            {article.sourceSummary && (
              <p className="text-sm text-gray-400 italic">{article.sourceSummary}</p>
            )}
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {article.sourceContent}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-gray-800 bg-gray-900">
          <header className="border-b border-gray-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-300">Texto da NotiLab</h2>
            <p className="text-xs text-gray-500">
              {article.rewrittenAt
                ? "É isto que o leitor vai ler. Confirme que cada facto está à esquerda."
                : "O que o leitor vai ler, assim que existir."}
            </p>
          </header>
          <div className="p-4 space-y-3">
            {article.rewrittenContent ? (
              <>
                <h3 className="text-base font-medium text-white">
                  {article.rewrittenTitle ?? article.sourceTitle}
                </h3>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {article.rewrittenContent}
                </p>
              </>
            ) : (
              <div className="space-y-2 py-6 text-center">
                <p className="text-sm font-medium text-gray-300">{empty?.title}</p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">{empty?.body}</p>
                {article.rewriteError && (
                  <p className="mt-3 text-xs text-red-400/80">
                    Último erro ({article.rewriteAttempts} tentativas): {article.rewriteError}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Actions ── */}
      <div className="space-y-3 rounded-md border border-gray-800 bg-gray-900 p-4">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota para quem vier a seguir (opcional) — fica no registo da acção."
          className="bg-gray-950 border-gray-800 text-gray-200"
          rows={2}
        />

        <div className="flex flex-wrap items-center gap-2">
          {article.canClearReview && (
            <Button
              onClick={clearReview}
              disabled={busy !== null}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {busy === "CLEAR_REVIEW" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Revisão concluída — passar a aprovação
            </Button>
          )}

          {article.availableTransitions.map((target) => (
            <Button
              key={target}
              onClick={() => act(target)}
              disabled={busy !== null}
              variant={target === "REJECTED" ? "destructive" : "default"}
              className={
                target === "PUBLISHED"
                  ? "bg-green-600 hover:bg-green-700"
                  : target === "APPROVED"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : undefined
              }
            >
              {busy === target && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirming === target && target === "REJECTED"
                ? "Confirmar — isto não se desfaz"
                : TRANSITION_LABELS[target]}
            </Button>
          ))}

          {/* Not an error state. A REDATOR looking at an approved article, or
              anyone looking at a rejected one, correctly has nothing to do. */}
          {article.availableTransitions.length === 0 && !article.canClearReview && (
            <p className="text-sm text-gray-500">
              Não tem acções disponíveis neste artigo, no estado em que ele está.
            </p>
          )}
        </div>

        {confirming === "REJECTED" && (
          <p className="text-xs text-red-400">
            Rejeitar é definitivo: o artigo não volta atrás. Para um problema que se corrige, use
            “Devolver para correcção”.
          </p>
        )}
      </div>
    </div>
  )
}
