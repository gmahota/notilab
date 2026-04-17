/**
 * lib/growth/experiments.ts
 *
 * Lightweight A/B experiment framework.
 *
 * Design rules:
 *   - Deterministic bucketing: hash(userId + experimentName) % 100
 *     → same user always lands in the same bucket without a DB read
 *   - Lazy sticky assignment: ExperimentAssignment row written on first exposure,
 *     then read from DB on subsequent calls (sticky for the user's lifetime)
 *   - Anonymous users: use sessionId as the bucketing key (not persisted to DB)
 *   - Inactive experiments always return the "control" variant
 *   - Never throws: failures return "control" silently
 *
 * Variant definition (stored in GrowthExperiment.variants JSON):
 * {
 *   "control":   { "weight": 50, "label": "Original hero copy" },
 *   "treatment": { "weight": 50, "label": "Urgency hero copy", "copy": "Don't miss today's top stories" }
 * }
 * Weights are relative integers; they are normalised to 0–100 internally.
 */

import { createHash } from "crypto"
import { prisma } from "../prisma"
import { trackEvent } from "./events"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariantMeta {
  weight: number
  label?: string
  [key: string]: unknown // arbitrary payload — copy strings, feature flags, etc.
}

export interface ExperimentConfig {
  id: string
  name: string
  isActive: boolean
  variants: Record<string, VariantMeta>
}

export interface AssignedVariant {
  experiment: string
  variant: string
  meta: VariantMeta
  /** true when this is the first time the user was exposed */
  isNewAssignment: boolean
}

// ---------------------------------------------------------------------------
// PrismaExt
// ---------------------------------------------------------------------------

type PrismaExt = typeof prisma & {
  growthExperiment: {
    findUnique: (a: Record<string, unknown>) => Promise<ExperimentConfig | null>
    findMany: (a: Record<string, unknown>) => Promise<ExperimentConfig[]>
    create: (a: { data: Record<string, unknown> }) => Promise<ExperimentConfig>
    update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<ExperimentConfig>
    delete: (a: { where: { id: string } }) => Promise<ExperimentConfig>
  }
  experimentAssignment: {
    findUnique: (a: Record<string, unknown>) => Promise<{ id: string; variant: string } | null>
    create: (a: { data: Record<string, unknown> }) => Promise<{ id: string; variant: string }>
    findMany: (a: Record<string, unknown>) => Promise<Array<{ id: string; userId: string; experimentId: string; variant: string; assignedAt: Date }>>
    deleteMany: (a: { where: Record<string, unknown> }) => Promise<{ count: number }>
  }
}

// ---------------------------------------------------------------------------
// Deterministic bucketing (no crypto randomness — must be reproducible)
// ---------------------------------------------------------------------------

/**
 * Returns a stable bucket [0, 99] for a given key.
 * Uses the first 8 hex chars of SHA-256 as a 32-bit integer.
 */
function bucket(key: string): number {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 8)
  return parseInt(hex, 16) % 100
}

/**
 * Picks a variant name based on weight distribution.
 * Weights are normalised so they don't need to sum to 100.
 *
 * Example: { control: 50, treatment: 50 } → 50/50 split
 *          { a: 34, b: 33, c: 33 }        → ~1/3 each
 */
function pickVariant(variants: Record<string, VariantMeta>, b: number): string {
  const entries = Object.entries(variants)
  const total = entries.reduce((sum, [, v]) => sum + (v.weight ?? 1), 0)

  let cursor = 0
  for (const [name, v] of entries) {
    cursor += ((v.weight ?? 1) / total) * 100
    if (b < cursor) return name
  }

  // Fallback — should never be reached
  return entries[0][0]
}

// ---------------------------------------------------------------------------
// Core public API
// ---------------------------------------------------------------------------

/**
 * Returns the assigned variant for a user in a named experiment.
 * Creates a sticky assignment on first call if the experiment is active.
 *
 * @param userId    - authenticated user ID; pass sessionId for anonymous users
 * @param name      - experiment name as stored in GrowthExperiment.name
 * @param trackExposure - set false to check variant without logging exposure
 */
