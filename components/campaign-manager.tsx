"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Play, Pause, BarChart3, Target, Calendar, DollarSign } from "lucide-react"

interface CampaignManagerProps {
  user: any
}

export function CampaignManager({ user }: CampaignManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [campaigns] = useState([
    {
      id: "1",
      name: "Campanha IA & Tecnologia",
      type: "Email Marketing",
      status: "ACTIVE",
      budget: 1500,
      spent: 890,
      impressions: 45000,
      clicks: 1890,
      conversions: 67,
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    },
    {
      id: "2",
      name: "Promoção Newsletter Premium",
      type: "Social Media",
      status: "PAUSED",
      budget: 800,
      spent: 320,
      impressions: 28000,
      clicks: 1120,
      conversions: 34,
      startDate: "2024-01-15",
      endDate: "2024-02-15",
    },
    {
      id: "3",
      name: "Retargeting Leitores Ativos",
      type: "Display Ads",
      status: "ACTIVE",
      budget: 2000,
      spent: 1450,
      impressions: 67000,
      clicks: 2340,
      conversions: 89,
      startDate: "2024-01-10",
      endDate: "2024-02-10",
    },
  ])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ACTIVE: { label: "Ativa", color: "bg-green-600" },
      PAUSED: { label: "Pausada", color: "bg-yellow-600" },
      COMPLETED: { label: "Concluída", color: "bg-blue-600" },
      DRAFT: { label: "Rascunho", color: "bg-gray-600" },
    }
    const config = statusConfig[status as keyof typeof statusConfig]
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>
  }

  const getTypeColor = (type: string) => {
    const colors = {
      "Email Marketing": "#3B82F6",
      "Social Media": "#8B5CF6",
      "Display Ads": "#10B981",
      "Search Ads": "#F59E0B",
    }
    return colors[type as keyof typeof colors] || "#6B7280"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestão de Campanhas</h2>
          <p className="text-gray-400">Criar e gerir campanhas de marketing digital</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Campanhas Ativas</CardTitle>
            <Play className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{campaigns.filter((c) => c.status === "ACTIVE").length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Budget Total</CardTitle>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              €{campaigns.reduce((acc, c) => acc + c.budget, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Impressões</CardTitle>
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {campaigns.reduce((acc, c) => acc + c.impressions, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Conversões</CardTitle>
            <Target className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{campaigns.reduce((acc, c) => acc + c.conversions, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">{campaign.name}</CardTitle>
                  <CardDescription className="text-gray-400 flex items-center space-x-4 mt-1">
                    <Badge style={{ backgroundColor: getTypeColor(campaign.type) }} className="text-white">
                      {campaign.type}
                    </Badge>
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(campaign.startDate).toLocaleDateString("pt-PT")} -{" "}
                      {new Date(campaign.endDate).toLocaleDateString("pt-PT")}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(campaign.status)}
                  <Button variant="outline" size="sm">
                    {campaign.status === "ACTIVE" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Budget</p>
                  <p className="text-white font-medium">€{campaign.budget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Gasto</p>
                  <p className="text-white font-medium">€{campaign.spent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Impressões</p>
                  <p className="text-white font-medium">{campaign.impressions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Cliques</p>
                  <p className="text-white font-medium">{campaign.clicks.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">CTR</p>
                  <p className="text-white font-medium">
                    {((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Conversões</p>
                  <p className="text-white font-medium">{campaign.conversions}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex-1 bg-gray-800 rounded-full h-2 mr-4">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                  />
                </div>
                <span className="text-gray-400 text-sm">
                  {Math.round((campaign.spent / campaign.budget) * 100)}% do budget
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Campanha</DialogTitle>
            <DialogDescription className="text-gray-400">Criar uma nova campanha de marketing</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-300">
                  Nome da Campanha
                </Label>
                <Input
                  id="name"
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="Ex: Campanha Verão 2024"
                />
              </div>
              <div>
                <Label htmlFor="type" className="text-gray-300">
                  Tipo
                </Label>
                <Select>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="email">Email Marketing</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="display">Display Ads</SelectItem>
                    <SelectItem value="search">Search Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="budget" className="text-gray-300">
                  Budget (€)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="1000"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="startDate" className="text-gray-300">
                  Data de Início
                </Label>
                <Input id="startDate" type="date" className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-gray-300">
                  Data de Fim
                </Label>
                <Input id="endDate" type="date" className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
              <div>
                <Label htmlFor="target" className="text-gray-300">
                  Público-Alvo
                </Label>
                <Select>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Selecionar público" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all">Todos os Utilizadores</SelectItem>
                    <SelectItem value="subscribers">Subscribers</SelectItem>
                    <SelectItem value="active">Utilizadores Ativos</SelectItem>
                    <SelectItem value="new">Novos Utilizadores</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="description" className="text-gray-300">
              Descrição
            </Label>
            <Textarea
              id="description"
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="Descreva os objetivos da campanha..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">Criar Campanha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
