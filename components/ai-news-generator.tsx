"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { TrendingTopics } from "./trending-topics"
import { NewsResearcher } from "./news-researcher"
import { AITemplates } from "./ai-templates"
import { Sparkles, Search, TrendingUp, FileText, Zap, Brain, Target, RefreshCw, Download, Send } from "lucide-react"

interface AINewsGeneratorProps {
  user: any
}

export function AINewsGenerator({ user }: AINewsGeneratorProps) {
  const [activeTab, setActiveTab] = useState("generator")
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedContent, setGeneratedContent] = useState<any>(null)

  const [formData, setFormData] = useState({
    topic: "",
    category: "",
    style: "informativo",
    tone: "neutro",
    length: "medio",
    includeAnalysis: true,
    includeSources: true,
    targetAudience: "geral",
    keywords: [] as string[],
  })

  const handleGenerate = async () => {
    setGenerating(true)
    setProgress(0)

    // Simular processo de geração
    const steps = [
      { message: "Pesquisando tópicos relacionados...", progress: 20 },
      { message: "Analisando tendências...", progress: 40 },
      { message: "Gerando conteúdo...", progress: 60 },
      { message: "Aplicando análise de IA...", progress: 80 },
      { message: "Finalizando...", progress: 100 },
    ]

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setProgress(step.progress)
    }

    // Mock do conteúdo gerado
    setGeneratedContent({
      title: "IA Revoluciona Diagnósticos Médicos em Portugal",
      summary:
        "Nova tecnologia de inteligência artificial desenvolvida por investigadores portugueses promete transformar a medicina de precisão no país.",
      content: `A inteligência artificial está a revolucionar o setor da saúde em Portugal, com uma nova tecnologia desenvolvida por investigadores da Universidade do Porto que promete transformar os diagnósticos médicos.

O sistema, denominado MediAI, utiliza algoritmos avançados de machine learning para analisar exames médicos com uma precisão superior a 95%, superando os métodos tradicionais de diagnóstico.

"Esta tecnologia representa um marco na medicina portuguesa", afirma o Dr. João Silva, coordenador do projeto. "Conseguimos reduzir o tempo de diagnóstico de horas para minutos, mantendo uma precisão excecional."

O sistema já está a ser testado em três hospitais de Lisboa e Porto, com resultados promissores. Os primeiros testes mostram uma redução de 40% no tempo de diagnóstico e uma melhoria significativa na deteção precoce de doenças.

A implementação nacional está prevista para 2025, com o apoio do Ministério da Saúde e financiamento europeu de 15 milhões de euros.`,
      aiAnalysis: {
        sentiment: "Positivo",
        readability: "Fácil",
        engagement: "Alto",
        seoScore: 85,
        keywords: ["IA", "medicina", "diagnóstico", "Portugal", "tecnologia"],
      },
      suggestions: [
        "Adicionar citações de especialistas internacionais",
        "Incluir dados estatísticos sobre eficácia",
        "Mencionar impacto económico da tecnologia",
      ],
    })

    setGenerating(false)
  }

  const handleSendToEditor = () => {
    // Implementar envio para o editor de notícias
    console.log("Enviando para editor:", generatedContent)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Sparkles className="w-8 h-8 mr-3 text-blue-400" />
            Gerador de Notícias IA
          </h1>
          <p className="text-gray-400 mt-1">Criar conteúdo inteligente com análise automática e sugestões</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className="bg-green-600 text-white">
            <Zap className="w-3 h-3 mr-1" />
            IA Ativa
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-gray-900 border-gray-800">
          <TabsTrigger value="generator" className="text-gray-300 data-[state=active]:text-white">
            <Brain className="w-4 h-4 mr-2" />
            Gerador
          </TabsTrigger>
          <TabsTrigger value="trending" className="text-gray-300 data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Tendências
          </TabsTrigger>
          <TabsTrigger value="researcher" className="text-gray-300 data-[state=active]:text-white">
            <Search className="w-4 h-4 mr-2" />
            Pesquisador
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-gray-300 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuration */}
            <div className="space-y-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Configuração da Notícia</CardTitle>
                  <CardDescription className="text-gray-400">
                    Defina os parâmetros para geração de conteúdo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="topic" className="text-gray-300">
                      Tópico Principal
                    </Label>
                    <Input
                      id="topic"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white mt-1"
                      placeholder="Ex: Inteligência artificial na medicina"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category" className="text-gray-300">
                        Categoria
                      </Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="tecnologia">Tecnologia</SelectItem>
                          <SelectItem value="politica">Política</SelectItem>
                          <SelectItem value="economia">Economia</SelectItem>
                          <SelectItem value="desporto">Desporto</SelectItem>
                          <SelectItem value="cultura">Cultura</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="style" className="text-gray-300">
                        Estilo
                      </Label>
                      <Select
                        value={formData.style}
                        onValueChange={(value) => setFormData({ ...formData, style: value })}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="informativo">Informativo</SelectItem>
                          <SelectItem value="analise">Análise</SelectItem>
                          <SelectItem value="opiniao">Opinião</SelectItem>
                          <SelectItem value="breaking">Breaking News</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tone" className="text-gray-300">
                        Tom
                      </Label>
                      <Select
                        value={formData.tone}
                        onValueChange={(value) => setFormData({ ...formData, tone: value })}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="neutro">Neutro</SelectItem>
                          <SelectItem value="positivo">Positivo</SelectItem>
                          <SelectItem value="critico">Crítico</SelectItem>
                          <SelectItem value="entusiastico">Entusiástico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="length" className="text-gray-300">
                        Tamanho
                      </Label>
                      <Select
                        value={formData.length}
                        onValueChange={(value) => setFormData({ ...formData, length: value })}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="curto">Curto (300-500 palavras)</SelectItem>
                          <SelectItem value="medio">Médio (500-800 palavras)</SelectItem>
                          <SelectItem value="longo">Longo (800+ palavras)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="targetAudience" className="text-gray-300">
                      Público-Alvo
                    </Label>
                    <Select
                      value={formData.targetAudience}
                      onValueChange={(value) => setFormData({ ...formData, targetAudience: value })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="geral">Público Geral</SelectItem>
                        <SelectItem value="jovem">Jovens (18-30)</SelectItem>
                        <SelectItem value="executivo">Executivos</SelectItem>
                        <SelectItem value="estudante">Estudantes</SelectItem>
                        <SelectItem value="senior">Seniores (50+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="includeAnalysis" className="text-gray-300">
                        Incluir Análise IA
                      </Label>
                      <Switch
                        id="includeAnalysis"
                        checked={formData.includeAnalysis}
                        onCheckedChange={(checked) => setFormData({ ...formData, includeAnalysis: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="includeSources" className="text-gray-300">
                        Incluir Fontes
                      </Label>
                      <Switch
                        id="includeSources"
                        checked={formData.includeSources}
                        onCheckedChange={(checked) => setFormData({ ...formData, includeSources: checked })}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generating || !formData.topic}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Gerar Notícia
                      </>
                    )}
                  </Button>

                  {generating && (
                    <div className="space-y-2">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-gray-400 text-center">Processando... {progress}%</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Generated Content */}
            <div className="space-y-6">
              {generatedContent ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">Conteúdo Gerado</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Exportar
                        </Button>
                        <Button onClick={handleSendToEditor} size="sm" className="bg-green-600 hover:bg-green-700">
                          <Send className="w-4 h-4 mr-2" />
                          Enviar para Editor
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-gray-300">Título</Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1">
                        <p className="text-white font-medium">{generatedContent.title}</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-300">Resumo</Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1">
                        <p className="text-gray-300">{generatedContent.summary}</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-300">Conteúdo</Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1 max-h-64 overflow-y-auto">
                        <div className="text-gray-300 whitespace-pre-line">{generatedContent.content}</div>
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div>
                      <Label className="text-gray-300">Análise IA</Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1 space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-400 text-sm">Sentimento:</span>
                            <Badge className="ml-2 bg-green-600">{generatedContent.aiAnalysis.sentiment}</Badge>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">Legibilidade:</span>
                            <Badge className="ml-2 bg-blue-600">{generatedContent.aiAnalysis.readability}</Badge>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">Engagement:</span>
                            <Badge className="ml-2 bg-purple-600">{generatedContent.aiAnalysis.engagement}</Badge>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">SEO Score:</span>
                            <Badge className="ml-2 bg-yellow-600">{generatedContent.aiAnalysis.seoScore}/100</Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">Keywords:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {generatedContent.aiAnalysis.keywords.map((keyword: string) => (
                              <Badge key={keyword} variant="outline" className="text-blue-400 border-blue-400">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Suggestions */}
                    <div>
                      <Label className="text-gray-300">Sugestões de Melhoria</Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1">
                        <ul className="space-y-1">
                          {generatedContent.suggestions.map((suggestion: string, index: number) => (
                            <li key={index} className="text-gray-300 text-sm flex items-start">
                              <Target className="w-3 h-3 mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Configure os parâmetros e clique em "Gerar Notícia"</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trending">
          <TrendingTopics />
        </TabsContent>

        <TabsContent value="researcher">
          <NewsResearcher />
        </TabsContent>

        <TabsContent value="templates">
          <AITemplates />
        </TabsContent>
      </Tabs>
    </div>
  )
}
