import { Navigation } from "@/components/navigation"
import { NewsFeed } from "@/components/news-feed"
import { FilterBar } from "@/components/filter-bar"
import { SearchBar } from "@/components/search-bar"
import { TrendingSidebar } from "@/components/trending-sidebar"

export default function FeedPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Feed de Notícias</h1>
              <SearchBar />
            </div>
            <FilterBar />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* News Feed */}
            <div className="lg:col-span-3">
              <NewsFeed />
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <TrendingSidebar />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
