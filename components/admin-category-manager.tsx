"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Hash } from "lucide-react"

interface AdminCategoryManagerProps {
  user: any
}

export function AdminCategoryManager({ user }: AdminCategoryManagerProps) {
  const [categories, setCategories] = useState([
    { id: "1", name: "Política", slug: "politica", color: "#EF4444", newsCount: 234 },
    { id: "2", name: "Tecnologia", slug: "tecnologia", color: "#3B82F6", newsCount: 189 },
    { id: "3", name: "Desporto", slug: "desporto", color: "#10B981", newsCount: 156 },
    { id: "4", name: "Economia", slug: "economia", color: "#F59E0B", newsCount: 98 },
    { id: "5", name: "Cultura", slug: "cultura", color: "#8B5CF6", newsCount: 67 },
  ])

  const [showDialog, setShowDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    color: "#3B82F6",
    description: "",
  })

  const handleEdit = (category: any) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      color: category.color,
      description: category.description || "",
    })
    setShowDialog(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setFormData({
      name: "",
      slug: "",
      color: "#3B82F6",
      description: "",
    })
    setShowDialog(true)
  }

  const handleSave = () => {
    // TODO: implement save logic
    setShowDialog(false)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão de Categorias</h1>
          <p className="text-gray-400 mt-1">Organizar e gerir categorias de notícias</p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Card key={category.id} className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                  <CardTitle className="text-white">{category.name}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(category)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-gray-400">Slug: /{category.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">{category.newsCount} notícias</span>
                </div>
                <Badge style={{ backgroundColor: category.color }} className="text-white">
                  Ativa
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingCategory ? "Editar informações da categoria" : "Criar uma nova categoria de notícias"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-300">
                Nome
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="Nome da categoria"
              />
            </div>
            <div>
              <Label htmlFor="slug" className="text-gray-300">
                Slug
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="slug-da-categoria"
              />
            </div>
            <div>
              <Label htmlFor="color" className="text-gray-300">
                Cor
              </Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 bg-gray-800 border-gray-700"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingCategory ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
