"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  Clapperboard,
  Cpu,
  FlaskConical,
  Landmark,
  Palette,
  Scale,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react"

import { useBandejaStore } from "@/lib/immersive/bandeja-store"
import type { FeedFilter } from "./story-feed"

const PARASI_COLOR = "#0A7FFF"

interface CategoryOption {
  name: string
  slug: string
  color: string
  icon: string | null
  todayCount: number
}

interface CategoriesResponse {
  categories: CategoryOption[]
}

// Duplicated from onboarding-bandeja.tsx (not exported there) — keep the two
// tables in sync if new category icons are introduced.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  trophy: Trophy,
  clapperboard: Clapperboard,
  cpu: Cpu,
  "trending-up": TrendingUp,
  palette: Palette,
  scale: Scale,
  "alert-triangle": AlertTriangle,
  "flask-conical": FlaskConical,
}

function getCategoryIcon(icon: string | null): LucideIcon {
  if (!icon) return Sparkles
  return CATEGORY_ICONS[icon] ?? Sparkles
}

type CardItem = { kind: "parasi" } | { kind: "category"; category: CategoryOption }

function isCardActive(item: CardItem, filter: FeedFilter): boolean {
  if (item.kind === "parasi") return filter === "parasi"
  return filter !== "parasi" && filter.slug === item.category.slug
}

interface BandejaOverlayProps {
  open: boolean
  filter: FeedFilter
  onSelectFilter: (filter: FeedFilter) => void
  onClose: () => void
  /** Optional toast side-effect for the "Silenciados" restore action. */
  onToast?: (message: string) => void
}

export function BandejaOverlay({ open, filter, onSelectFilter, onClose, onToast }: BandejaOverlayProps) {
  const { hidden, followed, restoreHidden } = useBandejaStore()
  const [categories, setCategories] = useState<CategoryOption[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/categories")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load categories")
        const data = (await res.json()) as CategoriesResponse
        if (!cancelled) setCategories(data.categories)
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleCategories = useMemo(
    () => (categories ?? []).filter((c) => !hidden.includes(c.slug)),
    [categories, hidden]
  )

  const hiddenChips = useMemo(
    () =>
      hidden.map((slug) => ({
        slug,
        name: categories?.find((c) => c.slug === slug)?.name ?? slug,
      })),
    [hidden, categories]
  )

  const cardItems: CardItem[] = useMemo(
    () => [
      { kind: "parasi" as const },
      ...visibleCategories.map((category) => ({ kind: "category" as const, category })),
    ],
    [visibleCategories]
  )

  function handleSelect(item: CardItem) {
    if (item.kind === "parasi") {
      onSelectFilter("parasi")
    } else {
      const { slug, name, color } = item.category
      onSelectFilter({ slug, name, color })
    }
  }

  function handleRestore(slug: string, name: string) {
    restoreHidden(slug)
    onToast?.(`${name} reposto na bandeja.`)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 overflow-y-auto"
          style={{ background: "rgba(5,5,8,.78)", backdropFilter: "blur(32px) saturate(140%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <div
            className="mx-auto max-w-[980px] px-5 pb-12 pt-10 md:px-8 md:pb-16 md:pt-14"
            style={{ perspective: 1400 }}
          >
            {/* Header */}
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p
                  className="mb-2 uppercase"
                  style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".14em", color: "#39FF14" }}
                >
                  A TUA BANDEJA
                </p>
                <h2
                  className="font-black text-white"
                  style={{ fontSize: "clamp(28px, 3.6vw, 42px)", letterSpacing: "-0.03em" }}
                >
                  O que queres ver agora?
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,.12)] bg-[rgba(255,255,255,.06)] text-white transition-colors hover:bg-[rgba(255,255,255,.12)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Card grid */}
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5"
              style={{ transformStyle: "preserve-3d" }}
            >
              {cardItems.map((item, i) => {
                const active = isCardActive(item, filter)
                const color = item.kind === "parasi" ? PARASI_COLOR : item.category.color
                const Icon = item.kind === "parasi" ? Sparkles : getCategoryIcon(item.category.icon)
                const name = item.kind === "parasi" ? "Para si" : item.category.name
                const countLabel =
                  item.kind === "parasi"
                    ? "O teu feed pessoal"
                    : `${item.category.todayCount} ${
                        item.category.todayCount === 1 ? "história" : "histórias"
                      } hoje`
                const isFollowed = item.kind === "category" && followed.includes(item.category.slug)
                const key = item.kind === "parasi" ? "parasi" : item.category.slug

                return (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="relative flex flex-col justify-between rounded-[20px] text-left"
                    style={{
                      minHeight: 148,
                      padding: 18,
                      transformStyle: "preserve-3d",
                      background:
                        item.kind === "parasi"
                          ? "linear-gradient(150deg, rgba(10,127,255,.55), rgba(57,255,20,.3)), #0B0B0F"
                          : `radial-gradient(130% 110% at 80% 0%, ${color}52, transparent 55%), linear-gradient(160deg, #14141a, #0B0B0F)`,
                      border: active ? `1px solid ${color}` : "1px solid rgba(255,255,255,.09)",
                      boxShadow: active
                        ? `0 0 24px ${color}55, inset 0 0 0 1px ${color}`
                        : "0 8px 32px rgba(0,0,0,.4)",
                    }}
                    initial={{ opacity: 0, y: 40, rotateX: 14, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.045 }}
                    whileHover={{ y: -8, scale: 1.03 }}
                  >
                    {isFollowed && (
                      <span
                        className="absolute right-3 top-3 rounded-full uppercase text-white"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: ".06em",
                          padding: "3px 8px",
                          background: "rgba(255,255,255,.12)",
                          border: "1px solid rgba(255,255,255,.2)",
                        }}
                      >
                        A seguir
                      </span>
                    )}

                    <Icon className="h-5 w-5 text-white" />

                    <div>
                      <p style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>{name}</p>
                      <p className="mt-1" style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                        {countLabel}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Silenciados */}
            {hiddenChips.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <p
                  className="mb-3 uppercase"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: ".1em",
                    color: "rgba(255,255,255,.45)",
                  }}
                >
                  Silenciados — &quot;menos disto&quot;
                </p>
                <div className="flex flex-wrap gap-2">
                  {hiddenChips.map((chip) => (
                    <button
                      key={chip.slug}
                      type="button"
                      onClick={() => handleRestore(chip.slug, chip.name)}
                      className="rounded-full border border-dashed border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.04)] text-[rgba(255,255,255,.6)] transition-colors hover:border-[rgba(255,255,255,.4)] hover:text-white"
                      style={{ padding: "8px 14px", fontSize: 13 }}
                    >
                      {chip.name} · repor
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
