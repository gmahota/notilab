"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Users, Share2, Eye, Heart, Calendar, Target } from "lucide-react"

const engagementData = [
  { name: "Seg", shares: 45, likes: 120, comments: 32 },
  { name: "Ter", shares: 52, likes: 145, comments: 28 },
  { name: "Qua", shares: 38, likes: 98, comments: 45 },
  { name: "Qui", shares: 67, likes: 189, comments: 52 },
  { name: "Sex", shares: 71, likes: 203, comments: 38 },
  { name: "Sáb", shares: 43, likes: 134, comments: 29 },
  { name: "Dom", shares: 39, likes: 112, comments: 34 },
]

const platformData = [
  { name: "WhatsApp", value: 45, color: "#25D366" },
  { name: "Telegram", value: 30, color: "#0088CC" },
  { name: "Twitter", value: 15, color: "#1DA1F2" },
  { name: "LinkedIn", value: 10, color: "#0077B5" },
]

const topContent = [
  {
    title: "Nova Lei de IA na Europa",
    platform: "WhatsApp",
    shares: 234,
    engagement: 89,
    reach: "12.5K",
  },
  {
    title: "Benfica na Champions League",
    platform: "Telegram",
    shares: 189,
    engagement: 76,
    reach: "8.9K",
  },
  {
    title: "Startup Portuguesa Recebe Investimento",
    platform: "Twitter",
    shares: 156,
    engagement: 65,
    reach: "5.2K",
  },
]

const socialMetrics = [
  {
    name: "Total de Seguidores",
    value: "15.6K",
    change: "+12%",
    icon: Users,
    color: "text-blue-500",
  },
  {
    name: "Partilhas Esta Semana",
    value: "355",
    change: "+8%",
    icon: Share2,
    color: "text-green-500",
  },
  {
    name: "Engagement Rate",
    value: "4.2%",
    change: "+0.5%",
    icon: Heart,
    color: "text-red-500",
  },
  {
    name: "Alcance Médio",
    value: "8.9K",
    change: "+15%",
    icon: Eye,
    color: "text-purple-500",
  },
]

export function SocialAnalytics() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {socialMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.name}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <p className={`text-sm ${metric.color}`}>{metric.change} vs semana anterior</p>
                  </div>
                  <Icon className={`h-8 w-8 ${metric.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Engagement Semanal</span>
            </CardTitle>
            <CardDescription>Partilhas, likes e comentários por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="shares" fill="#007BFF" name="Partilhas" />
                <Bar dataKey="likes" fill="#39FF14" name="Likes" />
                <Bar dataKey="comments" fill="#FF6B6B" name="Comentários" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Distribuição por Plataforma</span>
            </CardTitle>
            <CardDescription>Percentagem de engagement por rede social</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                {platformData.map((platform) => (
                  <div key={platform.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
                      <span className="text-sm font-medium">{platform.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{platform.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Conteúdo com Melhor Performance</span>
          </CardTitle>
          <CardDescription>Notícias mais partilhadas esta semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topContent.map((content, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{content.platform}</Badge>
                    <span className="text-sm font-medium">{content.title}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Share2 className="h-3 w-3" />
                      <span>{content.shares} partilhas</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="h-3 w-3" />
                      <span>{content.reach} alcance</span>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-medium">{content.engagement}%</div>
                  <Progress value={content.engagement} className="w-20 h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
