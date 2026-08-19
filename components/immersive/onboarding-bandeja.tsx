"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Clapperboard,
  Cpu,
  FlaskConical,
  Landmark,
  Loader2,
  Palette,
  Scale,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { useBandejaStore } from "@/lib/immersive/bandeja-store"
import { PACE_DEFS, type PaceKey } from "@/lib/immersive/pace"

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

const PACE_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  sparkles: Sparkles,
  users: Users,
}

const PACE_ORDER: PaceKey[] = ["dinamico", "equilibrado", "calmo"]

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const blockVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export function OnboardingBandeja() {
  const { hydrated, onboarded, completeOnboarding, skipOnboarding, setPace } = useBandejaStore()

  const [categories, setCategories] = useState<CategoryOption[] | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [selectedPace, setSelectedPace] = useState<PaceKey>("equilibrado")

  const shouldRender = hydrated && !onboarded

  useEffect(() => {
    if (!shouldRender) return
    let cancelled = false

    fetch("/api/categories")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load categories")
        const data = (await res.json()) as CategoriesResponse
        if (!cancelled) setCategories(data.categories)
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [shouldRender])

  const threshold = useMemo(() => {
    if (!categories) return 3
    return Math.min(3, categories.length)
  }, [categories])

  const toggleCategory = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  const handleConfirm = () => {
    setPace(selectedPace)
    completeOnboarding(selectedSlugs)
  }

  const remaining = Math.max(0, threshold - selectedSlugs.length)
  const canSubmit = remaining === 0

  if (!shouldRender) return null
  if (fetchFailed) return null
  if (categories && categories.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        background: "radial-gradient(120% 100% at 50% 0%, #0b1224 0%, #050508 55%)",
      }}
    >
      {!categories ? (
        <div className="flex min-h-full items-center justify-center text-white/60">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <motion.div
          className="mx-auto flex min-h-full max-w-[760px] flex-col items-center text-center"
          style={{ padding: "64px 32px 48px" }}
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Logo */}
          <motion.div variants={blockVariants} className="mb-6 flex items-center gap-2">
            <div className="relative h-9 w-9">
              <Zap className="h-9 w-9 text-primary" />
              <div className="absolute inset-0 h-9 w-9 animate-pulse text-secondary opacity-40">
                <Zap className="h-9 w-9" />
              </div>
            </div>
            <span className="text-gradient text-2xl font-black">NotiLab</span>
          </motion.div>

          {/* Kicker + heading */}
          <motion.div variants={blockVariants} className="mb-3">
            <p
              className="uppercase"
              style={{
                fontSize: "13px",
                letterSpacing: ".12em",
                color: "rgba(255,255,255,.5)",
              }}
            >
              NEWS YOU CAN ENTER.
            </p>
          </motion.div>

          <motion.h1
            variants={blockVariants}
            className="font-black text-white"
            style={{
              fontSize: "clamp(30px, 4.4vw, 48px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Monta a tua bandeja
          </motion.h1>

          <motion.p
            variants={blockVariants}
            className="mx-auto mt-4 mb-10"
            style={{
              fontSize: "15px",
              color: "rgba(255,255,255,.6)",
              maxWidth: "440px",
              lineHeight: 1.6,
            }}
          >
            Escolhe pelo menos 3 temas. Quem quer cinema não vê basebol — o teu feed é só teu.
          </motion.p>

          {/* Category chips */}
          <motion.div
            variants={blockVariants}
            className="mb-12 flex flex-wrap items-center justify-center gap-[10px]"
          >
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.icon)
              const selected = selectedSlugs.includes(category.slug)

              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => toggleCategory(category.slug)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    background: selected ? `${category.color}33` : "rgba(255,255,255,.04)",
                    border: selected
                      ? `1.5px solid ${category.color}`
                      : "1.5px solid rgba(255,255,255,.12)",
                    boxShadow: selected ? `0 0 18px ${category.color}40` : "none",
                    color: selected ? "#fff" : "rgba(255,255,255,.65)",
                  }}
                >
                  <Icon className="h-[15px] w-[15px]" />
                  {category.name}
                </button>
              )
            })}
          </motion.div>

          {/* Pace section */}
          <motion.div variants={blockVariants} className="w-full">
            <p
              className="mb-4 uppercase"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: ".12em",
                color: "rgba(255,255,255,.45)",
              }}
            >
              E ao teu ritmo
            </p>

            <div className="mb-10 flex flex-wrap items-stretch justify-center gap-[10px]">
              {PACE_ORDER.map((key) => {
                const def = PACE_DEFS[key]
                const Icon = PACE_ICONS[def.icon] ?? Sparkles
                const selected = selectedPace === key

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPace(key)}
                    className="flex flex-col items-center rounded-2xl text-center transition-colors"
                    style={{
                      flex: "1 1 160px",
                      maxWidth: "220px",
                      padding: "18px 16px",
                      border: selected
                        ? "1.5px solid rgba(57,255,20,.55)"
                        : "1.5px solid rgba(255,255,255,.12)",
                      background: selected ? "rgba(57,255,20,.08)" : "rgba(255,255,255,.04)",
                      boxShadow: selected ? "0 0 20px rgba(57,255,20,.2)" : "none",
                    }}
                  >
                    <Icon
                      className="mb-2 h-5 w-5"
                      style={{ color: selected ? "#39FF14" : "rgba(255,255,255,.6)" }}
                    />
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: selected ? "#fff" : "rgba(255,255,255,.6)",
                      }}
                    >
                      {def.label}
                    </span>
                    <span
                      className="mt-1"
                      style={{ fontSize: "12px", color: "rgba(255,255,255,.55)" }}
                    >
                      {def.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div variants={blockVariants} className="flex w-full flex-col items-center">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleConfirm}
              className="w-full max-w-[360px] rounded-2xl transition-shadow"
              style={{
                height: "52px",
                fontSize: "16px",
                fontWeight: 700,
                background: canSubmit
                  ? "linear-gradient(135deg, #0A7FFF, #0663c9)"
                  : "rgba(255,255,255,.07)",
                color: canSubmit ? "#fff" : "rgba(255,255,255,.35)",
                boxShadow: canSubmit
                  ? "0 0 24px rgba(10,127,255,.5), 0 0 60px rgba(10,127,255,.25)"
                  : "none",
                cursor: canSubmit ? "pointer" : "default",
              }}
            >
              {canSubmit
                ? "Criar a minha bandeja"
                : `Escolhe mais ${remaining} ${remaining === 1 ? "tema" : "temas"}`}
            </button>

            <button
              type="button"
              onClick={skipOnboarding}
              className="mt-4 transition-colors hover:text-white"
              style={{ fontSize: "13px", color: "rgba(255,255,255,.45)" }}
            >
              Ver tudo primeiro
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
