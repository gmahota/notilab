import { Navigation } from "@/components/navigation"
import { RedditNewsFeed } from "@/components/reddit-news-feed"

export default function RedditNewsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <RedditNewsFeed />
        </div>
      </main>
    </div>
  )
}

export const metadata = {
  title: "Notícias Reddit | NotiLab",
  description: "Notícias em tempo real do Reddit, traduzidas automaticamente para português",
}