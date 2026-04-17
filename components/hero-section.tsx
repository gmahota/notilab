"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
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
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-[#050810]">
      {/* Dark gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050810] via-[#080e1c] to-[#050810]" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />

      {/* Blue glow blob — top-left */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[640px] h-[640px] rounded-full blur-[160px] animate-gradient-shift pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,123,255,0.28) 0%, transparent 70%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />

      {/* Neon-green glow blob — bottom-right */}
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[520px] h-[520px] rounded-full blur-[180px] animate-gradient-shift-delayed pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(57,255,20,0.2) 0%, transparent 70%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.6 }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/20 text-primary text-sm font-medium"
          >
            <Sparkles className="h-4 w-4" />
            News. Decoded instantly.
          </motion.div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05]">
            <span className="text-white">Understand the world</span>
            <br />
            <span className="text-gradient">in 30 seconds.</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl md:text-3xl text-white/45 font-light tracking-wide">
            No noise. Just clarity.
          </p>

          {/* Chat-style input */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="w-full max-w-2xl mx-auto"
          >
            <div className="relative group">
              {/* Animated glow ring */}
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-blue-500/60 via-green-400/40 to-blue-500/60 blur-md animate-glow-pulse opacity-70 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row items-stretch gap-3 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Drop a link or ask anything..."
                  autoComplete="off"
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-lg px-4 py-3"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl px-8 py-3 text-base font-semibold glow-blue shrink-0 transition-all duration-200"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Explain it
                </Button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </section>
  )
}
