/**
 * lib/editorial/labels.ts — The Portuguese the newsroom actually reads.
 *
 * `docs/editor/ingestion-editorial-workflow.md` § 5: Portuguese in everything
 * the reader and the editor see; English in code, schema, identifiers and
 * `docs/`.
 *
 * **One map, imported everywhere.** These strings were previously re-declared
 * inside `admin-news-manager.tsx`, `workflow-kanban.tsx`, `workflow-manager.tsx`,
 * `workflow-history.tsx`, `campaign-manager.tsx` and `newsletter-manager.tsx`,
 * which is how `PENDING_REVIEW` ended up labelled "Pendente" in one component
 * and missing entirely from another. A label is a product decision; six copies
 * of it are six chances to disagree.
 *
 * `PENDING_REVIEW` reads "Em revisão" rather than the former "Pendente" —
 * "Pendente" says nothing about *what* is pending.
 */

import type { ArticleStatus } from "./transitions"
import type { WorkflowStage } from "@/lib/generated/prisma"

export interface StatusLabel {
  label: string
  /** Tailwind background class for the badge. */
  color: string
  /** One line of plain Portuguese: what this state means for the article. */
  hint: string
}

export const STATUS_LABELS: Record<ArticleStatus, StatusLabel> = {
  DRAFT: {
    label: "Rascunho",
    color: "bg-gray-600",
    hint: "Recolhido ou em redacção. Não está visível no site.",
  },
  PENDING_REVIEW: {
    label: "Em revisão",
    color: "bg-yellow-600",
    hint: "Submetido. Aguarda revisão e depois aprovação.",
  },
  APPROVED: {
    label: "Aprovado",
    color: "bg-blue-600",
    hint: "Aprovado para publicação. Ainda não está no site.",
  },
  PUBLISHED: {
    label: "Publicado",
    color: "bg-green-600",
    hint: "Visível no site.",
  },
  REJECTED: {
    label: "Rejeitado",
    color: "bg-red-600",
    // The warning that has to live next to the button, per § 3.4 — the cost of
    // getting this wrong is invisible at the moment of the click.
    hint: "Definitivo. Não pode ser recuperado.",
  },
  ARCHIVED: {
    label: "Arquivado",
    color: "bg-gray-500",
    hint: "Fora de circulação. O artigo e a sua proveniência continuam guardados.",
  },
}

export const STAGE_LABELS: Record<WorkflowStage, string> = {
  DRAFT: "Recolhido",
  WRITING: "Em Redação",
  REVIEW: "Em revisão",
  APPROVAL: "Em aprovação",
  PUBLISHED: "Publicado",
  REJECTED: "Rejeitado",
}

/**
 * What each lifecycle move is called on the button that makes it.
 *
 * Keyed by target status, because that is what the CMS has in hand when it
 * renders the action. `DRAFT` is "Devolver" and never "Rejeitar": sending an
 * article back for fixes is the ordinary outcome of a review, and conflating
 * it with the terminal action is how stories get killed by accident.
 */
export const TRANSITION_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Devolver para correcção",
  PENDING_REVIEW: "Submeter para revisão",
  APPROVED: "Aprovar",
  PUBLISHED: "Publicar",
  REJECTED: "Rejeitar definitivamente",
  ARCHIVED: "Arquivar",
}

/** Queue names from § 5 "Notes" — the two states that need a human, by name. */
export const QUEUE_LABELS = {
  rewriteFailed: "Falhou a redacção",
  noImage: "Sem imagem",
} as const

export function statusLabel(status: string): StatusLabel {
  return STATUS_LABELS[status as ArticleStatus] ?? STATUS_LABELS.DRAFT
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as WorkflowStage] ?? STAGE_LABELS.DRAFT
}
