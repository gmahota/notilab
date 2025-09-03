"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AdminSidebar } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"
import { StatsCards } from "./stats-cards"
import { RecentActivity } from "./recent-activity"
import { NewsChart } from "./news-chart"
import { UserChart } from "./user-chart"
import { Users, FileText, TrendingUp, Clock, AlertTriangle } from "lucide-react"

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

interface AdminDashboardProps {
  user: AdminUser
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalNews: 0,
    totalViews: 0,
    pendingReviews: 0,
    todayNews: 0,
    activeUsers: 0,
  })

  useEffect(() => {
    // Mock data - em produção, buscar do banco
    setStats({
      totalUsers: 12543,
      totalNews: 8921,
      totalViews: 156789,
      pendingReviews: 23,
      todayNews: 45,
      activeUsers: 892,
    })
  }, [])

  return (
    <div className="flex h-screen bg-gray-950">
      <AdminSidebar userRole={user.role} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={user} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-gray-400 mt-1">Bem-vindo de volta, {user.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-green-400 border-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                  Sistema Online
                </Badge>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <FileText className="w-4 h-4 mr-2" />
                  Nova Notícia
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <StatsCards stats={stats} />

            {/* Charts and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* News Chart */}
              <div className="lg:col-span-2">
                <NewsChart />
              </div>

              {/* Recent Activity */}
              <div>
                <RecentActivity />
              </div>
            </div>

            {/* User Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UserChart />

              {/* Quick Actions */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-blue-400" />
                    Ações Rápidas
                  </CardTitle>
                  <CardDescription className="text-gray-400">Tarefas pendentes e ações importantes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-yellow-900/20 rounded-lg border border-yellow-800">
                    <div className="flex items-center">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mr-3" />
                      <div>
                        <p className="text-white font-medium">Notícias Pendentes</p>
                        <p className="text-gray-400 text-sm">{stats.pendingReviews} aguardando revisão</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-yellow-600 text-yellow-400 bg-transparent">
                      Revisar
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-800">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-blue-400 mr-3" />
                      <div>
                        <p className="text-white font-medium">Novos Usuários</p>
                        <p className="text-gray-400 text-sm">156 registos hoje</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-400 bg-transparent">
                      Ver Todos
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-900/20 rounded-lg border border-green-800">
                    <div className="flex items-center">
                      <TrendingUp className="w-5 h-5 text-green-400 mr-3" />
                      <div>
                        <p className="text-white font-medium">Trending Topics</p>
                        <p className="text-gray-400 text-sm">Atualizar sugestões</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="border-green-600 text-green-400 bg-transparent">
                      Atualizar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
