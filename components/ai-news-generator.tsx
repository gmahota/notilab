"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GeneratedDraft } from "@/lib/ai-generate-service"
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
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<GeneratedDraft | null>(null)

  const [formData, setFormData] = useState({
    topic: "",
    category: "",
    style: "informativo",
    tone: "neutro",
    length: "medio",
    targetAudience: "geral",
  })

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setGeneratedContent(null)

    try {
      const res = await fetch("/api/ai/generate-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: formData.topic,
          category: formData.category,
          tone: formData.tone,
          length: formData.length,
          style: formData.style,
          audience: formData.targetAudience,
        }),
      })

      const payload = await res.json()

      if (!res.ok || !payload.success) {
        // NO_SOURCES is the expected answer when we hold no coverage on the
        // topic — surface it as guidance, not as a failure.
        setError(
          payload?.code === "NO_SOURCES"
            ? payload.error
            : payload?.error || "Não foi possível gerar o rascunho.",
        )
        return
      }

      setGeneratedContent(payload.data)
    } catch {
      setError("Falha de rede ao contactar o serviço de geração.")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedContent) return
    const plain = [
      generatedContent.title,
      "",
      generatedContent.summary,
      "",
      generatedContent.content,
      "",
      "Fontes:",
      ...generatedContent.sources.map((s) => `- ${s.title} (${s.sourceName}) ${s.sourceUrl}`),
    ].join("\n")

    try {
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("O navegador bloqueou o acesso à área de transferência.")
    }
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
                        onValueChange={(value: string) => setFormData({ ...formData, category: value })}
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
                        onValueChange={(value: string) => setFormData({ ...formData, style: value })}
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
                        onValueChange={(value: string) => setFormData({ ...formData, tone: value })}
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
                        onValueChange={(value: string) => setFormData({ ...formData, length: value })}
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
                      onValueChange={(value:string) => setFormData({ ...formData, targetAudience: value })}
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

                  {/* The "Incluir Análise IA" and "Incluir Fontes" switches were
                      removed: the analysis they gated was the fabricated metrics
                      block, and source provenance is now mandatory rather than
                      optional (AGENTS.md § AI-Content Correctness). Neither
                      switch was ever sent to the server. */}
                  <p className="text-xs text-gray-500 border border-gray-800 rounded-lg p-3">
                    O rascunho é escrito exclusivamente a partir de artigos que já temos em base.
                    Se não houver cobertura sobre o tópico, a geração falha em vez de inventar.
                  </p>

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

                  {/* No progress bar: the previous one animated through fake
                      stages on a timer. A single request has no real progress
                      to report, so the spinner on the button is the honest
                      signal. */}
                  {error && (
                    <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      {error}
                    </p>
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
                        <Button variant="outline" size="sm" onClick={handleCopy}>
                          <Download className="w-4 h-4 mr-2" />
                          {copied ? "Copiado" : "Copiar"}
                        </Button>
                        {/* Disabled deliberately: there is no news-creation
                            endpoint yet, and AGENTS.md requires AI content to
                            enter as DRAFT through the editorial workflow with an
                            AdminAction audit row. The previous handler only ran
                            console.log, which looked like it had worked. */}
                        <Button
                          size="sm"
                          disabled
                          title="Handoff para o editor ainda não implementado — copie o rascunho por agora"
                          className="bg-green-600 hover:bg-green-700"
                        >
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

                    {/* Only signals the model actually produced. The previous
                        version also showed "Legibilidade", "Engagement" and an
                        "SEO Score" that were invented — the score was literally
                        Math.random(). Fabricated metrics were dropped rather
                        than reimplemented. */}
                    <div>
                      <Label className="text-gray-300">Sinais</Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1 space-y-2">
                        <div>
                          <span className="text-gray-400 text-sm">Sentimento:</span>
                          <Badge className="ml-2 bg-green-600">{generatedContent.sentiment}</Badge>
                        </div>
                        {generatedContent.keywords.length > 0 && (
                          <div>
                            <span className="text-gray-400 text-sm">Keywords:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {generatedContent.keywords.map((keyword) => (
                                <Badge key={keyword} variant="outline" className="text-blue-400 border-blue-400">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Provenance — AGENTS.md requires AI-generated content to
                        keep a traceable link to its source material. */}
                    <div>
                      <Label className="text-gray-300">
                        Fontes usadas ({generatedContent.sources.length})
                      </Label>
                      <div className="bg-gray-800 p-3 rounded-lg mt-1">
                        <p className="text-xs text-gray-500 mb-2">
                          O rascunho foi escrito apenas a partir destes artigos. Verifique cada
                          afirmação contra a fonte antes de aprovar.
                        </p>
                        <ul className="space-y-2">
                          {generatedContent.sources.map((source) => (
                            <li key={source.id} className="text-sm flex items-start">
                              <Target className="w-3 h-3 mr-2 mt-1 text-blue-400 flex-shrink-0" />
                              <span className="min-w-0">
                                <a
                                  href={source.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-300 hover:text-blue-400 underline break-words"
                                >
                                  {source.title}
                                </a>
                                <span className="block text-xs text-gray-500">
                                  {source.sourceName} ·{" "}
                                  {new Date(source.publishedAt).toISOString().slice(0, 10)}
                                </span>
                              </span>
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
                      <p className="text-gray-400">Configure os parâmetros e clique em {"\"Gerar Notícia\""}</p>
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
