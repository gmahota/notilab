"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Eye, Send, Upload, Sparkles, Tag, Calendar, Globe, ImageIcon } from "lucide-react"

interface NewsEditorProps {
  news?: any
  user: any
  onClose: () => void
  onSave: (news: any) => void
}

export function NewsEditor({ news, user, onClose, onSave }: NewsEditorProps) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    imageUrl: "",
    sourceUrl: "",
    sourceName: "",
    categoryId: "",
    tags: [] as string[],
    priority: "NORMAL",
    trending: false,
    publishedAt: new Date().toISOString().slice(0, 16),
  })

  const [newTag, setNewTag] = useState("")
  const [aiAnalyzing, setAiAnalyzing] = useState(false)

  useEffect(() => {
    if (news) {
      setFormData({
        title: news.title || "",
        content: news.content || "",
        summary: news.summary || "",
        imageUrl: news.imageUrl || "",
        sourceUrl: news.sourceUrl || "",
        sourceName: news.sourceName || "",
        categoryId: news.categoryId || "",
        tags: news.tags || [],
        priority: news.priority || "NORMAL",
        trending: news.trending || false,
        publishedAt: news.publishedAt
          ? new Date(news.publishedAt).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16),
      })
    }
  }, [news])

  const categories = [
    { id: "1", name: "Política", color: "#EF4444" },
    { id: "2", name: "Tecnologia", color: "#3B82F6" },
    { id: "3", name: "Desporto", color: "#10B981" },
    { id: "4", name: "Economia", color: "#F59E0B" },
    { id: "5", name: "Cultura", color: "#8B5CF6" },
  ]

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      })
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    })
  }

  const handleAIAnalysis = async () => {
    setAiAnalyzing(true)
    // Simular análise de IA
    setTimeout(() => {
      setFormData({
        ...formData,
        summary: "Resumo gerado automaticamente pela IA baseado no conteúdo da notícia...",
        tags: [...formData.tags, "IA", "tecnologia", "inovação"],
      })
      setAiAnalyzing(false)
    }, 2000)
  }

  const handleSave = (status: string) => {
    const savedNews = {
      ...formData,
      id: news?.id || Date.now().toString(),
      status,
      author: user.name,
      updatedAt: new Date(),
    }
    onSave(savedNews)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">{news ? "Editar Notícia" : "Nova Notícia"}</h1>
            <p className="text-gray-400 mt-1">
              {news ? `Editando: ${news.title}` : "Criar nova notícia para publicação"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => handleSave("DRAFT")}>
            <Save className="w-4 h-4 mr-2" />
            Guardar Rascunho
          </Button>
          <Button variant="outline">
            <Eye className="w-4 h-4 mr-2" />
            Pré-visualizar
          </Button>
          <Button onClick={() => handleSave("PENDING_REVIEW")} className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-4 h-4 mr-2" />
            Enviar para Revisão
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-gray-300">
                  Título
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="Título da notícia..."
                />
              </div>

              <div>
                <Label htmlFor="summary" className="text-gray-300">
                  Resumo
                </Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="Resumo da notícia..."
                  rows={3}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="content" className="text-gray-300">
                    Conteúdo
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAIAnalysis}
                    disabled={aiAnalyzing}
                    className="text-blue-400 border-blue-400 bg-transparent"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {aiAnalyzing ? "Analisando..." : "Análise IA"}
                  </Button>
                </div>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Conteúdo completo da notícia..."
                  rows={12}
                />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <ImageIcon className="w-5 h-5 mr-2" />
                Mídia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="imageUrl" className="text-gray-300">
                  URL da Imagem
                </Label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                  <Button variant="outline">
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {formData.imageUrl && (
                <div className="mt-4">
                  <img
                    src={formData.imageUrl || "/placeholder.svg"}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publishing Options */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Publicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="publishedAt" className="text-gray-300">
                  Data de Publicação
                </Label>
                <Input
                  id="publishedAt"
                  type="datetime-local"
                  value={formData.publishedAt}
                  onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                />
              </div>

              <div>
                <Label htmlFor="priority" className="text-gray-300">
                  Prioridade
                </Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="LOW">Baixa</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="trending" className="text-gray-300">
                  Trending
                </Label>
                <Switch
                  id="trending"
                  checked={formData.trending}
                  onCheckedChange={(checked) => setFormData({ ...formData, trending: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Tag className="w-5 h-5 mr-2" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Nova tag..."
                />
                <Button onClick={handleAddTag} variant="outline" size="sm">
                  Adicionar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-blue-400 border-blue-400 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    #{tag} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Source */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Fonte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sourceName" className="text-gray-300">
                  Nome da Fonte
                </Label>
                <Input
                  id="sourceName"
                  value={formData.sourceName}
                  onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="Ex: Público, Observador..."
                />
              </div>

              <div>
                <Label htmlFor="sourceUrl" className="text-gray-300">
                  URL da Fonte
                </Label>
                <Input
                  id="sourceUrl"
                  value={formData.sourceUrl}
                  onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
