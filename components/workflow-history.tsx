"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Clock, CheckCircle, XCircle, ArrowRight } from "lucide-react"

interface WorkflowHistoryProps {
  user: any
}

export function WorkflowHistory({ user }: WorkflowHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState("all")

  const history = [
    {
      id: "1",
      action: "APPROVED",
      itemTitle: "IA revoluciona diagnósticos médicos",
      user: "Maria Revisora",
      timestamp: "2024-01-15T16:30:00Z",
      comment: "Artigo excelente, aprovado para publicação",
      fromStatus: "REVIEW",
      toStatus: "APPROVED",
    },
    {
      id: "2",
      action: "REJECTED",
      itemTitle: "Análise política controversa",
      user: "Supervisor",
      timestamp: "2024-01-15T14:20:00Z",
      comment: "Necessita de mais fontes e verificação de factos",
      fromStatus: "APPROVAL",
      toStatus: "REJECTED",
    },
    {
      id: "3",
      action: "MOVED",
      itemTitle: "Benfica vence clássico",
      user: "Pedro Santos",
      timestamp: "2024-01-15T12:15:00Z",
      comment: "Artigo finalizado, enviado para revisão",
      fromStatus: "WRITING",
      toStatus: "REVIEW",
    },
    {
      id: "4",
      action: "PUBLISHED",
      itemTitle: "Festival de cinema de Lisboa",
      user: "Sistema",
      timestamp: "2024-01-15T10:00:00Z",
      comment: "Artigo publicado automaticamente",
      fromStatus: "APPROVED",
      toStatus: "PUBLISHED",
    },
  ]

  const getActionIcon = (action: string) => {
    switch (action) {
      case "APPROVED":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "REJECTED":
        return <XCircle className="w-4 h-4 text-red-500" />
      case "MOVED":
        return <ArrowRight className="w-4 h-4 text-blue-500" />
      case "PUBLISHED":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "APPROVED":
        return "bg-green-600"
      case "REJECTED":
        return "bg-red-600"
      case "MOVED":
        return "bg-blue-600"
      case "PUBLISHED":
        return "bg-green-600"
      default:
        return "bg-gray-600"
    }
  }

  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.itemTitle.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAction = filterAction === "all" || item.action === filterAction
    return matchesSearch && matchesAction
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Pesquisar no histórico..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="APPROVED">Aprovado</SelectItem>
                <SelectItem value="REJECTED">Rejeitado</SelectItem>
                <SelectItem value="MOVED">Movido</SelectItem>
                <SelectItem value="PUBLISHED">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Histórico de Workflow</CardTitle>
          <CardDescription className="text-gray-400">
            Registo completo de todas as ações de workflow ({filteredHistory.length} entradas)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredHistory.map((item, index) => (
              <div key={item.id} className="flex items-start space-x-4 pb-4 border-b border-gray-800 last:border-b-0">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    {getActionIcon(item.action)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-white font-medium">{item.itemTitle}</h4>
                      <Badge className={`${getActionColor(item.action)} text-white`}>{item.action}</Badge>
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(item.timestamp).toLocaleString("pt-PT")}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-xs bg-blue-600 text-white">
                        {item.user
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-gray-300 text-sm">{item.user}</span>
                    {item.fromStatus && item.toStatus && (
                      <div className="flex items-center text-xs text-gray-400">
                        <span>{item.fromStatus}</span>
                        <ArrowRight className="w-3 h-3 mx-1" />
                        <span>{item.toStatus}</span>
                      </div>
                    )}
                  </div>

                  {item.comment && <p className="text-gray-400 text-sm">{item.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
