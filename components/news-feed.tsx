"use client"

import { useState } from "react"
import { NewsCard } from "@/components/news-card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

// Mock data - will be replaced with API calls
const mockNews = [
  {
    id: "1",
    title: "Nova Regulamentação de IA Aprovada na Europa",
    summary:
      "O Parlamento Europeu aprovou uma lei histórica que estabelece regras rigorosas para o desenvolvimento e uso de inteligência artificial, impactando empresas tecnológicas globalmente.",
    content: "A nova legislação europeia sobre IA representa um marco regulatório...",
    imageUrl: "/european-parliament-ai-law.png",
    sourceUrl: "https://example.com/news/1",
    sourceName: "TechNews EU",
    publishedAt: new Date("2024-01-15T10:30:00Z"),
    category: { name: "Política", slug: "politica", color: "#ef4444" },
    tags: ["IA", "Europa", "Regulamentação", "Tecnologia"],
    trending: true,
    priority: "HIGH" as const,
    aiSummary: "Lei europeia estabelece regras para IA, focando em transparência e segurança.",
    sentiment: "neutral",
    readTime: 4,
    reactions: [
      { type: "LIKE" as const, count: 234 },
      { type: "LOVE" as const, count: 89 },
      { type: "SHARE" as const, count: 156 },
    ],
    views: 12500,
    author: "Ana Silva",
  },
  {
    id: "2",
    title: "Benfica Conquista Vitória Histórica na Champions",
    summary:
      "O Sport Lisboa e Benfica venceu por 3-1 no Estádio da Luz, garantindo classificação para as quartas de final da Liga dos Campeões após 10 anos.",
    content: "Uma noite mágica no Estádio da Luz...",
    imageUrl: "/benfica-football-stadium-celebration.png",
    sourceUrl: "https://example.com/news/2",
    sourceName: "Desporto Total",
    publishedAt: new Date("2024-01-15T22:45:00Z"),
    category: { name: "Desporto", slug: "desporto", color: "#22c55e" },
    tags: ["Benfica", "Champions League", "Futebol"],
    trending: true,
    priority: "HIGH" as const,
    aiSummary: "Benfica vence 3-1 e avança para quartas da Champions após década.",
    sentiment: "positive",
    readTime: 3,
    reactions: [
      { type: "LIKE" as const, count: 1890 },
      { type: "LOVE" as const, count: 567 },
      { type: "SHARE" as const, count: 234 },
    ],
    views: 25600,
    author: "João Santos",
  },
  {
    id: "3",
    title: "Festival de Cinema de Lisboa Anuncia Programação 2024",
    summary:
      "O prestigiado festival apresenta uma seleção diversificada com filmes inéditos, documentários premiados e homenagens a cineastas portugueses.",
    content: "A 25ª edição do Festival de Cinema de Lisboa...",
    imageUrl: "/lisbon-cinema-festival-red-carpet.png",
    sourceUrl: "https://example.com/news/3",
    sourceName: "Cultura Hoje",
    publishedAt: new Date("2024-01-15T14:20:00Z"),
    category: { name: "Cultura", slug: "cultura", color: "#8b5cf6" },
    tags: ["Cinema", "Lisboa", "Festival", "Arte"],
    trending: false,
    priority: "NORMAL" as const,
    aiSummary: "Festival de Cinema de Lisboa revela programação diversificada para 2024.",
    sentiment: "positive",
    readTime: 5,
    reactions: [
      { type: "LIKE" as const, count: 456 },
      { type: "LOVE" as const, count: 123 },
      { type: "SHARE" as const, count: 78 },
    ],
    views: 8900,
    author: "Maria Costa",
  },
]

export function NewsFeed() {
  const [news, setNews] = useState(mockNews)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const loadMore = async () => {
    setLoading(true)
    // Simulate loading more news
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{news.length} notícias encontradas</h2>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* News Cards */}
      <div className="space-y-6">
        {news.map((article, index) => (
          <NewsCard key={article.id} news={article} priority={index < 2 ? "featured" : "normal"} />
        ))}
      </div>

      {/* Load More */}
      <div className="text-center">
        <Button variant="outline" onClick={loadMore} disabled={loading} className="w-full sm:w-auto bg-transparent">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando...
            </>
          ) : (
            "Carregar Mais Notícias"
          )}
        </Button>
      </div>
    </div>
  )
}
