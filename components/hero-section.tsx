"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export function HeroSection() {
  const [query, setQuery] = useState("")
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/chat?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />

      {/* Animated gradient blobs */}
      <motion.div
        className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-gradient-shift"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[150px] animate-gradient-shift-delayed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center px-4 py-2 rounded-full glass border-primary/20 text-primary text-sm font-medium"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI-Powered News Intelligence
          </motion.div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]">
            <span className="text-foreground">Stop reading news.</span>
            <br />
            <span className="text-gradient">Start understanding them.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your AI breaks down what matters in seconds.
          </p>

          {/* AI Input */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-secondary/30 to-primary/50 rounded-2xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
              <div className="relative flex items-center glass rounded-2xl p-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Paste a news link or ask anything..."
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/60 text-base sm:text-lg px-4 py-3"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 py-3 text-base font-semibold glow-blue shrink-0"
                >
                  Ask NotiBot
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </motion.form>

          {/* Quick suggestions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-sm text-muted-foreground/60">Try:</span>
            {["What happened today?", "Explain the AI regulation", "Tech trends this week"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="text-sm px-3 py-1.5 rounded-full glass text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-200 cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
