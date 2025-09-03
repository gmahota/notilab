"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, Eye, Heart, Share, Sparkles, TrendingUp, RefreshCw, Settings } from "lucide-react"

const personalizedNews = [
  {
    id: "1",
    title: "IA Generativa: Novos Modelos Multimodais Revolucionam Mercado",
    summary: "Baseado no seu interesse em tecnologia, esta notícia explora os avanços mais recentes em IA.",
    category: "Tecnologia",
    readTime: 4,
    timeAgo: "2h",
    views: "8.9K",
    likes: 234,
    image: "/placeholder.svg?key=ai-tech",
    author: "Tech Insider",
    relevanceScore: 95,
    personalizedReason: "Baseado no seu interesse em IA e tecnologia",
  },
  {
    id: "2",
    title: "Startup Portuguesa de Fintech Recebe €10M em Investimento",
    summary: "Empresa do Porto desenvolve soluções inovadoras para pagamentos digitais.",
    category: "Economia",
    readTime: 3,
    timeAgo: "4h",
    views: "5.2K",
    likes: 156,
    image: "/placeholder.svg?key=fintech",
    author: "Economia Digital",
    relevanceScore: 88,
    personalizedReason: "Artigos similares que você leu recentemente",
  },
  {
    id: "3",
    title: "Champions League: Análise Táctica da Vitória do Benfica",
    summary: "Estratégia defensiva e contra-ataques foram chave para o sucesso europeu.",
    category: "Desporto",
    readTime: 5,
    timeAgo: "6h",
    views: "12.1K",
    likes: 445,
    image: "/placeholder.svg?key=football",
    author: "Táctica Desportiva",
    relevanceScore: 82,
    personalizedReason: "Você leu 3 artigos sobre futebol esta semana",
  },
]

const recommendedTopics = [
  { name: "Inteligência Artificial", count: 12, trending: true },
  { name: "Criptomoedas", count: 8, trending: false },
  { name: "Sustentabilidade", count: 15, trending: true },
  { name: "Startups Portugal", count: 6, trending: false },
  { name: "Regulamentação Tech", count: 9, trending: true },
]

export function PersonalizedFeed() {
  const handleRefresh = () => {
    // TODO: Refresh personalized content
    console.log("Refreshing personalized feed...")
  }

  const formatViews = (views: string) => views

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Feed Personalizado</h2>
          <p className="text-muted-foreground">Conteúdo selecionado especialmente para você</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personalized Articles */}
        <div className="lg:col-span-2 space-y-6">
          {personalizedNews.map((article, index) => (
            <Card key={article.id} className="overflow-hidden cursor-pointer card-hover">
              <div className="grid md:grid-cols-3 gap-0">
                {/* Image */}
                <div className="relative">
                  <img
                    src={article.image || "/placeholder.svg"}
                    alt={article.title}
                    className="w-full h-48 md:h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-primary/90 text-primary-foreground">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {article.relevanceScore}% relevante
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="md:col-span-2 p-6 space-y-4">
                  {/* Category and Meta */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <Badge variant="secondary">{article.category}</Badge>
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{article.readTime} min</span>
                      </span>
                      <span>{article.timeAgo}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold leading-tight">{article.title}</h3>

                  {/* Summary */}
                  <p className="text-muted-foreground leading-relaxed">{article.summary}</p>

                  {/* Personalization Reason */}
                  <div className="flex items-center space-x-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary">{article.personalizedReason}</span>
                  </div>

                  {/* Stats and Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src="/journalist-avatar.png" />
                        <AvatarFallback className="text-xs">
                          {article.author
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{article.author}</span>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>{formatViews(article.views)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Heart className="h-4 w-4" />
                        <span>{article.likes}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Share className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recommended Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Tópicos Recomendados</span>
              </CardTitle>
              <CardDescription>Baseado nos seus interesses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendedTopics.map((topic) => (
                <div
                  key={topic.name}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">{topic.name}</span>
                    {topic.trending && <TrendingUp className="h-3 w-3 text-secondary" />}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {topic.count}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Personalization Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5" />
                <span>Insights Pessoais</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Categoria Favorita</div>
                <Badge className="bg-primary/10 text-primary border-primary/20">Tecnologia</Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Melhor Horário</div>
                <div className="text-sm text-muted-foreground">Manhã (9h-11h)</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Tempo Médio</div>
                <div className="text-sm text-muted-foreground">4 min por artigo</div>
              </div>

              <Button variant="outline" size="sm" className="w-full bg-transparent">
                Ver Análise Completa
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
