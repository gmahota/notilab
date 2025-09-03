"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye } from "lucide-react"

interface ReviewQueueProps {
  user: any
}

export function ReviewQueue({ user }: ReviewQueueProps) {
  const [queue] = useState([
    {
      id: "1",
      title: "IA revoluciona diagnósticos médicos",
      author: "João Redator",
      priority: "HIGH",
      dueDate: "2024-01-18",
      category: "Tecnologia",
      status: "REVIEW",
      assignedTo: "Maria Revisora",
      timeInQueue: "2h",
    },
    {
      id: "2",
      title: "Eleições presidenciais: análise completa",
      author: "Ana Política",
      priority: "URGENT",
      dueDate: "2024-01-17",
      category: "Política",
      status: "APPROVAL",
      assignedTo: "Supervisor",
      timeInQueue: "4h",
    },
    {
      id: "3",
      title: "Benfica conquista vitória histórica",
      author: "Pedro Desporto",
      priority: "NORMAL",
      dueDate: "2024-01-19",
      category: "Desporto",
      status: "REVIEW",
      assignedTo: "Maria Revisora",
      timeInQueue: "1h",
    },
  ])

  const myQueue = queue.filter((item) => item.assignedTo === user.name || user.role === "SUPERVISOR")

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "HIGH":
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      REVIEW: { label: "Em Revisão", color: "bg-yellow-600" },
      APPROVAL: { label: "Aprovação", color: "bg-purple-600" },
    }
    const config = statusConfig[status as keyof typeof statusConfig]
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      Tecnologia: "#3B82F6",
      Política: "#EF4444",
      Desporto: "#10B981",
      Economia: "#F59E0B",
      Cultura: "#8B5CF6",
    }
    return colors[category as keyof typeof colors] || "#6B7280"
  }

  return (
    <div className="space-y-6">
      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Minha Fila</CardTitle>
            <Clock className="w-4 h-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{myQueue.length}</div>
            <p className="text-xs text-gray-400">itens aguardando revisão</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Urgentes</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {myQueue.filter((item) => item.priority === "URGENT").length}
            </div>
            <p className="text-xs text-gray-400">requerem atenção imediata</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Tempo Médio</CardTitle>
            <Clock className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">2.5h</div>
            <p className="text-xs text-gray-400">tempo na fila</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Fila de Revisão</CardTitle>
          <CardDescription className="text-gray-400">
            Itens aguardando sua revisão ou aprovação ({myQueue.length} itens)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Artigo</TableHead>
                <TableHead className="text-gray-300">Autor</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Prazo</TableHead>
                <TableHead className="text-gray-300">Tempo na Fila</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myQueue.map((item) => (
                <TableRow key={item.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell className="text-white">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(item.priority)}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <Badge
                          style={{ backgroundColor: getCategoryColor(item.category) }}
                          className="text-white text-xs"
                        >
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs bg-blue-600 text-white">
                          {item.author
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-gray-300">{item.author}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-gray-300">{new Date(item.dueDate).toLocaleDateString("pt-PT")}</TableCell>
                  <TableCell className="text-gray-300">{item.timeInQueue}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-3 h-3 mr-1" />
                        Ver
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Aprovar
                      </Button>
                      <Button size="sm" variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