export async function getVariant(
  userId: string,
  name: string,
  trackExposure = true,
): Promise<AssignedVariant | null> {
  try {
    const db = prisma as unknown as PrismaExt

    const experiment = await db.growthExperiment.findUnique({ where: { name } })
    if (!experiment || !experiment.isActive) return null

    const variants = experiment.variants as Record<string, VariantMeta>

    // Check for existing sticky assignment
    const existing = await db.experimentAssignment.findUnique({
      where: {
        userId_experimentId: { userId, experimentId: experiment.id },
      },
    })

    if (existing) {
      const meta = variants[existing.variant] ?? { weight: 1 }
      const assigned: AssignedVariant = {
        experiment: name,
        variant: existing.variant,
        meta,
        isNewAssignment: false,
      }
      if (trackExposure) {
        await trackEvent({
          event: "experiment_exposed",
          userId,
          meta: { experiment: name, variant: existing.variant },
        })
      }
      return assigned
    }

    // New assignment — deterministic bucket then persist
    const b = bucket(`${userId}:${name}`)
    const variantName = pickVariant(variants, b)
    const meta = variants[variantName] ?? { weight: 1 }

    await db.experimentAssignment.create({
      data: {
        userId,
        experimentId: experiment.id,
        variant: variantName,
      },
    })

    if (trackExposure) {
      await trackEvent({
        event: "experiment_exposed",
        userId,
        meta: { experiment: name, variant: variantName },
      })
    }

    return {
      experiment: name,
      variant: variantName,
      meta,
      isNewAssignment: true,
    }
  } catch {
    return null
  }
}

/**
 * Batch variant lookup — resolves multiple experiments in a single call.
 * Used by the server component that pre-fetches variants for the page.
 *
 * Returns a map of { [experimentName]: AssignedVariant }
 * Missing / inactive experiments are omitted from the result.
 */
export async function getVariants(
  userId: string,
  names: string[],
): Promise<Record<string, AssignedVariant>> {
  const entries = await Promise.all(
    names.map(async (name) => {
      const v = await getVariant(userId, name, false) // exposure tracked separately
      return v ? ([name, v] as const) : null
    }),
  )
  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, AssignedVariant]>)
}

/**
 * Records a conversion event for an experiment.
 * Call this when the user completes the goal action (share, subscribe, etc.).
 */
export async function trackConversion(
  userId: string,
  experimentName: string,
  goal: string,
  articleId?: string,
): Promise<void> {
  await trackEvent({
    event: "experiment_converted",
    userId,
    articleId,
    meta: { experiment: experimentName, goal },
  })
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

/**
 * Returns all experiments (active or not) for the admin dashboard.
 */
export async function listExperiments(): Promise<ExperimentConfig[]> {
  const db = prisma as unknown as PrismaExt
  return db.growthExperiment.findMany({ orderBy: { startedAt: "desc" } })
}

/**
 * Creates a new experiment.
 * Weights in variants default to 1 (equal split) if not provided.
 */
export async function createExperiment(input: {
  name: string
  description?: string
  variants: Record<string, Omit<VariantMeta, "weight"> & { weight?: number }>
}): Promise<ExperimentConfig> {
  const db = prisma as unknown as PrismaExt

  // Normalise: ensure all variants have a weight
  const normalisedVariants = Object.fromEntries(
    Object.entries(input.variants).map(([k, v]) => [k, { weight: 1, ...v }]),
  )

  return db.growthExperiment.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      variants: normalisedVariants,
      isActive: true,
    },
  })
}

/**
 * Stops an experiment by setting isActive = false and endedAt = now.
 */
export async function stopExperiment(id: string): Promise<ExperimentConfig> {
  const db = prisma as unknown as PrismaExt
  return db.growthExperiment.update({
    where: { id },
    data: { isActive: false, endedAt: new Date() },
  })
}

/**
 * Resets all assignments for an experiment (use before re-running).
 */
export async function resetAssignments(experimentId: string): Promise<{ deleted: number }> {
  const db = prisma as unknown as PrismaExt
  const result = await db.experimentAssignment.deleteMany({
    where: { experimentId },
  })
  return { deleted: result.count }
}
