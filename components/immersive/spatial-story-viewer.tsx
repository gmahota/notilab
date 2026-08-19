"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Box, ChevronLeft, ChevronRight, X } from "lucide-react"

import type { SceneTimelineMark, SpatialAsset } from "./types"

interface SpatialStoryViewerProps {
  asset: SpatialAsset
  open: boolean
  onClose: () => void
}

type SceneMode = "guiado" | "livre"

const PROGRESS_TICK_MS = 90

/**
 * "14 Dez, 18:00 — Ciclone formado no canal" -> "14 Dez, 18:00" for tick
 * labels that need to stay short along the bottom of the timeline track.
 */
function shortenMarkLabel(label: string): string {
  const dashIndex = label.indexOf("—")
  if (dashIndex > 0) return label.slice(0, dashIndex).trim()
  if (label.length > 18) return `${label.slice(0, 16).trim()}…`
  return label
}

/** Last mark at-or-below `value`, falling back to the first mark. */
function currentTimelineLabel(timeline: SceneTimelineMark[], value: number): string {
  if (timeline.length === 0) return ""
  const sorted = [...timeline].sort((a, b) => a.at - b.at)
  let candidate = sorted[0]
  for (const mark of sorted) {
    if (mark.at <= value) candidate = mark
  }
  return candidate.label
}

