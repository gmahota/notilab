"use client"

import { Navigation } from "@/components/navigation"
import { DigestSubscription } from "@/components/digest-subscription"
import { ChatWidget } from "@/components/chat-widget"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Newspaper, Clock, Sparkles } from "lucide-react"

export default function DigestPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-gradient mb-3">AI News Digest</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get the news that matters, summarized by AI, delivered to your inbox.
            No noise. Pure signal.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Card className="glass">
            <CardContent className="p-6 text-center">
              <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">AI-Curated</h3>
              <p className="text-sm text-muted-foreground">
                Our AI ranks and selects the most impactful stories from hundreds of sources
              </p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-6 text-center">
              <Newspaper className="h-8 w-8 text-secondary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Personalized</h3>
              <p className="text-sm text-muted-foreground">
                Choose your categories and get only the topics you care about
              </p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-6 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Your Schedule</h3>
              <p className="text-sm text-muted-foreground">
                Daily or weekly — delivered when you want it, ready in 2 minutes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sample Digest Preview */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-center">Preview: Today&apos;s Digest</h2>
          <Card className="glass border-primary/20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gradient">NotiLab Daily Digest</h3>
                <Badge variant="outline" className="text-xs">Sample</Badge>
              </div>
              <div className="space-y-3">
                {[
                  { cat: "Tech", color: "#00D4FF", title: "Nuclear Fusion Achieves Net Energy Gain", score: 95 },
                  { cat: "Politics", color: "#007BFF", title: "EU Parliament Approves AI Safety Act", score: 92 },
                  { cat: "Economy", color: "#FFD23F", title: "ECB Cuts Rates for Third Time", score: 85 },
                  { cat: "Sports", color: "#39FF14", title: "Ronaldo Announces Retirement", score: 90 },
                  { cat: "Culture", color: "#FF6B35", title: "Portuguese Author Wins Nobel Prize", score: 88 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10">
                    <Badge style={{ backgroundColor: item.color }} className="text-white text-[10px] shrink-0">
                      {item.cat}
                    </Badge>
                    <span className="text-sm font-medium flex-1">{item.title}</span>
                    <span className="text-xs text-primary font-mono">{item.score}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">
                + TL;DR summaries, &quot;Why It Matters&quot; sections, and share links
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Form */}
        <DigestSubscription />
      </main>
      <ChatWidget />
    </div>
  )
}
