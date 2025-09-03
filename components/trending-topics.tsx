"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Flame, Clock } from "lucide-react"

const trendingTopics = [
  {
    id: 1,
    title: "Eleições Presidenciais 2024",
    category: "Política",
    trend: "+245%",
    timeAgo: "2h",
    isHot: true,
  },
  {
    id: 2,
    title: "Champions League Final",
    category: "Desporto",
    trend: "+189%",
    timeAgo: "1h",
    isHot: true,
  },
  {
    id: 3,
    title: "Nova Lei Laboral",
    category: "Economia",
    trend: "+156%",
    timeAgo: "3h",
    isHot: false,
  },
  {
    id: 4,
    title: "Festival de Cinema",
    category: "Cultura",
    trend: "+98%",
    timeAgo: "4h",
    isHot: false,
  },
  {
    id: 5,
    title: "Tecnologia IA",
    category: "Tecnologia",
    trend: "+234%",
    timeAgo: "1h",
    isHot: true,
  },
]

export function TrendingTopics() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="space-y-8">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-secondary" />
              <h2 className="text-3xl font-bold">Tendências Agora</h2>
            </div>
            <p className="text-muted-foreground">Os tópicos mais quentes do momento, atualizados em tempo real</p>
          </div>
        </div>

        {/* Trending Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendingTopics.map((topic, index) => (
            <Card
              key={topic.id}
              className={`p-4 cursor-pointer card-hover relative overflow-hidden ${
                topic.isHot ? "border-secondary/50 bg-secondary/5" : "border-border"
              }`}
            >
              {/* Hot indicator */}
              {topic.isHot && (
                <div className="absolute top-2 right-2">
                  <Flame className="h-4 w-4 text-secondary animate-pulse" />
                </div>
              )}

              <div className="space-y-3">
                {/* Category and Time */}
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    {topic.category}
                  </Badge>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {topic.timeAgo}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-foreground leading-tight">{topic.title}</h3>

                {/* Trend Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-secondary" />
                    <span className="text-sm font-medium text-secondary">{topic.trend}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">#{index + 1} Trending</div>
                </div>
              </div>

              {/* Glow effect for hot topics */}
              {topic.isHot && (
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/10 to-transparent opacity-50 pointer-events-none" />
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
