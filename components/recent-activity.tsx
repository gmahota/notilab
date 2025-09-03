"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, User, Eye, MessageSquare, Clock } from "lucide-react"

export function RecentActivity() {
  const activities = [
    {
      id: 1,
      type: "news_published",
      title: "Nova notícia publicada",
      description: "IA revoluciona diagnósticos médicos",
      user: "João Redator",
      time: "há 5 min",
      icon: FileText,
      color: "green",
    },
    {
      id: 2,
      type: "user_registered",
      title: "Novo utilizador registado",
      description: "maria.silva@email.com",
      user: "Sistema",
      time: "há 12 min",
      icon: User,
      color: "blue",
    },
    {
      id: 3,
      type: "news_reviewed",
      title: "Notícia aprovada",
      description: "Eleições presidenciais 2024",
      user: "Maria Revisora",
      time: "há 23 min",
      icon: Eye,
      color: "purple",
    },
    {
      id: 4,
      type: "chat_session",
      title: "Sessão de chat iniciada",
      description: "Utilizador perguntou sobre economia",
      user: "NotiBot",
      time: "há 35 min",
      icon: MessageSquare,
      color: "yellow",
    },
    {
      id: 5,
      type: "news_draft",
      title: "Rascunho criado",
      description: "Mudanças climáticas em Portugal",
      user: "Ana Criadora",
      time: "há 1h",
      icon: Clock,
      color: "gray",
    },
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      green: "bg-green-600",
      blue: "bg-blue-600",
      purple: "bg-purple-600",
      yellow: "bg-yellow-600",
      gray: "bg-gray-600",
    }
    return colors[color as keyof typeof colors] || "bg-gray-600"
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Atividade Recente</CardTitle>
        <CardDescription className="text-gray-400">Últimas ações no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div
                  className={`w-8 h-8 rounded-full ${getColorClasses(activity.color)} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{activity.title}</p>
                  <p className="text-sm text-gray-400 truncate">{activity.description}</p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="text-xs text-gray-500">{activity.user}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
