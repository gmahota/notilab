"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Search, Globe, ExternalLink, BookOpen, Clock, Star, Zap } from "lucide-react"

export function NewsResearcher() {
  const [query, setQuery] = useState("")
  const [researching, setResearching] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const handleResearch = async () => {
    setResearching(true)
    // Simular pesquisa
    setTimeout(() => {
      setResults([
        {
          title: "Portugal lidera inovação em IA na Europa",
          source: "Público",
          url: "https://publico.pt/exemplo",
          summary: "País destaca-se no desenvolvimento de soluções de inteligência artificial...",
          relevance: 95,
          publishedAt: "2024-01-15T10:30:00Z",
          category: "Tecnologia",
        },
        {
          title: "Investimento em startups de IA cresce 200%",
          source: "Observador",
          url: "https://observador.pt/exemplo",
          summary: "Setor tecnológico português atrai investimento internacional...",
          relevance: 88,
          publishedAt: "2024-01-14T15:45:00Z",
          category: "Economia",
        },
        {
          title: "Universidades portuguesas criam centro de IA",
          source: "Jornal de Notícias",
          url: "https://jn.pt/exemplo",
          summary: "Parceria entre universidades visa formar especialistas...",
          relevance: 82,
          publishedAt: "2024-01-13T09:20:00Z",
          category: "Educação",
        },
      ])
      setResearching(false)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Search className="w-5 h-5 mr-2 text-blue-400" />
            Pesquisador Automático
          </CardTitle>
          <CardDescription className="text-gray-400">
            Encontre fontes relevantes e informações atualizadas sobre qualquer tópico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Inteligência artificial em Portugal"
              className="bg-gray-800 border-gray-700 text-white"
            />
            <Button onClick={handleResearch} disabled={researching || !query} className="bg-blue-600 hover:bg-blue-700">
              {researching ? "Pesquisando..." : "Pesquisar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Resultados da Pesquisa</CardTitle>
            <CardDescription className="text-gray-400">{results.length} fontes encontradas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="bg-gray-800 p-4 rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{result.title}</h3>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                      <div className="flex items-center">
                        <Globe className="w-3 h-3 mr-1" />
                        {result.source}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(result.publishedAt).toLocaleDateString("pt-PT")}
                      </div>
                      <div className="flex items-center">
                        <Star className="w-3 h-3 mr-1" />
                        {result.relevance}% relevante
                      </div>
                    </div>
                  </div>
                  <Badge style={{ backgroundColor: getCategoryColor(result.category) }} className="text-white">
                    {result.category}
                  </Badge>
                </div>

                <p className="text-gray-300 text-sm">{result.summary}</p>

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" className="text-blue-400 border-blue-400 bg-transparent">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Ver Fonte
                  </Button>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <BookOpen className="w-3 h-3 mr-1" />
                      Resumir
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <Zap className="w-3 h-3 mr-1" />
                      Usar como Base
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Research Summary */}
      {results.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Resumo da Pesquisa</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="A IA gerará automaticamente um resumo baseado nas fontes encontradas..."
              className="bg-gray-800 border-gray-700 text-white"
              rows={6}
              readOnly
            />
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
              <Zap className="w-4 h-4 mr-2" />
              Gerar Resumo Automático
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function getCategoryColor(category: string) {
  const colors = {
    Tecnologia: "#3B82F6",
    Política: "#EF4444",
    Desporto: "#10B981",
    Economia: "#F59E0B",
    Educação: "#8B5CF6",
  }
  return colors[category as keyof typeof colors] || "#6B7280"
}
