"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Search, Globe, Clock, Zap, RefreshCw } from "lucide-react"

export function TrendingTopics() {
  const [region, setRegion] = useState("PT")
  const [timeframe, setTimeframe] = useState("24h")
  const [loading, setLoading] = useState(false)

  const trendingTopics = [
    {
      keyword: "Inteligência Artificial",
      volume: 15420,
      growth: "+45%",
      category: "Tecnologia",
      sentiment: "Positivo",
      related: ["Machine Learning", "ChatGPT", "Automação"],
    },
    {
      keyword: "Eleições 2024",
      volume: 12890,
      growth: "+32%",
      category: "Política",
      sentiment: "Neutro",
      related: ["Candidatos", "Sondagens", "Debates"],
    },
    {
      keyword: "Benfica Champions",
      volume: 9876,
      growth: "+78%",
      category: "Desporto",
      sentiment: "Positivo",
      related: ["Liga dos Campeões", "Futebol", "Vitória"],
    },
    {
      keyword: "Inflação Portugal",
      volume: 8543,
      growth: "+12%",
      category: "Economia",
      sentiment: "Negativo",
      related: ["Preços", "Banco Central", "Consumo"],
    },
  ]

  const handleRefresh = async () => {
    setLoading(true)
    // Simular refresh
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
            Análise de Tendências
          </CardTitle>
          <CardDescription className="text-gray-400">
            Monitore tópicos em alta e identifique oportunidades de conteúdo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Pesquisar tópicos..." className="pl-10 bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="PT">Portugal</SelectItem>
                <SelectItem value="BR">Brasil</SelectItem>
                <SelectItem value="ES">Espanha</SelectItem>
                <SelectItem value="GLOBAL">Global</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="1h">1 hora</SelectItem>
                <SelectItem value="24h">24 horas</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trending Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {trendingTopics.map((topic, index) => (
          <Card key={index} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg">{topic.keyword}</CardTitle>
                <Badge className="bg-green-600 text-white">{topic.growth}</Badge>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center">
                  <Globe className="w-4 h-4 mr-1" />
                  {topic.volume.toLocaleString()} pesquisas
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Últimas {timeframe}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge style={{ backgroundColor: getCategoryColor(topic.category) }} className="text-white">
                  {topic.category}
                </Badge>
                <Badge
                  className={`${
                    topic.sentiment === "Positivo"
                      ? "bg-green-600"
                      : topic.sentiment === "Negativo"
                        ? "bg-red-600"
                        : "bg-gray-600"
                  } text-white`}
                >
                  {topic.sentiment}
                </Badge>
              </div>

              <div>
                <p className="text-gray-300 text-sm mb-2">Tópicos Relacionados:</p>
                <div className="flex flex-wrap gap-1">
                  {topic.related.map((related) => (
                    <Badge key={related} variant="outline" className="text-blue-400 border-blue-400 text-xs">
                      {related}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                <Zap className="w-4 h-4 mr-2" />
                Gerar Notícia
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function getCategoryColor(category: string) {
  const colors = {
    Tecnologia: "#3B82F6",
    Política: "#EF4444",
    Desporto: "#10B981",
    Economia: "#F59E0B",
    Cultura: "#8B5CF6",
  }
  return colors[category as keyof typeof colors] || "#6B7280"
}
