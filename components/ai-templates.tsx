"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Copy, Edit, Star } from "lucide-react"

export function AITemplates() {
  const templates = [
    {
      id: "breaking-news",
      name: "Breaking News",
      description: "Template para notícias urgentes e de última hora",
      category: "Urgente",
      rating: 4.8,
      uses: 234,
      structure: {
        title: "Título impactante com palavras-chave",
        lead: "Parágrafo inicial com os factos principais",
        body: "Desenvolvimento com citações e contexto",
        conclusion: "Impacto e próximos passos",
      },
    },
    {
      id: "analysis",
      name: "Análise Profunda",
      description: "Template para artigos de análise e opinião",
      category: "Análise",
      rating: 4.6,
      uses: 189,
      structure: {
        title: "Título analítico e questionador",
        introduction: "Contextualização do problema",
        analysis: "Análise detalhada com dados",
        conclusion: "Conclusões e recomendações",
      },
    },
    {
      id: "interview",
      name: "Entrevista",
      description: "Template para entrevistas e declarações",
      category: "Entrevista",
      rating: 4.7,
      uses: 156,
      structure: {
        title: "Nome do entrevistado e tema principal",
        introduction: "Apresentação do entrevistado",
        highlights: "Principais declarações",
        context: "Contexto e relevância",
      },
    },
    {
      id: "tech-review",
      name: "Review Tecnológico",
      description: "Template para análises de produtos e tecnologias",
      category: "Tecnologia",
      rating: 4.5,
      uses: 98,
      structure: {
        title: "Nome do produto/tecnologia",
        overview: "Visão geral e especificações",
        pros_cons: "Vantagens e desvantagens",
        verdict: "Veredicto final e recomendação",
      },
    },
  ]

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)

  const handleUseTemplate = (template: any) => {
    setSelectedTemplate(template)
    // Implementar uso do template
    console.log("Usando template:", template)
  }

  return (
    <div className="space-y-6">
      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">{template.name}</CardTitle>
                <Badge style={{ backgroundColor: getCategoryColor(template.category) }} className="text-white">
                  {template.category}
                </Badge>
              </div>
              <CardDescription className="text-gray-400">{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div className="flex items-center">
                  <Star className="w-4 h-4 mr-1 text-yellow-400" />
                  {template.rating}
                </div>
                <div>{template.uses} usos</div>
              </div>

              <div className="space-y-2">
                <p className="text-gray-300 text-sm font-medium">Estrutura:</p>
                <div className="space-y-1">
                  {Object.entries(template.structure).map(([key, value]) => (
                    <div key={key} className="flex items-start text-xs">
                      <span className="text-blue-400 font-medium w-20 capitalize">{key.replace("_", " ")}:</span>
                      <span className="text-gray-400 flex-1">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={() => handleUseTemplate(template)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  <Zap className="w-4 h-4 mr-2" />
                  Usar Template
                </Button>
                <Button variant="outline" size="sm">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Preview */}
      {selectedTemplate && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Preview: {selectedTemplate.name}</CardTitle>
            <CardDescription className="text-gray-400">Estrutura detalhada do template selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="space-y-4">
                {Object.entries(selectedTemplate.structure).map(([key, value]) => (
                  <div key={key} className="border-l-2 border-blue-500 pl-4">
                    <h4 className="text-blue-400 font-medium capitalize">{key.replace("_", " ")}</h4>
                    <p className="text-gray-300 text-sm mt-1">{value as string}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function getCategoryColor(category: string) {
  const colors = {
    Urgente: "#EF4444",
    Análise: "#8B5CF6",
    Entrevista: "#10B981",
    Tecnologia: "#3B82F6",
  }
  return colors[category as keyof typeof colors] || "#6B7280"
}
