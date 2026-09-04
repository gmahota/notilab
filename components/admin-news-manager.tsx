"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewsEditor } from "./news-editor"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react"

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
}

interface AdminNewsManagerProps {
  user: AdminUser
}

export function AdminNewsManager({ user }: AdminNewsManagerProps) {
  const [showEditor, setShowEditor] = useState(false)
  const [editingNews, setEditingNews] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [news, setNews] = useState([
    {
      id: "1",
      title: "IA revoluciona diagnósticos médicos em Portugal",
      category: { name: "Tecnologia", color: "#3B82F6" },
      status: "PUBLISHED",
      author: "João Redator",
      publishedAt: new Date("2024-01-15"),
      views: 15420,
      reactions: 89,
      priority: "HIGH",
      trending: true,
    },
    {
      id: "2",
      title: "Eleições presidenciais: candidatos apresentam propostas",
      category: { name: "Política", color: "#EF4444" },
      status: "PENDING_REVIEW",
      author: "Maria Silva",
      publishedAt: new Date("2024-01-14"),
      views: 8930,
      reactions: 45,
      priority: "URGENT",
      trending: false,
    },
    {
      id: "3",
      title: "Benfica vence clássico e lidera campeonato",
      category: { name: "Desporto", color: "#10B981" },
      status: "DRAFT",
      author: "Pedro Santos",
      publishedAt: new Date("2024-01-13"),
      views: 0,
      reactions: 0,
      priority: "NORMAL",
      trending: false,
    },
  ])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: "Rascunho", color: "bg-gray-600" },
      PENDING_REVIEW: { label: "Pendente", color: "bg-yellow-600" },
      APPROVED: { label: "Aprovado", color: "bg-blue-600" },
      PUBLISHED: { label: "Publicado", color: "bg-green-600" },
      REJECTED: { label: "Rejeitado", color: "bg-red-600" },
      ARCHIVED: { label: "Arquivado", color: "bg-gray-500" },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "HIGH":
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-400" />
    }
  }

  const filteredNews = news.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    const matchesCategory = categoryFilter === "all" || item.category.name === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  const handleEdit = (newsItem: any) => {
    setEditingNews(newsItem)
    setShowEditor(true)
  }

  const handleCreate = () => {
    setEditingNews(null)
    setShowEditor(true)
  }

  if (showEditor) {
    return (
      <NewsEditor
        news={editingNews}
        user={user}
        onClose={() => {
          setShowEditor(false)
          setEditingNews(null)
        }}
        onSave={(savedNews) => {
          // Update news list
          setShowEditor(false)
          setEditingNews(null)
        }}
      />
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão de Notícias</h1>
          <p className="text-gray-400 mt-1">Gerir conteúdo, revisar e publicar notícias</p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Notícia
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total de Notícias</CardTitle>
            <FileText className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1,234</div>
            <p className="text-xs text-gray-400">+12% desde o mês passado</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Pendentes Revisão</CardTitle>
            <Clock className="w-4 h-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">23</div>
            <p className="text-xs text-gray-400">-5% desde ontem</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Publicadas Hoje</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">45</div>
            <p className="text-xs text-gray-400">+8% desde ontem</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Rejeitadas</CardTitle>
            <XCircle className="w-4 h-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">7</div>
            <p className="text-xs text-gray-400">-2% desde ontem</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Filtros e Pesquisa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Pesquisar notícias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pendente</SelectItem>
                <SelectItem value="APPROVED">Aprovado</SelectItem>
                <SelectItem value="PUBLISHED">Publicado</SelectItem>
                <SelectItem value="REJECTED">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">Todas as Categorias</SelectItem>
                <SelectItem value="Política">Política</SelectItem>
                <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                <SelectItem value="Desporto">Desporto</SelectItem>
                <SelectItem value="Economia">Economia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* News Table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Lista de Notícias</CardTitle>
          <CardDescription className="text-gray-400">{filteredNews.length} notícias encontradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Título</TableHead>
                <TableHead className="text-gray-300">Categoria</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Autor</TableHead>
                <TableHead className="text-gray-300">Data</TableHead>
                <TableHead className="text-gray-300">Métricas</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNews.map((item) => (
                <TableRow key={item.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell className="text-white">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(item.priority)}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.trending && <Badge className="bg-orange-600 text-white text-xs mt-1">Trending</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: item.category.color }} className="text-white">
                      {item.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-gray-300">{item.author}</TableCell>
                  <TableCell className="text-gray-300">{item.publishedAt.toLocaleDateString("pt-PT")}</TableCell>
                  <TableCell className="text-gray-300">
                    <div className="text-sm">
                      <div>{item.views.toLocaleString()} visualizações</div>
                      <div>{item.reactions} reações</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                        <DropdownMenuLabel className="text-gray-300">Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem onClick={() => handleEdit(item)} className="text-gray-300 hover:bg-gray-700">
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-gray-300 hover:bg-gray-700">
                          <Eye className="mr-2 h-4 w-4" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 hover:bg-gray-700">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
