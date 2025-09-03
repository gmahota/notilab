"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WorkflowKanban } from "./workflow-kanban"
import { ReviewQueue } from "./review-queue"
import { WorkflowHistory } from "./workflow-history"
import { WorkflowStats } from "./workflow-stats"
import { GitBranch, Clock, CheckCircle, AlertTriangle, Users } from "lucide-react"

interface WorkflowManagerProps {
  user: any
}

export function WorkflowManager({ user }: WorkflowManagerProps) {
  const [activeTab, setActiveTab] = useState("kanban")
  const [filterAssignee, setFilterAssignee] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  const workflowStats = {
    draft: 12,
    inReview: 8,
    approved: 5,
    published: 23,
    rejected: 3,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <GitBranch className="w-8 h-8 mr-3 text-purple-400" />
            Workflow & Revisão
          </h1>
          <p className="text-gray-400 mt-1">Gerir fluxo de trabalho e processo de revisão de conteúdo</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className="bg-blue-600 text-white">
            <Users className="w-3 h-3 mr-1" />
            {user.role}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <WorkflowStats stats={workflowStats} />

      {/* Filters */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todos os Responsáveis</SelectItem>
                <SelectItem value="me">Atribuído a Mim</SelectItem>
                <SelectItem value="unassigned">Não Atribuído</SelectItem>
                <SelectItem value="joao">João Redator</SelectItem>
                <SelectItem value="maria">Maria Revisora</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="WRITING">Em Redação</SelectItem>
                <SelectItem value="REVIEW">Em Revisão</SelectItem>
                <SelectItem value="APPROVAL">Aguardando Aprovação</SelectItem>
                <SelectItem value="PUBLISHED">Publicado</SelectItem>
                <SelectItem value="REJECTED">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-gray-900 border-gray-800">
          <TabsTrigger value="kanban" className="text-gray-300 data-[state=active]:text-white">
            <GitBranch className="w-4 h-4 mr-2" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="queue" className="text-gray-300 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-2" />
            Fila de Revisão
          </TabsTrigger>
          <TabsTrigger value="history" className="text-gray-300 data-[state=active]:text-white">
            <CheckCircle className="w-4 h-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-gray-300 data-[state=active]:text-white">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <WorkflowKanban user={user} filters={{ assignee: filterAssignee, status: filterStatus }} />
        </TabsContent>

        <TabsContent value="queue">
          <ReviewQueue user={user} />
        </TabsContent>

        <TabsContent value="history">
          <WorkflowHistory user={user} />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="text-center py-12">
            <p className="text-gray-400">Analytics de workflow em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
