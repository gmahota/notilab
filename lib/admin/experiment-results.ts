/**
 * lib/admin/experiment-results.ts
 *
 * Dashboard-friendly experiment results.
 *
 * Computes per-variant funnel metrics from UserEvent:
 *   exposed → converted
 *
 * All queries are read-only aggregations — no joins needed thanks to the
 * meta JSON column on UserEvent which stores { experiment, variant, goal }.
 *
 * Statistical note:
 *   - Conversion rate = conversions / exposures (per variant)
 *   - Lift = (treatment CVR - control CVR) / control CVR × 100
 *   - Confidence is NOT computed server-side (requires chi-squared / z-test);
 *     the dashboard surface should link to an external stats tool or
 *     the admin can export raw counts for analysis.
 */

import { prisma } from "../prisma"
import { listExperiments } from "../growth/experiments"
import type { ExperimentConfig } from "../growth/experiments"

// ---------------------------------------------------------------------------
// PrismaExt
// ---------------------------------------------------------------------------

type UserEventRow = {
  userId: string | null
  meta: Record<string, unknown> | null
  createdAt: Date
}

type PrismaExt = typeof prisma & {
  userEvent: {
    findMany: (a: Record<string, unknown>) => Promise<UserEventRow[]>
    count: (a: Record<string, unknown>) => Promise<number>
  }
  experimentAssignment: {
    count: (a: Record<string, unknown>) => Promise<number>
    groupBy?: (a: Record<string, unknown>) => Promise<Array<{ variant: string; _count: { variant: number } }>>
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariantResult {
  variant: string
  label: string
  exposures: number
  conversions: number
  conversionRate: number // 0–100 (%)
  /** percentage point lift vs. control (null for control itself) */
  liftVsControl: number | null
}

export interface ExperimentResult {
  id: string
  name: string
  description: string | null
  isActive: boolean
  startedAt: Date
  endedAt: Date | null
  totalAssignments: number
  variants: VariantResult[]
  /** name of the winner variant (highest CVR), or null if inconclusive */
  winner: string | null
}

export interface ExperimentSummary extends Omit<ExperimentResult, "variants"> {
  variantCount: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reads the `variant` field out of a UserEvent.meta JSON column.
 *
 * Prisma types JSON columns as `JsonValue` (which includes primitives and
 * arrays), so narrow to an object before reading the field instead of casting
 * straight to a record.
 */
function variantOf(meta: unknown): string | null {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null
  const value = (meta as Record<string, unknown>).variant
  return typeof value === "string" ? value : null
}

async function countExposures(
  db: PrismaExt,
  experimentName: string,
  variant: string,
): Promise<number> {
  const rows = await db.userEvent.findMany({
    where: {
      event: "experiment_exposed",
      meta: { path: ["experiment"], equals: experimentName },
    },
    select: { userId: true, meta: true, createdAt: true },
  })
  // Filter in JS — Prisma JSON path filtering varies by provider
  return rows.filter((r) => variantOf(r.meta) === variant).length
}

async function countConversions(
  db: PrismaExt,
  experimentName: string,
  variant: string,
): Promise<number> {
  const rows = await db.userEvent.findMany({
    where: {
      event: "experiment_converted",
      meta: { path: ["experiment"], equals: experimentName },
    },
    select: { userId: true, meta: true, createdAt: true },
  })
  return rows.filter((r) => variantOf(r.meta) === variant).length
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns full funnel results for a single experiment.
 */
export async function getExperimentResults(experimentId: string): Promise<ExperimentResult | null> {
  const db = prisma as unknown as PrismaExt

  const experiments = await listExperiments()
  const exp = experiments.find((e) => e.id === experimentId)

  if (!exp) return null

  const variants = exp.variants as Record<string, { weight: number; label?: string }>
  const variantNames = Object.keys(variants)

  const totalAssignments = await db.experimentAssignment.count({
    where: { experimentId },
  })

  // Resolve each variant's funnel in parallel
  const variantResults = await Promise.all(
    variantNames.map(async (variant) => {
      const exposures = await countExposures(db, exp.name, variant)
      const conversions = await countConversions(db, exp.name, variant)
      const cvr = exposures > 0 ? (conversions / exposures) * 100 : 0
      return {
        variant,
        label: variants[variant]?.label ?? variant,
        exposures,
        conversions,
        conversionRate: Math.round(cvr * 100) / 100,
        liftVsControl: null as number | null, // filled in next step
      }
    }),
  )

  // Compute lift vs control
  const controlResult = variantResults.find((v) => v.variant === "control")
  if (controlResult) {
    for (const vr of variantResults) {
      if (vr.variant === "control") continue
      if (controlResult.conversionRate === 0) {
        vr.liftVsControl = null
      } else {
        vr.liftVsControl =
          Math.round(
            ((vr.conversionRate - controlResult.conversionRate) /
              controlResult.conversionRate) *
              100 *
              100,
          ) / 100
      }
    }
  }

  // Winner: variant with highest CVR (needs at least 5 conversions to qualify)
  const qualified = variantResults.filter((v) => v.conversions >= 5)
  const winner =
    qualified.length >= 2
      ? qualified.reduce((best, cur) =>
          cur.conversionRate > best.conversionRate ? cur : best,
        ).variant
      : null

  return {
    id: exp.id,
    name: exp.name,
    description: exp.description ?? null,
    isActive: exp.isActive,
    startedAt: exp.startedAt,
    endedAt: exp.endedAt ?? null,
    totalAssignments,
    variants: variantResults,
    winner,
  }
}

/**
 * Returns a summary list of all experiments for the admin dashboard table.
 */
export async function listExperimentSummaries(): Promise<ExperimentSummary[]> {
  const db = prisma as unknown as PrismaExt
  const experiments = await listExperiments()

  return Promise.all(
    experiments.map(async (exp) => {
      const totalAssignments = await db.experimentAssignment.count({
        where: { experimentId: exp.id },
      })
      return {
        id: exp.id,
        name: exp.name,
        description: exp.description ?? null,
        isActive: exp.isActive,
        startedAt: exp.startedAt,
        endedAt: exp.endedAt ?? null,
        totalAssignments,
        variantCount: Object.keys(exp.variants as Record<string, unknown>).length,
        winner: null,
      }
    }),
  )
}
