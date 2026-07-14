"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Loader2, Link2, Copy, Check, Share2, MessageCircle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface LinkAnalysis {
  title: string
  source: string
  summary: string
  explanation: string
  whyItMatters: string
  shareText: string
  tags: string[]
  readTime: string
  sentiment: "positive" | "negative" | "neutral"
}

const SENTIMENT_STYLES = {
  positive: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  negative: "bg-red-500/15 border-red-500/30 text-red-400",
  neutral: "bg-blue-500/15 border-blue-500/30 text-blue-400",
}

export function PasteLink() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LinkAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch("/api/news/summarize-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to analyze this link.")
      } else {
        setResult(data)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    if (!result) return
    window.open(
      `https://wa.me/?text=${encodeURIComponent(result.shareText)}`,
      "_blank",
      "noopener,noreferrer"
    )
  }

  const handleShareX = () => {
    if (!result) return
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(result.shareText)}`,
      "_blank",
      "noopener,noreferrer"
    )
  }

  return (
    <section className="relative w-full bg-[#060a14] py-20 overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(57,255,20,0.08) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          {/* Heading */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/25 text-[#39FF14] text-xs font-semibold">
              <Link2 className="h-3.5 w-3.5" />
              Paste &amp; Explain
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Drop a link.<br />
              <span className="text-gradient">Understand it instantly.</span>
            </h2>
            <p className="text-white/45 text-sm sm:text-base">
              Drop any URL. Get a summary, plain-English breakdown, and why it matters.
            </p>
          </div>

          {/* Input form */}
          <form onSubmit={handleAnalyze}>
            <div className="relative group">
              {/* Glow ring */}
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-[#39FF14]/40 via-blue-500/30 to-[#39FF14]/40 blur-md opacity-50 group-hover:opacity-90 animate-glow-pulse transition-opacity duration-500 pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row items-stretch gap-3 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a news link..."
                  autoComplete="off"
                  required
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-base px-4 py-3"
                />
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#39FF14] to-emerald-400 text-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all duration-200 hover:[box-shadow:0_0_20px_rgba(57,255,20,0.45)] cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Explain
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Error state */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading skeleton */}
          <AnimatePresence>
            {loading && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden"
              >
                <div className="p-5 space-y-4 animate-pulse">
                  <div className="h-4 w-32 rounded-full bg-white/10" />
                  <div className="h-6 w-3/4 rounded-lg bg-white/10" />
                  <div className="h-px bg-white/8" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-white/8" />
                    <div className="h-3 w-5/6 rounded bg-white/8" />
                    <div className="h-3 w-4/6 rounded bg-white/8" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result card */}
          <AnimatePresence>
            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45 }}
                className="rounded-2xl bg-[#0c1120] border border-white/10 overflow-hidden"
              >
                {/* Card header */}
                <div className="px-5 py-4 border-b border-white/8 flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-white/35 uppercase tracking-wider font-medium">{result.source}</p>
                    <h3 className="text-base font-bold text-white leading-snug line-clamp-2">{result.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-white/35 font-medium">{result.readTime}</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SENTIMENT_STYLES[result.sentiment]}`}>
                      {result.sentiment}
                    </span>
                  </div>
                </div>

                {/* Sections */}
                <div className="px-5 py-5 space-y-5">
                  {/* Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-blue-500" />
                      <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Summary</h4>
                    </div>
                    <p className="text-sm text-white/75 leading-relaxed">{result.summary}</p>
                  </div>

                  <div className="h-px bg-white/6" />

                  {/* Explanation */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-[#39FF14]" />
                      <h4 className="text-xs font-semibold text-[#39FF14] uppercase tracking-wider">Explanation</h4>
                    </div>
                    <p className="text-sm text-white/75 leading-relaxed">{result.explanation}</p>
                  </div>

                  <div className="h-px bg-white/6" />

                  {/* Why it matters */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-orange-400" />
                      <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Why it matters</h4>
                    </div>
                    <p className="text-sm text-white/75 leading-relaxed">{result.whyItMatters}</p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {result.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 rounded-full text-xs text-white/45 border border-white/12 bg-white/4"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Share footer */}
                <div className="px-5 py-4 border-t border-white/8 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/12 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-[#39FF14]" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy summary"}
                  </button>
                  <button
                    onClick={handleWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-all duration-200 cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>
                  <button
                    onClick={handleShareX}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/12 text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share on X
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
