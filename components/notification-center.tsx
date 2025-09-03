"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Bell,
  Smartphone,
  Mail,
  MessageSquare,
  Zap,
  Clock,
  Volume2,
  VolumeX,
  Settings,
  CheckCircle,
} from "lucide-react"

const notificationTypes = [
  {
    id: "breaking",
    name: "Notícias Urgentes",
    description: "Alertas imediatos para notícias importantes",
    icon: Zap,
    enabled: true,
    channels: ["push", "email"],
    priority: "high",
  },
  {
    id: "trending",
    name: "Trending Topics",
    description: "Tópicos que estão a ganhar popularidade",
    icon: Bell,
    enabled: true,
    channels: ["push"],
    priority: "medium",
  },
  {
    id: "personalized",
    name: "Resumos Personalizados",
    description: "Conteúdo baseado nos seus interesses",
    icon: MessageSquare,
    enabled: true,
    channels: ["push", "email"],
    priority: "low",
  },
  {
    id: "digest",
    name: "Digest Diário",
    description: "Resumo das principais notícias do dia",
    icon: Clock,
    enabled: true,
    channels: ["email"],
    priority: "low",
  },
]

const recentNotifications = [
  {
    id: 1,
    type: "breaking",
    title: "Nova Lei de IA Aprovada",
    message: "Parlamento Europeu aprova regulamentação histórica",
    timestamp: new Date("2024-01-15T10:30:00Z"),
    read: false,
    channel: "push",
  },
  {
    id: 2,
    type: "trending",
    title: "Benfica em Trending",
    message: "Vitória na Champions gera 50K+ interações",
    timestamp: new Date("2024-01-15T09:15:00Z"),
    read: true,
    channel: "push",
  },
  {
    id: 3,
    type: "digest",
    title: "Resumo Diário",
    message: "15 notícias importantes de hoje",
    timestamp: new Date("2024-01-15T08:00:00Z"),
    read: true,
    channel: "email",
  },
]

export function NotificationCenter() {
  const [notifications, setNotifications] = useState(notificationTypes)
  const [globalSettings, setGlobalSettings] = useState({
    enabled: true,
    quietHours: { start: "22:00", end: "08:00" },
    frequency: 5, // minutes
    sound: true,
  })

  const toggleNotification = (id: string) => {
    setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, enabled: !notif.enabled } : notif)))
  }

  const updateChannels = (id: string, channel: string, enabled: boolean) => {
    setNotifications((prev) =>
      prev.map((notif) => {
        if (notif.id === id) {
          const channels = enabled ? [...notif.channels, channel] : notif.channels.filter((c) => c !== channel)
          return { ...notif, channels }
        }
        return notif
      }),
    )
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configurações Gerais</span>
          </CardTitle>
          <CardDescription>Controle global das notificações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Notificações Ativas</Label>
                  <p className="text-sm text-muted-foreground">Ativar/desativar todas as notificações</p>
                </div>
                <Switch
                  checked={globalSettings.enabled}
                  onCheckedChange={(enabled) => setGlobalSettings({ ...globalSettings, enabled })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Som das Notificações</Label>
                  <p className="text-sm text-muted-foreground">Reproduzir som ao receber alertas</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={globalSettings.sound}
                    onCheckedChange={(sound) => setGlobalSettings({ ...globalSettings, sound })}
                  />
                  {globalSettings.sound ? (
                    <Volume2 className="h-4 w-4 text-primary" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-4">
              <div>
                <Label className="font-medium">Horário Silencioso</Label>
                <p className="text-sm text-muted-foreground">Período sem notificações</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Select
                    value={globalSettings.quietHours.start}
                    onValueChange={(start) =>
                      setGlobalSettings({
                        ...globalSettings,
                        quietHours: { ...globalSettings.quietHours, start },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                          {`${i.toString().padStart(2, "0")}:00`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Select
                    value={globalSettings.quietHours.end}
                    onValueChange={(end) =>
                      setGlobalSettings({
                        ...globalSettings,
                        quietHours: { ...globalSettings.quietHours, end },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                          {`${i.toString().padStart(2, "0")}:00`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-3">
            <Label className="font-medium">Frequência Máxima</Label>
            <div className="space-y-2">
              <Slider
                value={[globalSettings.frequency]}
                onValueChange={([frequency]) => setGlobalSettings({ ...globalSettings, frequency })}
                max={60}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>1 min</span>
                <span className="font-medium">Máximo a cada {globalSettings.frequency} minutos</span>
                <span>60 min</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {notifications.map((notification) => {
          const Icon = notification.icon

          return (
            <Card key={notification.id} className={notification.enabled ? "ring-1 ring-primary/20" : "opacity-60"}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{notification.name}</CardTitle>
                      <Badge variant="outline" className={getPriorityColor(notification.priority)}>
                        {notification.priority}
                      </Badge>
                    </div>
                  </div>
                  <Switch checked={notification.enabled} onCheckedChange={() => toggleNotification(notification.id)} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{notification.description}</p>

                {notification.enabled && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Canais de Entrega:</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Push Notification</span>
                        </div>
                        <Switch
                          checked={notification.channels.includes("push")}
                          onCheckedChange={(enabled) => updateChannels(notification.id, "push", enabled)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Email</span>
                        </div>
                        <Switch
                          checked={notification.channels.includes("email")}
                          onCheckedChange={(enabled) => updateChannels(notification.id, "email", enabled)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">WhatsApp/Telegram</span>
                        </div>
                        <Switch
                          checked={notification.channels.includes("social")}
                          onCheckedChange={(enabled) => updateChannels(notification.id, "social", enabled)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notificações Recentes</span>
          </CardTitle>
          <CardDescription>Histórico das últimas notificações enviadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  notif.read ? "bg-muted/30" : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${notif.read ? "bg-muted-foreground" : "bg-primary"}`} />
                  <div>
                    <h4 className="font-medium text-sm">{notif.title}</h4>
                    <p className="text-xs text-muted-foreground">{notif.message}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {notif.channel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatTime(notif.timestamp)}</span>
                    </div>
                  </div>
                </div>
                {!notif.read && <CheckCircle className="h-4 w-4 text-primary" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
