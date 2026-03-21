"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Brain, Clock, Sparkles, Baby, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const featuredArticle = {
  title: "EU Parliament Approves Landmark AI Safety Act: What It Means for the World",
  summary:
    "The European Union has passed the most comprehensive AI regulation in history, setting global standards for artificial intelligence development, deployment, and oversight across all industries.",
  image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
  category: "Technology",
  readTime: "8 min read",
  source: "Reuters",
}

export function ExplainIt() {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<string | null>(null)

  const handleExplain = async (complexity: "simple" | "child") => {
    setLoading(true)
    setMode(complexity === "simple" ? "30 seconds" : "like you're 10")
    setExplanation(null)

    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: featuredArticle.title, complexity }),
      })
      const data = await res.json()
      setExplanation(data.explanation)
    } catch {
      setExplanation(
        complexity === "simple"
          ? "The EU just created the world's first major rulebook for AI. Companies must now be transparent about how their AI works, can't use it for mass surveillance, and face big fines if they break the rules. This affects every tech company globally."
          : "Imagine AI is like a super-smart robot helper. The EU (a group of countries in Europe) just made rules so these robot helpers have to be nice and fair. They can't spy on people or be mean. If companies break the rules, they get in big trouble — like a really expensive time-out! 🤖"
      )
    } finally {
      setLoading(false)
    }
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
              src={featuredArticle.image}
              alt={featuredArticle.title}
              fill
              className="absolute inset-0 w-full h-full object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-background" />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge className="bg-primary/90 text-primary-foreground">{featuredArticle.category}</Badge>
              <Badge variant="outline" className="glass text-foreground/80 border-white/10">
                <Clock className="h-3 w-3 mr-1" />
                {featuredArticle.readTime}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{featuredArticle.source}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                {featuredArticle.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{featuredArticle.summary}</p>
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
          </div>
        </div>
      </motion.div>
    </section>
  )
}
