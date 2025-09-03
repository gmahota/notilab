import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { TrendingTopics } from "@/components/trending-topics"
import { CategoryGrid } from "@/components/category-grid"
import { NewsPreview } from "@/components/news-preview"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="relative">
        <HeroSection />
        <TrendingTopics />
        <CategoryGrid />
        <NewsPreview />
      </main>
    </div>
  )
}
