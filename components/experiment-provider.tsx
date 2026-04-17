"use client"

/**
 * components/experiment-provider.tsx
 *
 * React context that makes pre-fetched experiment variants available
 * to any client component without additional network calls.
 *
 * Usage — in a Server Component (page or layout):
 *
 *   import { getVariants } from "@/lib/growth/experiments"
 *   import { ExperimentProvider } from "@/components/experiment-provider"
 *
 *   const variants = await getVariants(user.id, ["hero_copy", "share_cta", "streak_visibility"])
 *   return <ExperimentProvider variants={variants}>{children}</ExperimentProvider>
 *
 * Usage — in any Client Component:
 *
 *   import { useVariant } from "@/components/experiment-provider"
 *
 *   function HeroSection() {
 *     const { variant, meta } = useVariant("hero_copy") ?? { variant: "control", meta: {} }
 *     return <h1>{meta.headline ?? "Stay informed with NotiLab"}</h1>
 *   }
 *
 * Conversion tracking:
 *
 *   import { useExperimentConversion } from "@/components/experiment-provider"
 *
 *   const trackConversion = useExperimentConversion()
 *   // on button click:
 *   trackConversion("share_cta", "share_clicked")
 */

import { createContext, useContext, useCallback, type ReactNode } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariantMeta {
  weight: number
  label?: string
  [key: string]: unknown
}

export interface AssignedVariant {
  experiment: string
  variant: string
  meta: VariantMeta
}

type VariantMap = Record<string, AssignedVariant>

interface ExperimentContextValue {
  variants: VariantMap
  userId?: string
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ExperimentContext = createContext<ExperimentContextValue>({ variants: {} })

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ExperimentProviderProps {
  variants: VariantMap
  userId?: string
  children: ReactNode
}

export function ExperimentProvider({ variants, userId, children }: ExperimentProviderProps) {
  return (
    <ExperimentContext.Provider value={{ variants, userId }}>
      {children}
    </ExperimentContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the assigned variant for a named experiment, or null if not active.
 * Components should always handle the null / "control" case.
 */
export function useVariant(experimentName: string): AssignedVariant | null {
  const { variants } = useContext(ExperimentContext)
  return variants[experimentName] ?? null
}

/**
 * Returns all assigned variants (useful for debug panels).
 */
export function useAllVariants(): VariantMap {
  const { variants } = useContext(ExperimentContext)
  return variants
}

/**
 * Returns a function to record a conversion event for an experiment.
 * Fire-and-forget — safe to call in event handlers without await.
 */
export function useExperimentConversion() {
  const { userId } = useContext(ExperimentContext)

  return useCallback(
    (experimentName: string, goal: string, articleId?: string) => {
      if (!userId) return
      fetch("/api/growth/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "experiment_converted",
          userId,
          articleId,
          meta: { experiment: experimentName, goal },
        }),
      }).catch(() => {})
    },
    [userId],
  )
}

/**
 * HOC variant: wraps a component to only render in a specific experiment variant.
 *
 * Example:
 *   <WithVariant experiment="notibot_placement" variant="inline">
 *     <NotiBotInline />
 *   </WithVariant>
 */
export function WithVariant({
  experiment,
  variant,
  children,
  fallback = null,
}: {
  experiment: string
  variant: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const assigned = useVariant(experiment)
  if (!assigned || assigned.variant !== variant) return <>{fallback}</>
  return <>{children}</>
}
