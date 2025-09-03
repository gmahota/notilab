"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, Users, Eye, MousePointer, Share2 } from "lucide-react"

interface MarketingAnalyticsProps {
  stats: any
}

export function MarketingAnalytics({ stats }: MarketingAnalyticsProps) {
  const trafficData = [
    { name: "Jan", visitors: 4000, pageviews: 12000, conversions: 120 },
    { name: "Fev", visitors: 3000, pageviews: 9800, conversions: 98 },
    { name: "Mar", visitors: 5000, pageviews: 15600, conversions: 156 },
    { name: "Abr", visitors: 4500, pageviews: 14200, conversions: 142 },
    { name: "Mai", visitors: 6000, pageviews: 18900, conversions: 189 },
    { name: "Jun", visitors: 5500, pageviews: 17200, conversions: 172 },
  ]

  const channelData = [
    { name: "Orgânico", value: 45, color: "#10B981" },
    { name: "Social Media", value: 25, color: "#3B82F6" },
    { name: "Email", value: 15, color: "#8B5CF6" },
    { name: "Direto", value: 10, color: "#F59E0B" },
    { name: "Referral", value: 5, color: "#EF4444" },
  ]

  const engagementData = [
    { name: "Seg", likes: 120, shares: 45, comments: 30 },
    { name: "Ter", likes: 150, shares: 60, comments: 40 },
    { name: "Qua", likes: 180, shares: 75, comments: 55 },
    { name: "Qui", likes: 200, shares: 90, comments: 65 },
    { name: "Sex", likes: 250, shares: 110, comments: 80 },
    { name: "Sáb", likes: 180, shares: 70, comments: 50 },
    { name: "Dom", likes: 160, shares: 55, comments: 35 },
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filtros de Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Select defaultValue="30d">
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todos os Canais</SelectItem>
                <SelectItem value="organic">Tráfego Orgânico</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="email">Email Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Visitantes Únicos</CardTitle>
            <Users className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">28,543</div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12.5% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Page Views</CardTitle>
            <Eye className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">89,234</div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              +8.3% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Taxa de Clique</CardTitle>
            <MousePointer className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">4.2%</div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              +0.8% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Tempo na Página</CardTitle>
            <Eye className="w-4 h-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">3:42</div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              +15s vs mês anterior
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Trends */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Tendências de Tráfego</CardTitle>
            <CardDescription className="text-gray-400">Visitantes, page views e conversões</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#F9FAFB",
                  }}
                />
                <Line type="monotone" dataKey="visitors" stroke="#3B82F6" strokeWidth={2} name="Visitantes" />
                <Line type="monotone" dataKey="pageviews" stroke="#10B981" strokeWidth={2} name="Page Views" />
                <Line type="monotone" dataKey="conversions" stroke="#8B5CF6" strokeWidth={2} name="Conversões" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Traffic Sources */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Fontes de Tráfego</CardTitle>
            <CardDescription className="text-gray-400">Distribuição por canal de aquisição</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#F9FAFB",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {channelData.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-300 text-sm">
                    {item.name}: {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Analytics */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Engagement Social</CardTitle>
          <CardDescription className="text-gray-400">Interações nas redes sociais por dia da semana</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
              />
              <Bar dataKey="likes" fill="#EF4444" name="Likes" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shares" fill="#3B82F6" name="Shares" radius={[4, 4, 0, 0]} />
              <Bar dataKey="comments" fill="#10B981" name="Comentários" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performing Content */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Conteúdo com Melhor Performance</CardTitle>
          <CardDescription className="text-gray-400">Artigos mais populares dos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { title: "IA revoluciona diagnósticos médicos", views: 15420, shares: 234, engagement: 8.9 },
              { title: "Eleições 2024: análise completa", views: 12890, shares: 189, engagement: 7.2 },
              { title: "Benfica conquista vitória histórica", views: 9876, shares: 156, engagement: 6.8 },
              { title: "Inflação em Portugal: impacto na economia", views: 8543, shares: 134, engagement: 5.9 },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-white font-medium">{item.title}</h4>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                    <div className="flex items-center">
                      <Eye className="w-3 h-3 mr-1" />
                      {item.views.toLocaleString()} views
                    </div>
                    <div className="flex items-center">
                      <Share2 className="w-3 h-3 mr-1" />
                      {item.shares} shares
                    </div>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white">{item.engagement}% engagement</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
