import { useEffect, useSyncExternalStore } from "react"

import type { PaceKey } from "./pace"

/**
 * Dependency-free external-store singleton for the /now "bandeja"
 * (personalization tray: followed categories, hidden categories, reading
 * pace, onboarding status). Built on `useSyncExternalStore` so any number of
 * components (onboarding, feed, nav, settings — across current and future
 * phases) can read/write this state reactively without prop drilling and
 * without pulling in a state-management dependency.
 *
 * Public API (stable across phases — later phases should rely on this verbatim):
 *   useBandejaStore(): {
 *     followed: string[]
 *     hidden: string[]
 *     pace: PaceKey
 *     onboarded: boolean
 *     hydrated: boolean
 *     setPace(pace: PaceKey): void
 *     setFollowed(slugs: string[]): void
 *     toggleHidden(slug: string): void
 *     restoreHidden(slug: string): void
 *     completeOnboarding(followedSlugs: string[]): void
 *     skipOnboarding(): void
 *   }
 */

const STORAGE_KEY = "notilab:bandeja:v1"

export interface BandejaState {
  followed: string[]
  hidden: string[]
  pace: PaceKey
  onboarded: boolean
  hydrated: boolean
}

interface StoredBandeja {
  onboarded?: boolean
  followed?: string[]
  hidden?: string[]
  pace?: PaceKey
}

/**
 * Fixed default returned on the server (and on the client's very first
 * render, before hydration runs). `onboarded: true` here means nothing
 * onboarding-related renders until the client has actually checked
 * localStorage and corrected it — so there's no SSR/CSR mismatch flash.
 * Must be a stable reference (per the useSyncExternalStore contract).
 */
const SERVER_SNAPSHOT: BandejaState = {
  followed: [],
  hidden: [],
  pace: "equilibrado",
  onboarded: true,
  hydrated: false,
}

let state: BandejaState = SERVER_SNAPSHOT

const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) listener()
}

function setState(partial: Partial<BandejaState>) {
  state = { ...state, ...partial }
  emitChange()
}

function readStored(): StoredBandeja | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredBandeja
  } catch {
    return null
  }
}

function writeStored() {
  try {
    const payload: StoredBandeja = {
      onboarded: state.onboarded,
      followed: state.followed,
      hidden: state.hidden,
      pace: state.pace,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // private mode / storage full — optimistic in-memory state still works for this session
  }
}

let hydrationStarted = false

/** Reads localStorage into the store exactly once, on first client use. */
function hydrateOnce() {
  if (hydrationStarted) return
  hydrationStarted = true

  const parsed = readStored()
  setState({
    onboarded: !!parsed,
    followed: parsed?.followed ?? [],
    hidden: parsed?.hidden ?? [],
    pace: parsed?.pace ?? "equilibrado",
    hydrated: true,
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): BandejaState {
  return state
}

function getServerSnapshot(): BandejaState {
  return SERVER_SNAPSHOT
}

function setPace(pace: PaceKey) {
  setState({ pace })
  writeStored()
}

function setFollowed(slugs: string[]) {
  setState({ followed: slugs })
  writeStored()
}

function toggleHidden(slug: string) {
  const hidden = state.hidden.includes(slug)
    ? state.hidden.filter((s) => s !== slug)
    : [...state.hidden, slug]
  setState({ hidden })
  writeStored()
}

function restoreHidden(slug: string) {
  if (!state.hidden.includes(slug)) return
  setState({ hidden: state.hidden.filter((s) => s !== slug) })
  writeStored()
}

function completeOnboarding(followedSlugs: string[]) {
  setState({ followed: followedSlugs, onboarded: true })
  writeStored()
}

function skipOnboarding() {
  setState({ onboarded: true })
  writeStored()
}

export interface BandejaStore extends BandejaState {
  setPace: typeof setPace
  setFollowed: typeof setFollowed
  toggleHidden: typeof toggleHidden
  restoreHidden: typeof restoreHidden
  completeOnboarding: typeof completeOnboarding
  skipOnboarding: typeof skipOnboarding
}

export function useBandejaStore(): BandejaStore {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Runs in every component that calls this hook, but `hydrateOnce` is
  // module-level-guarded so the actual localStorage read + state update only
  // happens once, the first time any of them mount.
  useEffect(() => {
    hydrateOnce()
  }, [])

  return {
    ...snapshot,
    setPace,
    setFollowed,
    toggleHidden,
    restoreHidden,
    completeOnboarding,
    skipOnboarding,
  }
}
