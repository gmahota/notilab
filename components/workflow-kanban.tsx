"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { WorkflowItemDialog } from "./workflow-item-dialog"
import { User, Calendar, Eye, MessageSquare } from "lucide-react"

interface WorkflowKanbanProps {
  user: any
  filters: {
    assignee: string
    status: string
  }
}

export function WorkflowKanban({ user, filters }: WorkflowKanbanProps) {
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [showDialog, setShowDialog] = useState(false)

  const columns = [
    {
      id: "DRAFT",
      title: "Rascunho",
      color: "bg-gray-600",
      items: [
        {
          id: "1",
          title: "IA na medicina portuguesa",
          author: "João Redator",
          assignedTo: "João Redator",
          priority: "HIGH",
          dueDate: "2024-01-20",
          category: "Tecnologia",
          comments: 2,
        },
      ],
    },
    {
      id: "WRITING",
      title: "Em Redação",
      color: "bg-blue-600",
      items: [
        {
          id: "2",
          title: "Eleições presidenciais 2024",
          author: "Maria Silva",
          assignedTo: "Maria Silva",
          priority: "URGENT",
          dueDate: "2024-01-18",
          category: "Política",
          comments: 5,
        },
      ],
    },
    {
      id: "REVIEW",
      title: "Em Revisão",
      color: "bg-yellow-600",
      items: [
        {
          id: "3",
          title: "Benfica vence clássico",
          author: "Pedro Santos",
          assignedTo: "Maria Revisora",
          priority: "NORMAL",
          dueDate: "2024-01-19",
          category: "Desporto",
          comments: 1,
        },
      ],
    },
    {
      id: "APPROVAL",
      title: "Aprovação",
      color: "bg-purple-600",
      items: [
        {
          id: "4",
          title: "Inflação em Portugal",
          author: "Ana Economia",
          assignedTo: "Supervisor",
          priority: "HIGH",
          dueDate: "2024-01-17",
          category: "Economia",
          comments: 3,
        },
      ],
    },
    {
      id: "PUBLISHED",
      title: "Publicado",
      color: "bg-green-600",
      items: [
        {
          id: "5",
          title: "Festival de cinema de Lisboa",
          author: "Carlos Cultura",
          assignedTo: null,
          priority: "NORMAL",
          dueDate: "2024-01-16",
          category: "Cultura",
          comments: 0,
        },
      ],
    },
  ]

  const handleItemClick = (item: any) => {
    setSelectedItem(item)
    setShowDialog(true)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-600"
      case "HIGH":
        return "bg-orange-600"
      case "NORMAL":
        return "bg-blue-600"
      default:
        return "bg-gray-600"
    }
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
    <>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 overflow-x-auto">
        {columns.map((column) => (
          <div key={column.id} className="min-w-80">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${column.color} mr-2`} />
                    {column.title}
                  </div>
                  <Badge variant="outline" className="text-gray-400">
                    {column.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {column.items.map((item) => (
                  <Card
                    key={item.id}
                    className="bg-gray-800 border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => handleItemClick(item)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="text-white font-medium text-sm leading-tight">{item.title}</h4>
                        <Badge className={`${getPriorityColor(item.priority)} text-white text-xs`}>
                          {item.priority}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <Badge style={{ backgroundColor: getCategoryColor(item.category) }} className="text-white">
                          {item.category}
                        </Badge>
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(item.dueDate).toLocaleDateString("pt-PT")}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-blue-600 text-white">
                              {item.author
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-400">{item.author}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {item.comments > 0 && (
                            <div className="flex items-center text-xs text-gray-400">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {item.comments}
                            </div>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white">
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {item.assignedTo && (
                        <div className="flex items-center text-xs text-gray-400">
                          <User className="w-3 h-3 mr-1" />
                          Atribuído a: {item.assignedTo}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {column.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Nenhum item nesta fase</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <WorkflowItemDialog
        item={selectedItem}
        open={showDialog}
        onOpenChange={setShowDialog}
        user={user}
        onUpdate={(updatedItem) => {
          // Implementar atualização do item
          console.log("Item atualizado:", updatedItem)
        }}
      />
    </>
  )
}
