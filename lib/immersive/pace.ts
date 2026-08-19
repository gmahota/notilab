/**
 * Reading pace definitions for the /now immersive feed.
 *
 * Used by the onboarding flow (this phase) and later by the feed/card
 * components (a future phase) to drive title/teaser sizing and transition
 * timing. Framework-agnostic on purpose — no lucide-react import here, the
 * consuming UI component maps `icon` (a plain string tag) to an actual
 * lucide-react component.
 */

export type PaceKey = "dinamico" | "equilibrado" | "calmo"

/** Stable cycle order used by the onboarding pace picker and the feed's pace toggle button. */
export const PACE_ORDER: PaceKey[] = ["dinamico", "equilibrado", "calmo"]

export interface PaceDef {
  label: string
  desc: string
  /** true = cinematic transitions, false = calmer/simpler transitions */
  cine: boolean
  titleSize: string
  teaserSize: string
  longTeaser: boolean
  icon: string
}

export const PACE_DEFS: Record<PaceKey, PaceDef> = {
  dinamico: {
    label: "Dinâmico",
    desc: "Rápido e imersivo — vê o essencial em segundos",
    cine: true,
    titleSize: "clamp(26px, 3.4vw, 44px)",
    teaserSize: "clamp(14px, 1.2vw, 17px)",
    longTeaser: false,
    icon: "zap",
  },
  equilibrado: {
    label: "Equilibrado",
    desc: "Manchete forte com um resumo claro",
    cine: true,
    titleSize: "clamp(28px, 3.6vw, 46px)",
    teaserSize: "clamp(15px, 1.3vw, 18px)",
    longTeaser: false,
    icon: "sparkles",
  },
  calmo: {
    label: "Calmo",
    desc: "Texto maior, menos movimento, mais contexto",
    cine: false,
    titleSize: "clamp(30px, 3.8vw, 48px)",
    teaserSize: "clamp(17px, 1.5vw, 20px)",
    longTeaser: true,
    icon: "users",
  },
}

/** Cinematic feed transition (Dinâmico / Equilibrado). */
export const CINE_TRANSITION = ".75s cubic-bezier(.22,1,.36,1)"
/** Calmer feed transition (Calmo). */
export const CALM_TRANSITION = ".35s ease-out"

/** Returns the CSS transition string for a given pace's `cine` flag. */
export function transitionForPace(pace: PaceKey): string {
  return PACE_DEFS[pace].cine ? CINE_TRANSITION : CALM_TRANSITION
}
