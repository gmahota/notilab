"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Eye, Clock, TrendingUp, MessageSquare } from "lucide-react"

interface StatsCardsProps {
  stats: {
    totalUsers: number
    totalNews: number
    totalViews: number
    pendingReviews: number
    todayNews: number
    activeUsers: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total de Utilizadores",
      value: stats.totalUsers.toLocaleString(),
      change: "+12%",
      changeType: "positive" as const,
      icon: Users,
      color: "blue",
    },
    {
      title: "Notícias Publicadas",
      value: stats.totalNews.toLocaleString(),
      change: "+8%",
      changeType: "positive" as const,
      icon: FileText,
      color: "green",
    },
    {
      title: "Visualizações Totais",
      value: stats.totalViews.toLocaleString(),
      change: "+23%",
      changeType: "positive" as const,
      icon: Eye,
      color: "purple",
    },
    {
      title: "Pendentes Revisão",
      value: stats.pendingReviews.toString(),
      change: "-5%",
      changeType: "negative" as const,
      icon: Clock,
      color: "yellow",
    },
    {
      title: "Notícias Hoje",
      value: stats.todayNews.toString(),
      change: "+15%",
      changeType: "positive" as const,
      icon: TrendingUp,
      color: "indigo",
    },
    {
      title: "Utilizadores Ativos",
      value: stats.activeUsers.toLocaleString(),
      change: "+7%",
      changeType: "positive" as const,
      icon: MessageSquare,
      color: "pink",
    },
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      blue: "bg-blue-600",
      green: "bg-green-600",
      purple: "bg-purple-600",
      yellow: "bg-yellow-600",
      indigo: "bg-indigo-600",
      pink: "bg-pink-600",
    }
    return colors[color as keyof typeof colors] || "bg-gray-600"
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index} className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">{card.title}</CardTitle>
              <div className={`w-8 h-8 rounded-lg ${getColorClasses(card.color)} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <p className="text-xs text-gray-400 mt-1">
                <span className={`${card.changeType === "positive" ? "text-green-400" : "text-red-400"}`}>
                  {card.change}
                </span>{" "}
                desde o mês passado
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
