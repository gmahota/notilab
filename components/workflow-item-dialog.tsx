"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { WorkflowComments } from "./workflow-comments"
import { CheckCircle, XCircle, ArrowRight, Clock, User, Calendar, MessageSquare } from "lucide-react"

interface WorkflowItemDialogProps {
  item: any
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
  onUpdate: (item: any) => void
}

export function WorkflowItemDialog({ item, open, onOpenChange, user, onUpdate }: WorkflowItemDialogProps) {
  const [comment, setComment] = useState("")
  const [newStatus, setNewStatus] = useState("")
  const [newAssignee, setNewAssignee] = useState("")

  if (!item) return null

  const canReview = ["REVISOR", "SUPERVISOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  const canApprove = ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  const canEdit = item.author === user.name || ["ADMIN", "SUPER_ADMIN"].includes(user.role)

  const handleApprove = () => {
    // Implementar aprovação
    onUpdate({ ...item, status: "APPROVED" })
    onOpenChange(false)
  }

  const handleReject = () => {
    if (!comment.trim()) {
      alert("Por favor, adicione um comentário explicando a rejeição")
      return
    }
    // Implementar rejeição
    onUpdate({ ...item, status: "REJECTED" })
    onOpenChange(false)
  }

  const handleMoveToNext = () => {
    const nextStatus = getNextStatus(item.status)
    if (nextStatus) {
      onUpdate({ ...item, status: nextStatus })
      onOpenChange(false)
    }
  }

  const getNextStatus = (currentStatus: string) => {
    const workflow = {
      DRAFT: "WRITING",
      WRITING: "REVIEW",
      REVIEW: "APPROVAL",
      APPROVAL: "PUBLISHED",
    }
    return workflow[currentStatus as keyof typeof workflow]
  }

  const getStatusColor = (status: string) => {
    const colors = {
      DRAFT: "bg-gray-600",
      WRITING: "bg-blue-600",
      REVIEW: "bg-yellow-600",
      APPROVAL: "bg-purple-600",
      PUBLISHED: "bg-green-600",
      REJECTED: "bg-red-600",
    }
    return colors[status as keyof typeof colors] || "bg-gray-600"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <span>{item.title}</span>
            <Badge className={`${getStatusColor(item.status)} text-white`}>{item.status}</Badge>
          </DialogTitle>
          <DialogDescription className="text-gray-400">Gerir workflow e revisão de conteúdo</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Item Details */}
            <div className="bg-gray-800 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center text-gray-300">
                  <User className="w-4 h-4 mr-2" />
                  <span>Autor: {item.author}</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Prazo: {new Date(item.dueDate).toLocaleDateString("pt-PT")}</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Prioridade: {item.priority}</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span>Categoria: {item.category}</span>
                </div>
              </div>

              {item.assignedTo && (
                <div className="flex items-center text-gray-300">
                  <Avatar className="w-6 h-6 mr-2">
                    <AvatarFallback className="text-xs bg-blue-600 text-white">
                      {item.assignedTo
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span>Atribuído a: {item.assignedTo}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {(canReview || canApprove || canEdit) && (
              <div className="bg-gray-800 p-4 rounded-lg space-y-4">
                <h3 className="text-white font-medium">Ações</h3>

                <div className="space-y-3">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Adicionar comentário ou feedback..."
                    className="bg-gray-700 border-gray-600 text-white"
                    rows={3}
                  />

                  <div className="flex flex-wrap gap-2">
                    {canEdit && (
                      <Button variant="outline" className="text-blue-400 border-blue-400 bg-transparent">
                        Editar Conteúdo
                      </Button>
                    )}

                    {canReview && item.status === "REVIEW" && (
                      <>
                        <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Aprovar
                        </Button>
                        <Button onClick={handleReject} variant="destructive">
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitar
                        </Button>
                      </>
                    )}

                    {canApprove && item.status === "APPROVAL" && (
                      <>
                        <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Publicar
                        </Button>
                        <Button onClick={handleReject} variant="destructive">
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitar
                        </Button>
                      </>
                    )}

                    {getNextStatus(item.status) && (
                      <Button onClick={handleMoveToNext} className="bg-blue-600 hover:bg-blue-700">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Avançar para {getNextStatus(item.status)}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assignment */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-white font-medium mb-3">Atribuição</h3>
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Atribuir a..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="joao">João Redator</SelectItem>
                  <SelectItem value="maria-silva">Maria Silva</SelectItem>
                  <SelectItem value="maria-revisora">Maria Revisora</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Change */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-white font-medium mb-3">Alterar Status</h3>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Novo status..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                  <SelectItem value="WRITING">Em Redação</SelectItem>
                  <SelectItem value="REVIEW">Em Revisão</SelectItem>
                  <SelectItem value="APPROVAL">Aguardando Aprovação</SelectItem>
                  <SelectItem value="PUBLISHED">Publicado</SelectItem>
                  <SelectItem value="REJECTED">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Comments */}
            <WorkflowComments itemId={item.id} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {comment.trim() && <Button className="bg-blue-600 hover:bg-blue-700">Adicionar Comentário</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