export function SpatialStoryViewer({ asset, open, onClose }: SpatialStoryViewerProps) {
  const [progress, setProgress] = useState(0)
  const [mode, setMode] = useState<SceneMode>("guiado")
  const [step, setStep] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null)
  const [sceneTime, setSceneTime] = useState(100)

  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset + (re)start the simulated load whenever the viewer opens.
  useEffect(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }
    if (!open) return

    setProgress(0)
    setMode("guiado")
    setStep(0)
    setTilt({ x: 0, y: 0 })
    setActiveHotspot(null)
    setSceneTime(100)

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(100, prev + 4 + Math.random() * 9)
        if (next >= 100 && progressInterval.current) {
          clearInterval(progressInterval.current)
          progressInterval.current = null
        }
        return next
      })
    }, PROGRESS_TICK_MS)

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  const loading = progress < 100
  const isMap = asset.type === "map"
  const hasTimeline = isMap && !!asset.timeline && asset.timeline.length > 0
  const presets = asset.cameraPresets

  const glowTime = hasTimeline ? sceneTime : 60

  const stageTransform = useMemo(() => {
    if (mode === "guiado" && presets.length > 0) {
      const preset = presets[Math.min(step, presets.length - 1)]
      return `rotateX(${preset.rx}deg) rotateY(${preset.ry}deg) scale(${preset.z})`
    }
    const base = isMap ? 45 : 5
    return `rotateX(${base + tilt.y * -10}deg) rotateY(${tilt.x * 16}deg) scale(1.15)`
  }, [mode, presets, step, isMap, tilt])

  if (!open) return null

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "livre") return
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
    setTilt({ x: nx, y: ny })
  }

  function handleCancel() {
    onClose()
  }

  function goPrev() {
    setMode("guiado")
    setStep((prev) => Math.max(0, prev - 1))
  }

  function goNext() {
    setMode("guiado")
    setStep((prev) => Math.min(presets.length - 1, prev + 1))
  }

  function toggleMode() {
    setMode((prev) => (prev === "guiado" ? "livre" : "guiado"))
  }

  const currentPreset = presets[Math.min(step, Math.max(presets.length - 1, 0))]

  return (
    <div
      className="absolute inset-0 z-[65]"
      style={{ background: "radial-gradient(120% 100% at 50% 100%, #0a1220 0%, #030306 60%)" }}
    >
      {loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <Box className="h-[34px] w-[34px] animate-float text-[#39FF14]" strokeWidth={1.5} />
          <div>
            <p className="mb-1 text-base font-bold text-white">
              A carregar a cena · {Math.round(progress)}%
            </p>
            <p className="text-[13px] text-white/50">
              Reconstrução comprimida · {asset.sizeLabel} · só carrega quando pedes
            </p>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full"
            style={{ width: "min(320px, 70vw)", background: "rgba(255,255,255,.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(progress)}%`,
                background: "linear-gradient(90deg, #0A7FFF, #39FF14)",
                transition: "width .12s linear",
                boxShadow: "0 0 12px rgba(10,127,255,.6)",
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-[13px] text-white/45 transition-colors hover:text-white"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ perspective: 1300 }}
            onPointerMove={handlePointerMove}
          >
            <div
              className="absolute overflow-hidden"
              style={{
                left: "50%",
                top: "50%",
                width: "min(78vw, 900px)",
                height: "min(60vh, 560px)",
                margin: "calc(min(60vh, 560px) / -2) 0 0 calc(min(78vw, 900px) / -2)",
                transform: stageTransform,
                transformStyle: "preserve-3d",
                transition:
                  mode === "guiado" ? "transform .9s cubic-bezier(.22,1,.36,1)" : "transform .12s linear",
                borderRadius: 18,
                boxShadow: "0 60px 120px rgba(0,0,0,.7), 0 0 60px rgba(10,127,255,.12)",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              {asset.type === "photo" ? (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url("${asset.fallbackImage}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: [
                      `radial-gradient(${14 + glowTime * 0.41}% ${11 + glowTime * 0.34}% at 62% 52%, rgba(10,127,255,${0.28 + glowTime * 0.0022}), rgba(10,127,255,${0.08 + glowTime * 0.001}) 55%, transparent 75%)`,
                      `radial-gradient(${8 + glowTime * 0.22}% ${6 + glowTime * 0.19}% at 28% 46%, rgba(10,127,255,${0.2 + glowTime * 0.002}), transparent 70%)`,
                      "repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 56px)",
                      "repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px 56px)",
                      "linear-gradient(130deg, #0e1a13 0%, #10181f 60%, #0b1118 100%)",
                    ].join(", "),
                  }}
                />
              )}

              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,.35), transparent 45%)" }}
              />

              {asset.hotspots.map((hotspot, i) => {
                const active = activeHotspot === i
                return (
                  <button
                    key={`${hotspot.x}-${hotspot.y}-${i}`}
                    type="button"
                    onClick={() => setActiveHotspot((prev) => (prev === i ? null : i))}
                    aria-label={hotspot.title}
                    className={active ? "" : "animate-live-pulse"}
                    style={{
                      position: "absolute",
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      transform: "translate(-50%, -50%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 800,
                      color: active ? "#050508" : "#fff",
                      background: active ? "#39FF14" : "rgba(5,5,8,.65)",
                      border: `2px solid ${active ? "#39FF14" : "rgba(57,255,20,.7)"}`,
                      boxShadow: "0 0 16px rgba(57,255,20,.45)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Top bar */}
          <div
            className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-[22px] py-[18px]"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.55), transparent)" }}
          >
            <div>
              <p
                className="mb-[3px] uppercase"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", color: "#39FF14" }}
              >
                Dentro da cena
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
                {asset.title}
              </p>
              <p className="mt-[3px]" style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                {asset.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="glass flex h-[38px] shrink-0 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold text-white"
              style={{ backdropFilter: "blur(20px)" }}
            >
              <X className="h-[15px] w-[15px]" />
              Sair da cena
            </button>
          </div>

          {/* Hotspot annotation */}
          {activeHotspot !== null && asset.hotspots[activeHotspot] && (
            <div
              className="absolute rounded-2xl p-[18px]"
              style={{
                left: 22,
                bottom: 208,
                width: "min(340px, 80vw)",
                background: "rgba(12,14,18,.92)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(57,255,20,.3)",
                boxShadow: "0 12px 48px rgba(0,0,0,.6)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p style={{ fontSize: 14, fontWeight: 800, color: "#39FF14" }}>
                  {asset.hotspots[activeHotspot].title}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveHotspot(null)}
                  aria-label="Fechar anotação"
                  className="p-0.5 text-white/50 transition-colors hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,.82)" }}>
                {asset.hotspots[activeHotspot].text}
              </p>
            </div>
          )}

          {/* Timeline slider — map scenes only */}
          {hasTimeline && asset.timeline && (
            <div
              className="absolute flex flex-col gap-1.5 rounded-2xl"
              style={{
                left: "50%",
                bottom: 84,
                transform: "translateX(-50%)",
                width: "min(460px, calc(100vw - 48px))",
                background: "rgba(10,10,14,.75)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,.1)",
                padding: "12px 16px",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                  {currentTimelineLabel(asset.timeline, sceneTime)}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".1em",
                    color: "rgba(255,255,255,.45)",
                  }}
                >
                  LINHA DO TEMPO
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={sceneTime}
                onChange={(e) => setSceneTime(Number(e.target.value))}
                className="w-full cursor-pointer"
                style={{ accentColor: "#39FF14", height: 18 }}
              />
              <div className="flex justify-between gap-2" style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>
                {asset.timeline.map((mark, i) => (
                  <span key={`${mark.at}-${i}`} className="truncate">
                    {shortenMarkLabel(mark.label)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bottom controls */}
          {presets.length > 0 && (
            <div
              className="absolute flex items-center gap-2 rounded-full"
              style={{
                left: "50%",
                bottom: 24,
                transform: "translateX(-50%)",
                background: "rgba(10,10,14,.75)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,.1)",
                padding: 6,
              }}
            >
              <button
                type="button"
                onClick={goPrev}
                disabled={step === 0}
                aria-label="Passo anterior"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[.14] disabled:opacity-30"
                style={{ background: "rgba(255,255,255,.06)" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span
                className="whitespace-nowrap px-2"
                style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}
              >
                {currentPreset ? `${currentPreset.label} · ${step + 1}/${presets.length}` : ""}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={step === presets.length - 1}
                aria-label="Passo seguinte"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[.14] disabled:opacity-30"
                style={{ background: "rgba(255,255,255,.06)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="h-[22px] w-px" style={{ background: "rgba(255,255,255,.14)" }} />
              <button
                type="button"
                onClick={toggleMode}
                className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/[.14] hover:text-white"
                style={{ background: "rgba(255,255,255,.06)" }}
              >
                <Box className="h-[15px] w-[15px]" />
                {mode === "guiado" ? "Modo guiado" : "Exploração livre"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
