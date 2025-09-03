"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, Send, Users, Eye, MousePointer, Calendar, Plus } from "lucide-react"

interface NewsletterManagerProps {
  user: any
}

export function NewsletterManager({ user }: NewsletterManagerProps) {
  const [newsletters] = useState([
    {
      id: "1",
      subject: "Resumo Semanal: IA e Tecnologia",
      status: "SENT",
      sentDate: "2024-01-15",
      recipients: 15420,
      openRate: 24.8,
      clickRate: 4.2,
      template: "weekly-digest",
    },
    {
      id: "2",
      subject: "Breaking: Eleições Presidenciais 2024",
      status: "DRAFT",
      sentDate: null,
      recipients: 0,
      openRate: 0,
      clickRate: 0,
      template: "breaking-news",
    },
    {
      id: "3",
      subject: "Newsletter Premium: Análise Económica",
      status: "SCHEDULED",
      sentDate: "2024-01-20",
      recipients: 8900,
      openRate: 0,
      clickRate: 0,
      template: "premium",
    },
  ])

  const [subscribers] = useState([
    { segment: "Todos os Subscribers", count: 15420, growth: "+12.5%" },
    { segment: "Premium", count: 8900, growth: "+8.3%" },
    { segment: "Tecnologia", count: 6200, growth: "+15.2%" },
    { segment: "Política", count: 4800, growth: "+6.7%" },
    { segment: "Desporto", count: 3900, growth: "+9.1%" },
  ])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      SENT: { label: "Enviada", color: "bg-green-600" },
      DRAFT: { label: "Rascunho", color: "bg-gray-600" },
      SCHEDULED: { label: "Agendada", color: "bg-blue-600" },
      SENDING: { label: "Enviando", color: "bg-yellow-600" },
    }
    const config = statusConfig[status as keyof typeof statusConfig]
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="newsletters" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-gray-900 border-gray-800">
          <TabsTrigger value="newsletters" className="text-gray-300 data-[state=active]:text-white">
            <Mail className="w-4 h-4 mr-2" />
            Newsletters
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="text-gray-300 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Subscribers
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-gray-300 data-[state=active]:text-white">
            <Calendar className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="newsletters" className="space-y-6">
          {/* Newsletter Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Enviadas</CardTitle>
                <Send className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">127</div>
                <p className="text-xs text-green-400">+8 este mês</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Taxa de Abertura</CardTitle>
                <Eye className="w-4 h-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">24.8%</div>
                <p className="text-xs text-green-400">+2.1% vs média</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Taxa de Clique</CardTitle>
                <MousePointer className="w-4 h-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">4.2%</div>
                <p className="text-xs text-green-400">+0.8% vs média</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Subscribers</CardTitle>
                <Users className="w-4 h-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">15,420</div>
                <p className="text-xs text-green-400">+12.5% este mês</p>
              </CardContent>
            </Card>
          </div>

          {/* Newsletter List */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Newsletters</CardTitle>
                  <CardDescription className="text-gray-400">Gerir campanhas de email marketing</CardDescription>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Newsletter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {newsletters.map((newsletter) => (
                  <div key={newsletter.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-white font-medium">{newsletter.subject}</h4>
                        {getStatusBadge(newsletter.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
                        <div>
                          <span>Recipients: </span>
                          <span className="text-white">{newsletter.recipients.toLocaleString()}</span>
                        </div>
                        <div>
                          <span>Open Rate: </span>
                          <span className="text-white">{newsletter.openRate}%</span>
                        </div>
                        <div>
                          <span>Click Rate: </span>
                          <span className="text-white">{newsletter.clickRate}%</span>
                        </div>
                        <div>
                          <span>Data: </span>
                          <span className="text-white">
                            {newsletter.sentDate ? new Date(newsletter.sentDate).toLocaleDateString("pt-PT") : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-3 h-3 mr-1" />
                        Ver
                      </Button>
                      {newsletter.status === "DRAFT" && (
                        \
