"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Local save list for NOW V2.
 *
 * Saves live in `localStorage`, not the database: this surface has no sign-in,
 * and `SavedArticle` requires a `userId`. That is a real limitation — saves do
 * not follow the visitor to another device — and it is recorded here rather than
 * papered over. When accounts arrive, this hook is the one place that has to
 * start syncing.
 */

const STORAGE_KEY = "notilab:saved-stories"

/** V1 `/now` wrote one flag per article: `notilab:saved:<articleId>`. */
const LEGACY_PREFIX = "notilab:saved:"

/** Fired on write so every mounted copy of the hook stays in step. */
const CHANGE_EVENT = "notilab:saved-stories-changed"

function read(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

function write(keys: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Private mode or quota. The in-memory state below still reflects the
    // change for this session, which is the best available outcome.
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
}

/**
 * Folds the V1 per-article flags into the single list, once.
 *
 * The legacy keys hold article ids, and `/api/stories` resolves by id as well as
 * slug, so these keep working — nobody loses their saves to the V2 rewrite.
 */
function migrateLegacyKeys(current: string[]): string[] {
  if (typeof window === "undefined") return current

  try {
    const legacy: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(LEGACY_PREFIX) && window.localStorage.getItem(key) === "1") {
        legacy.push(key.slice(LEGACY_PREFIX.length))
      }
    }
    if (legacy.length === 0) return current

    const merged = [...new Set([...legacy, ...current])]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    for (const id of legacy) window.localStorage.removeItem(`${LEGACY_PREFIX}${id}`)
    return merged
  } catch {
    return current
  }
}

export interface SavedStoriesApi {
  /** Saved keys, newest first. Empty during the first render (SSR-safe). */
  saved: string[]
  isSaved: (key: string) => boolean
  /** Returns the state the story ended up in, so callers can track the event. */
  toggle: (key: string) => boolean
  remove: (key: string) => void
  /** False until `localStorage` has been read, so the UI can hold off. */
  ready: boolean
}

export function useSavedStories(): SavedStoriesApi {
  const [saved, setSaved] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSaved(migrateLegacyKeys(read()))
    setReady(true)

    const sync = () => setSaved(read())
    window.addEventListener(CHANGE_EVENT, sync)
    // `storage` fires for changes made in other tabs.
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const isSaved = useCallback((key: string) => saved.includes(key), [saved])

  const toggle = useCallback((key: string) => {
    const current = read()
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [key, ...current]
    write(next)
    setSaved(next)
    return next.includes(key)
  }, [])

  const remove = useCallback((key: string) => {
    const next = read().filter((k) => k !== key)
    write(next)
    setSaved(next)
  }, [])

  return { saved, isSaved, toggle, remove, ready }
}
