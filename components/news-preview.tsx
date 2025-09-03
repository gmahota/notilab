"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, Eye, Heart, Share, MessageCircle, Sparkles, ArrowRight } from "lucide-react"

const newsPreview = [
  {
    id: 1,
    title: "Nova Lei de IA Aprovada no Parlamento Europeu",
    summary:
      "Regulamentação histórica estabelece regras para inteligência artificial, impactando empresas tecnológicas globalmente.",
    category: "Política",
    readTime: "3 min",
    timeAgo: "2h",
    views: "12.5K",
    likes: 234,
    image: "https://rthfa4e7dp.ufs.sh/f/RNuPxz0WoMGfW5fuy64j1HOuVxih6IDJXG0UqcQTMweyCF52",
    author: "Ana Silva",
    isBreaking: true,
  },
  {
    id: 2,
    title: "Benfica Vence Clássico e Lidera Campeonato",
    summary: "Vitória por 2-1 no Estádio da Luz coloca as águias na liderança isolada do campeonato nacional.",
    category: "Desporto",
    readTime: "2 min",
    timeAgo: "4h",
    views: "8.9K",
    likes: 189,
    image: "https://rthfa4e7dp.ufs.sh/f/RNuPxz0WoMGfvbSZk0YxdUBSlxE4opQi8hyaLr2ju3MXO5Rt",
    author: "João Santos",
    isBreaking: false,
  },
  {
    id: 3,
    title: "Festival de Cinema de Lisboa Anuncia Programação",
    summary: "Evento cultural apresenta filmes inéditos e homenagens a cineastas portugueses de renome internacional.",
    category: "Cultura",
    readTime: "4 min",
    timeAgo: "6h",
    views: "5.2K",
    likes: 156,
    image: "https://rthfa4e7dp.ufs.sh/f/RNuPxz0WoMGfk3AWNBoighzaXW5CGle9V3ISRytukMvrZf7F",
    author: "Maria Costa",
    isBreaking: false,
  },
]

export function NewsPreview() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="space-y-8">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Últimas Notícias</h2>
            <p className="text-muted-foreground">Resumos inteligentes das notícias mais importantes</p>
          </div>
          <Button variant="outline" className="hidden sm:flex bg-transparent">
            Ver Todas
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* News Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {newsPreview.map((news, index) => (
            <Card
              key={news.id}
              className={`overflow-hidden cursor-pointer card-hover ${
                index === 0 ? "lg:col-span-2 lg:row-span-2" : ""
              }`}
            >
              {/* Image */}
              <div className="relative">
                <img
                  src={news.image || "/placeholder.svg"}
                  alt={news.title}
                  className={`w-full object-cover ${index === 0 ? "h-64 lg:h-80" : "h-48"}`}
                />

                {/* Breaking Badge */}
                {news.isBreaking && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                      <Sparkles className="h-3 w-3 mr-1" />
                      BREAKING
                    </Badge>
                  </div>
                )}

                {/* Category Badge */}
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    {news.category}
                  </Badge>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Title */}
                <h3 className={`font-bold leading-tight ${index === 0 ? "text-xl lg:text-2xl" : "text-lg"}`}>
                  {news.title}
                </h3>

                {/* Summary */}
                <p className="text-muted-foreground leading-relaxed">{news.summary}</p>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{news.readTime}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="h-4 w-4" />
                      <span>{news.views}</span>
                    </div>
                  </div>
                  <span>{news.timeAgo}</span>
                </div>

                {/* Author and Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src="/journalist-avatar.png" />
                      <AvatarFallback className="text-xs">
                        {news.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{news.author}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <Heart className="h-4 w-4" />
                      <span className="ml-1 text-xs">{news.likes}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <Share className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Mobile View All Button */}
        <div className="sm:hidden text-center">
          <Button variant="outline" className="w-full bg-transparent">
            Ver Todas as Notícias
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  )
}
