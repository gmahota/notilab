"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MessageCircle,
  Send,
  Twitter,
  Facebook,
  Linkedin,
  Share2,
  Settings,
  CheckCircle,
  AlertCircle,
  Users,
} from "lucide-react"

const socialPlatforms = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    description: "Receba resumos diários e alertas urgentes",
    connected: true,
    subscribers: 1250,
    features: ["Resumos diários", "Alertas urgentes", "Quizzes interativos"],
    color: "bg-green-500",
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: Send,
    description: "Bot inteligente com comandos personalizados",
    connected: true,
    subscribers: 890,
    features: ["Bot de comandos", "Canais temáticos", "Polls automáticas"],
    color: "bg-blue-500",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: Twitter,
    description: "Threads automáticas de notícias resumidas",
    connected: false,
    subscribers: 0,
    features: ["Threads automáticas", "Hashtags inteligentes", "Engagement tracking"],
    color: "bg-black",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: Facebook,
    description: "Posts automáticos na sua página",
    connected: false,
    subscribers: 0,
    features: ["Posts automáticos", "Stories", "Grupos privados"],
    color: "bg-blue-600",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    description: "Conteúdo profissional e análises de mercado",
    connected: false,
    subscribers: 0,
    features: ["Artigos profissionais", "Network updates", "Industry insights"],
    color: "bg-blue-700",
  },
]

const botCommands = [
  { command: "/resumo", description: "Resumo das últimas 24h" },
  { command: "/trending", description: "Tópicos em alta" },
  { command: "/categoria [nome]", description: "Notícias por categoria" },
  { command: "/config", description: "Configurar preferências" },
  { command: "/quiz", description: "Quiz sobre notícias" },
]

type IntegrationConfig = {
  enabled: boolean
  frequency: string
  categories: string[]
}

type IntegrationsState = {
  [key: string]: IntegrationConfig
}

export function SocialIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationsState>(
    socialPlatforms.reduce(
      (acc, platform) => ({
        ...acc,
        [platform.id]: {
          enabled: platform.connected,
          frequency: "daily",
          categories: ["politica", "tecnologia"],
        },
      }),
      {} as IntegrationsState,
    ),
  )

  const toggleIntegration = (platformId: string) => {
    setIntegrations((prev) => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        enabled: !prev[platformId]?.enabled,
      },
    }))
  }

  const updateFrequency = (platformId: string, frequency: string) => {
    setIntegrations((prev) => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        frequency,
      },
    }))
  }

  return (
    <div className="space-y-6">
      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {socialPlatforms.map((platform) => {
          const Icon = platform.icon
          const isEnabled = integrations[platform.id]?.enabled

          return (
            <Card key={platform.id} className={`relative overflow-hidden ${isEnabled ? "ring-2 ring-primary/20" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{platform.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        {platform.connected ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Conectado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Desconectado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Switch checked={isEnabled} onCheckedChange={() => toggleIntegration(platform.id)} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{platform.description}</p>

                {/* Subscribers */}
                {platform.connected && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{platform.subscribers.toLocaleString()}</span>
                    <span className="text-muted-foreground">seguidores</span>
                  </div>
                )}

                {/* Features */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Funcionalidades:</Label>
                  <div className="flex flex-wrap gap-1">
                    {platform.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Configuration */}
                {isEnabled && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="space-y-2">
                      <Label className="text-xs">Frequência:</Label>
                      <Select
                        value={integrations[platform.id]?.frequency || "daily"}
                        onValueChange={(value) => updateFrequency(platform.id, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Tempo Real</SelectItem>
                          <SelectItem value="hourly">A cada Hora</SelectItem>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <Settings className="h-3 w-3 mr-2" />
                      Configurar
                    </Button>
                  </div>
                )}

                {/* Connect Button */}
                {!platform.connected && (
                  <Button className="w-full" style={{ backgroundColor: platform.color.replace("bg-", "") }}>
                    Conectar {platform.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bot Commands Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Comandos do Bot</span>
          </CardTitle>
          <CardDescription>Comandos disponíveis para WhatsApp e Telegram</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {botCommands.map((cmd) => (
              <div key={cmd.command} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <code className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">{cmd.command}</code>
                  <p className="text-xs text-muted-foreground mt-1">{cmd.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Share Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Share2 className="h-5 w-5" />
            <span>Partilha Rápida</span>
          </CardTitle>
          <CardDescription>Configure botões de partilha automática</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Auto-partilha de trending topics</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Partilha de resumos IA</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Hashtags automáticas</Label>
                <Switch />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template de partilha:</Label>
                <Input placeholder="📰 {title} - Resumo IA: {summary} #NotiLab" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Horário de partilha:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="time" defaultValue="09:00" />
                  <Input type="time" defaultValue="18:00" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
