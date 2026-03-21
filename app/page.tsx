import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { TrendingTopics } from "@/components/trending-topics"
import { ExplainIt } from "@/components/explain-it"
import { SocialFeed } from "@/components/social-feed"
import { QuickActions } from "@/components/quick-actions"
import { PasteLink } from "@/components/paste-link"
import { DigestSubscription } from "@/components/digest-subscription"
import { ChatWidget } from "@/components/chat-widget"
import { Zap } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="relative">
        <HeroSection />
        <TrendingTopics />
        <PasteLink />
        <ExplainIt />
        <SocialFeed />
        <QuickActions />
        <DigestSubscription />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-gradient">NotiLab</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/feed" className="hover:text-foreground transition-colors">Feed</Link>
            <Link href="/chat" className="hover:text-foreground transition-colors">Chat</Link>
            <Link href="/profile" className="hover:text-foreground transition-colors">Profile</Link>
          </div>
          <p className="text-xs text-muted-foreground/60">&copy; 2026 NotiLab. AI-powered news intelligence.</p>
        </div>
      </footer>

      <ChatWidget />
    </div>
  )
}
