"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Flame, Clock, Users, Zap, ArrowRight } from "lucide-react"

const trendingNow = [
  { keyword: "Eleições 2024", volume: "+245%", category: "Política" },
  { keyword: "Champions League", volume: "+189%", category: "Desporto" },
  { keyword: "IA Regulamentação", volume: "+156%", category: "Tecnologia" },
  { keyword: "Festival Cinema", volume: "+98%", category: "Cultura" },
  { keyword: "Mercado Ações", volume: "+87%", category: "Economia" },
]

const quickStats = [
  { label: "Notícias Hoje", value: "1,234", icon: Clock },
  { label: "Utilizadores Ativos", value: "45.6K", icon: Users },
  { label: "Resumos IA", value: "2,890", icon: Zap },
]

export function TrendingSidebar() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center">
          <Zap className="h-4 w-4 mr-2 text-primary" />
          Estatísticas Rápidas
        </h3>
        <div className="space-y-3">
          {quickStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <span className="font-semibold text-primary">{stat.value}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Trending Topics */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-secondary" />
          Trending Agora
        </h3>
        <div className="space-y-3">
          {trendingNow.map((trend, index) => (
            <div
              key={trend.keyword}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  <span className="font-medium text-sm">{trend.keyword}</span>
                  {index < 3 && <Flame className="h-3 w-3 text-secondary" />}
                </div>
                <Badge variant="outline" className="text-xs">
                  {trend.category}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-secondary">{trend.volume}</div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full mt-4 text-primary">
          Ver Todas as Tendências
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Card>

      {/* AI Assistant Prompt */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold">NotiBot IA</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Pergunte-me qualquer coisa sobre as notícias ou peça resumos personalizados!
          </p>
          <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
            Conversar com IA
          </Button>
        </div>
      </Card>
    </div>
  )
}
