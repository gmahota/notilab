"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Link2, Loader2, Sparkles, Copy, Check, Share2, MessageCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface LinkAnalysis {
  title: string
  source: string
  summary: string
  explanation: string
  context: string
  shareText: string
  tags: string[]
  readTime: string
  sentiment: string
}

export function PasteLink() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LinkAnalysis | null>(null)
  const [copied, setCopied] = useState(false)

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/news/summarize-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      }
    } catch {
      // Silent fail — result stays null
    } finally {
      setLoading(false)
    }
  }

  const handleCopyShare = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsAppShare = () => {
    if (!result) return
    const text = encodeURIComponent(result.shareText)
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-secondary" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Paste a Link</h2>
        </div>
        <p className="text-muted-foreground">
          Drop any news URL and get an instant AI breakdown — summary, explanation, context, and share-ready output.
        </p>

        {/* Input */}
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-secondary/30 to-primary/30 rounded-2xl blur opacity-40 group-hover:opacity-70 transition-opacity" />
            <div className="relative flex items-center glass rounded-2xl p-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article..."
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 text-base px-4 py-3"
                required
              />
              <Button
                type="submit"
                disabled={loading || !url.trim()}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl px-6 py-3 font-semibold glow-green shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl border border-border/50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-border/30">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{result.source}</p>
                    <h3 className="text-lg font-bold text-foreground">{result.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{result.readTime}</Badge>
                    <Badge className={
                      result.sentiment === "positive" ? "bg-green-500/10 text-green-400" :
                      result.sentiment === "negative" ? "bg-red-500/10 text-red-400" :
                      "bg-blue-500/10 text-blue-400"
                    }>
                      {result.sentiment}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Summary */}
                <div>
                  <h4 className="text-sm font-semibold text-primary mb-2">📋 Summary</h4>
                  <p className="text-foreground/90 text-sm leading-relaxed">{result.summary}</p>
                </div>

                {/* Explanation */}
                <div>
                  <h4 className="text-sm font-semibold text-secondary mb-2">💡 Explanation</h4>
                  <p className="text-foreground/90 text-sm leading-relaxed">{result.explanation}</p>
                </div>

                {/* Context */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">🔍 Context</h4>
                  <p className="text-foreground/80 text-sm leading-relaxed">{result.context}</p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>

              {/* Share Actions */}
              <div className="p-5 border-t border-border/30 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyShare}
                  className="rounded-xl"
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied!" : "Copy Summary"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWhatsAppShare}
                  className="rounded-xl text-green-400 border-green-400/30 hover:bg-green-400/10"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = encodeURIComponent(result.shareText)
                    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer")
                  }}
                  className="rounded-xl"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share on X
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
