"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Scale,
  Gamepad2,
  Globe,
  Briefcase,
  TrendingUp,
  Bell,
  Mail,
  Smartphone,
  Clock,
  User,
  Settings,
  Save,
} from "lucide-react"

const profileTypes = [
  {
    type: "JOVEM",
    name: "Jovem",
    description: "Conteúdo dinâmico e tendências",
    icon: TrendingUp,
    color: "bg-secondary/10 text-secondary border-secondary/20",
  },
  {
    type: "EXECUTIVO",
    name: "Executivo",
    description: "Foco em economia e política",
    icon: Briefcase,
    color: "bg-primary/10 text-primary border-primary/20",
  },
  {
    type: "ESTUDANTE",
    name: "Estudante",
    description: "Educativo e aprofundado",
    icon: Globe,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  {
    type: "SENIOR",
    name: "Senior",
    description: "Análises detalhadas",
    icon: Scale,
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
]

const categories = [
  { name: "Política", slug: "politica", icon: Scale },
  { name: "Desporto", slug: "desporto", icon: Gamepad2 },
  { name: "Cultura", slug: "cultura", icon: Globe },
  { name: "Economia", slug: "economia", icon: Briefcase },
  { name: "Tecnologia", slug: "tecnologia", icon: TrendingUp },
]

export function UserPreferences() {
  const [profile, setProfile] = useState({
    name: "João Silva",
    email: "joao@example.com",
    avatar: "/diverse-user-avatars.png",
    type: "JOVEM",
    interests: ["politica", "tecnologia"],
    language: "pt",
    timezone: "Europe/Lisbon",
  })

  const [preferences, setPreferences] = useState({
    dailyDigest: true,
    pushNotifications: true,
    emailAlerts: false,
    categories: ["politica", "tecnologia", "desporto"],
  })

  const [notifications, setNotifications] = useState({
    breaking: true,
    trending: true,
    personalized: true,
    digest: true,
  })

  const handleProfileTypeChange = (type: string) => {
    setProfile({ ...profile, type })
  }

  const toggleCategory = (category: string) => {
    const updatedCategories = preferences.categories.includes(category)
      ? preferences.categories.filter((c) => c !== category)
      : [...preferences.categories, category]

    setPreferences({ ...preferences, categories: updatedCategories })
  }

  const handleSave = async () => {
    // TODO: Save to API
    console.log("Saving preferences:", { profile, preferences, notifications })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Informações Pessoais</span>
          </CardTitle>
          <CardDescription>Atualize seus dados pessoais e preferências básicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar || "/placeholder.svg"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Button variant="outline" size="sm">
                Alterar Foto
              </Button>
              <p className="text-sm text-muted-foreground">JPG, PNG até 2MB</p>
            </div>
          </div>

          {/* Name and Email */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>
          </div>

          {/* Profile Type */}
          <div className="space-y-3">
            <Label>Tipo de Perfil</Label>
            <div className="grid grid-cols-2 gap-2">
              {profileTypes.map((type) => {
                const Icon = type.icon
                const isSelected = profile.type === type.type

                return (
                  <Button
                    key={type.type}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleProfileTypeChange(type.type)}
                    className={`h-auto p-3 ${isSelected ? "" : type.color}`}
                  >
                    <div className="text-center space-y-1">
                      <Icon className="h-4 w-4 mx-auto" />
                      <div className="text-xs font-medium">{type.name}</div>
                      <div className="text-xs opacity-70">{type.description}</div>
                    </div>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Language and Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={profile.language} onValueChange={(value) => setProfile({ ...profile, language: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Select value={profile.timezone} onValueChange={(value) => setProfile({ ...profile, timezone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Lisbon">Lisboa</SelectItem>
                  <SelectItem value="Europe/London">Londres</SelectItem>
                  <SelectItem value="America/New_York">Nova York</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Preferências de Conteúdo</span>
          </CardTitle>
          <CardDescription>Personalize que tipo de notícias quer receber</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Categories */}
          <div className="space-y-3">
            <Label>Categorias de Interesse</Label>
            <div className="space-y-2">
              {categories.map((category) => {
                const Icon = category.icon
                const isSelected = preferences.categories.includes(category.slug)

                return (
                  <div key={category.slug} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <Switch checked={isSelected} onCheckedChange={() => toggleCategory(category.slug)} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="space-y-3">
            <Label>Notificações</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Notícias Urgentes</span>
                </div>
                <Switch
                  checked={notifications.breaking}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, breaking: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Tendências</span>
                </div>
                <Switch
                  checked={notifications.trending}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, trending: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Push Notifications</span>
                </div>
                <Switch
                  checked={preferences.pushNotifications}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, pushNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Email Diário</span>
                </div>
                <Switch
                  checked={preferences.dailyDigest}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, dailyDigest: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Resumo Personalizado</span>
                </div>
                <Switch
                  checked={notifications.personalized}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, personalized: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="lg:col-span-2">
        <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4 mr-2" />
          Guardar Preferências
        </Button>
      </div>
    </div>
  )
}
