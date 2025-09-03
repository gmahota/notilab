"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react"

interface WorkflowStatsProps {
  stats: {
    draft: number
    inReview: number
    approved: number
    published: number
    rejected: number
  }
}

export function WorkflowStats({ stats }: WorkflowStatsProps) {
  const cards = [
    {
      title: "Rascunhos",
      value: stats.draft,
      icon: FileText,
      color: "bg-gray-600",
      textColor: "text-gray-300",
    },
    {
      title: "Em Revisão",
      value: stats.inReview,
      icon: Clock,
      color: "bg-yellow-600",
      textColor: "text-yellow-300",
    },
    {
      title: "Aprovados",
      value: stats.approved,
      icon: CheckCircle,
      color: "bg-blue-600",
      textColor: "text-blue-300",
    },
    {
      title: "Publicados",
      value: stats.published,
      icon: CheckCircle,
      color: "bg-green-600",
      textColor: "text-green-300",
    },
    {
      title: "Rejeitados",
      value: stats.rejected,
      icon: XCircle,
      color: "bg-red-600",
      textColor: "text-red-300",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index} className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">{card.title}</CardTitle>
              <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.textColor}`}>{card.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
