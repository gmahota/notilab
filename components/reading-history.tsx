"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Search, BookOpen, Eye, Heart, Calendar, TrendingUp } from "lucide-react"

const readingHistory = [
  {
    id: "1",
    title: "Nova Regulamentação de IA Aprovada na Europa",
    category: "Política",
    readAt: new Date("2024-01-15T10:30:00Z"),
    timeSpent: 240, // seconds
    completed: true,
    liked: true,
    shared: false,
    source: "TechNews EU",
  },
  {
    id: "2",
    title: "Benfica Conquista Vitória Histórica na Champions",
    category: "Desporto",
    readAt: new Date("2024-01-15T09:15:00Z"),
    timeSpent: 180,
    completed: true,
    liked: true,
    shared: true,
    source: "Desporto Total",
  },
  {
    id: "3",
    title: "Festival de Cinema de Lisboa Anuncia Programação",
    category: "Cultura",
    readAt: new Date("2024-01-14T16:45:00Z"),
    timeSpent: 320,
    completed: false,
    liked: false,
    shared: false,
    source: "Cultura Hoje",
  },
  {
    id: "4",
    title: "Mercados Sobem Após Anúncios do BCE",
    category: "Economia",
    readAt: new Date("2024-01-14T14:20:00Z"),
    timeSpent: 150,
    completed: true,
    liked: false,
    shared: false,
    source: "Economia PT",
  },
  {
    id: "5",
    title: "Startup Portuguesa Recebe Investimento Milionário",
    category: "Tecnologia",
    readAt: new Date("2024-01-13T11:30:00Z"),
    timeSpent: 200,
    completed: true,
    liked: true,
    shared: true,
    source: "Tech Portugal",
  },
]

const readingStats = {
  totalArticles: 156,
  totalTime: 2340, // minutes
  averageTime: 15, // minutes per article
  completionRate: 85, // percentage
  favoriteCategory: "Tecnologia",
  streak: 7,
}

export function ReadingHistory() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("recent")

  const formatTimeSpent = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const filteredHistory = readingHistory
    .filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === "all" || item.category.toLowerCase() === categoryFilter
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return b.readAt.getTime() - a.readAt.getTime()
        case "time":
          return b.timeSpent - a.timeSpent
        case "category":
          return a.category.localeCompare(b.category)
        default:
          return 0
      }
    })

  return (
    <div className="space-y-6">
      {/* Reading Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold">{readingStats.totalArticles}</div>
            <div className="text-sm text-muted-foreground">Artigos Lidos</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto text-secondary mb-2" />
            <div className="text-2xl font-bold">{Math.floor(readingStats.totalTime / 60)}h</div>
            <div className="text-sm text-muted-foreground">Tempo Total</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold">{readingStats.completionRate}%</div>
            <div className="text-sm text-muted-foreground">Taxa Conclusão</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-8 w-8 mx-auto text-secondary mb-2" />
            <div className="text-2xl font-bold">{readingStats.streak}</div>
            <div className="text-sm text-muted-foreground">Dias Seguidos</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Leitura</CardTitle>
          <CardDescription>Acompanhe seu progresso e reveja artigos anteriores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar no histórico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="política">Política</SelectItem>
                <SelectItem value="desporto">Desporto</SelectItem>
                <SelectItem value="cultura">Cultura</SelectItem>
                <SelectItem value="economia">Economia</SelectItem>
                <SelectItem value="tecnologia">Tecnologia</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais Recente</SelectItem>
                <SelectItem value="time">Tempo Leitura</SelectItem>
                <SelectItem value="category">Categoria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* History List */}
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    {item.completed && (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                        Completo
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <Badge variant="secondary">{item.category}</Badge>
                    <span>{item.source}</span>
                    <span>{formatDate(item.readAt)}</span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeSpent(item.timeSpent)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {item.liked && <Heart className="h-4 w-4 text-red-500 fill-current" />}
                  {item.shared && <TrendingUp className="h-4 w-4 text-blue-500" />}
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum artigo encontrado com os filtros selecionados.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
