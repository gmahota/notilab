"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Loader2, Check, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

const CATEGORIES = [
  { slug: "politica", label: "Politics" },
  { slug: "desporto", label: "Sports" },
  { slug: "economia", label: "Economy" },
  { slug: "tecnologia", label: "Tech" },
  { slug: "cultura", label: "Culture" },
  { slug: "leis", label: "Laws" },
]

export function DigestSubscription() {
  const [email, setEmail] = useState("")
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    )
  }

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), frequency, categories: selectedCategories }),
      })
      if (res.ok) {
        setSuccess(true)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl border border-secondary/20 p-8 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-secondary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground">You&apos;re in! 🎉</h3>
          <p className="text-muted-foreground">
            Your {frequency} digest lands at <span className="text-foreground font-medium">{email}</span>.
          </p>
        </motion.div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass rounded-3xl border border-border/50 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="h-6 w-6 text-primary" />
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">AI Digest</h2>
          </div>
          <p className="text-muted-foreground">
            Top stories. AI-explained. In your inbox.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubscribe} className="p-6 sm:p-8 space-y-6">
          {/* Frequency */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Frequency</label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={frequency === "daily" ? "default" : "outline"}
                size="sm"
                onClick={() => setFrequency("daily")}
                className="rounded-xl"
              >
                <Sparkles className="h-3 w-3 mr-2" />
                Daily
              </Button>
              <Button
                type="button"
                variant={frequency === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => setFrequency("weekly")}
                className="rounded-xl"
              >
                Weekly
              </Button>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Topics (optional)</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat.slug}
                  className={`cursor-pointer transition-all ${
                    selectedCategories.includes(cat.slug)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => toggleCategory(cat.slug)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Email + Submit */}
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 bg-input/50 border border-border/50 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 font-semibold glow-blue shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60">
            No spam. Unsubscribe anytime.
          </p>
        </form>
      </motion.div>
    </section>
  )
}
