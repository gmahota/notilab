"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Flame, Sparkles, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"

const trendingTopics = [
  {
    keyword: "AI Regulation EU",
    description: "European Parliament votes on landmark AI safety framework",
    volume: "2.1M",
    category: "Tech",
  },
  {
    keyword: "Climate Summit 2026",
    description: "World leaders gather for emergency climate action talks",
    volume: "1.8M",
    category: "World",
  },
  {
    keyword: "Quantum Computing",
    description: "Google achieves new quantum supremacy milestone",
    volume: "1.2M",
    category: "Science",
  },
  {
    keyword: "Champions League",
    description: "Semi-final draw shakes European football landscape",
    volume: "980K",
    category: "Sports",
  },
  {
    keyword: "Digital Euro",
    description: "ECB announces pilot launch date for digital currency",
    volume: "870K",
    category: "Economy",
  },
  {
    keyword: "Space Tourism",
    description: "First civilian orbital hotel opens reservations",
    volume: "750K",
    category: "Science",
  },
  {
    keyword: "Cybersecurity Alert",
    description: "Major vulnerability discovered in global infrastructure",
    volume: "1.5M",
    category: "Tech",
  },
  {
    keyword: "Electric Vehicles",
    description: "New battery tech promises 1000km range in compact cars",
    volume: "920K",
    category: "Tech",
  },
]

export function TrendingTopics() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-3">
          <Flame className="h-6 w-6 text-orange-500" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Trending Now</h2>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("left")}
            className="rounded-full glass hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("right")}
            className="rounded-full glass hover:bg-white/10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </motion.div>

      {/* Horizontal scroll */}
      <div ref={scrollRef} className="scroll-horizontal flex gap-4 pb-4">
        {trendingTopics.map((topic, index) => (
          <motion.div
            key={topic.keyword}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="min-w-[280px] max-w-[280px] shrink-0 group"
          >
            <div className="h-full glass rounded-2xl p-5 border border-border/50 hover:border-primary/40 transition-all duration-300 hover:glow-blue cursor-pointer flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs text-muted-foreground border-border/60">
                    {topic.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 text-secondary" />
                    {topic.volume}
                  </div>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                  {topic.keyword}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{topic.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Explain
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
