"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Brain, Clock, Sparkles, Baby, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { fetchFeedPage, type FeedArticle } from "@/lib/news-client"

export function ExplainIt() {
  const [featured, setFeatured] = useState<FeedArticle | null>(null)
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<string | null>(null)

  // The featured story is whatever currently ranks highest. It used to be a
  // hardcoded EU AI-regulation article with an Unsplash stock photo, which is
  // why production showed the same headline here for months.
  useEffect(() => {
    const controller = new AbortController()

    fetchFeedPage({ limit: 1, signal: controller.signal })
      .then((page) => setFeatured(page.articles[0] ?? null))
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setFeatured(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingFeatured(false)
      })

    return () => controller.abort()
  }, [])

  const handleExplain = async (complexity: "simple" | "child") => {
    if (!featured) return

    setLoading(true)
    setMode(complexity === "simple" ? "30 seconds" : "like you're 10")
    setExplanation(null)
    setError(null)

    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: featured.id, complexity }),
      })
      const payload = await res.json()

      if (!res.ok || !payload.success) {
        // No canned fallback here on purpose. The previous version answered a
        // failure with two hardcoded paragraphs about EU AI law, so a broken
        // request was indistinguishable from a real explanation.
        setError(
          payload?.code === "NOT_ENRICHED"
            ? "Esta história ainda não passou pelo enriquecimento de IA."
            : payload?.error || "Não foi possível obter a explicação.",
        )
        return
      }

      setExplanation(payload.data.explanation)
    } catch {
      setError("Falha de rede ao obter a explicação.")
    } finally {
      setLoading(false)
    }
  }

  // Nothing to explain yet — hide the section rather than show a placeholder story.
  if (!loadingFeatured && !featured) return null

  if (!featured) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Brain className="h-6 w-6 text-primary" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Explain It</h2>
        </div>
        <div className="glass rounded-3xl overflow-hidden border border-border/50 grid md:grid-cols-2">
          <div className="h-64 md:min-h-[300px] bg-muted/20 animate-pulse" />
          <div className="p-6 md:p-8 space-y-4">
            <div className="h-3 w-20 rounded bg-muted/20 animate-pulse" />
            <div className="h-6 w-4/5 rounded-lg bg-muted/25 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/15 animate-pulse" />
            <div className="h-4 w-3/5 rounded bg-muted/15 animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-3 mb-8"
      >
        <Brain className="h-6 w-6 text-primary" />
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Explain It</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass rounded-3xl overflow-hidden border border-border/50"
      >
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative h-64 md:h-auto min-h-[300px]">
            <Image
              src={featured.imageUrl}
              alt={featured.title}
              fill
              className="absolute inset-0 w-full h-full object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-background" />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge className="bg-primary/90 text-primary-foreground">{featured.category.name}</Badge>
              <Badge variant="outline" className="glass text-foreground/80 border-white/10">
                <Clock className="h-3 w-3 mr-1" />
                {featured.readTime} min read
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{featured.sourceName}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                {featured.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{featured.tldr || featured.summary}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => handleExplain("simple")}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl glow-blue"
                size="lg"
              >
                {loading && mode === "30 seconds" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Explain in 30 seconds
              </Button>
              <Button
                onClick={() => handleExplain("child")}
                disabled={loading}
                variant="outline"
                className="border-secondary/50 text-secondary hover:bg-secondary/10 rounded-xl"
                size="lg"
              >
                {loading && mode === "like you're 10" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Baby className="h-4 w-4 mr-2" />
                )}
                Explain like I&apos;m 10
              </Button>
            </div>

            {/* Explanation Result */}
            <AnimatePresence>
              {explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">AI Explanation ({mode})</span>
                    </div>
                    <p className="text-foreground/90 leading-relaxed">{explanation}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                {error}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
