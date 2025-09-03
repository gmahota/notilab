"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Target, Flame, BookOpen, Zap, Calendar, Users, Medal, Globe } from "lucide-react"

const userStats = {
  level: 12,
  points: 2450,
  nextLevelPoints: 3000,
  streak: 7,
  articlesRead: 156,
  timeSpent: 2340, // minutes
  rank: 234,
  totalUsers: 15600,
}

const achievements = [
  {
    id: 1,
    name: "Leitor Dedicado",
    description: "Leu 100 artigos",
    icon: BookOpen,
    earned: true,
    rarity: "common",
    date: "2024-01-10",
  },
  {
    id: 2,
    name: "Streak Master",
    description: "7 dias consecutivos",
    icon: Flame,
    earned: true,
    rarity: "rare",
    date: "2024-01-15",
  },
  {
    id: 3,
    name: "Especialista IA",
    description: "Usou chat IA 50 vezes",
    icon: Zap,
    earned: true,
    rarity: "epic",
    date: "2024-01-12",
  },
  {
    id: 4,
    name: "Explorador",
    description: "Leu todas as categorias",
    icon: Globe,
    earned: false,
    rarity: "legendary",
    progress: 80,
  },
]

const weeklyActivity = [
  { day: "Seg", articles: 5, points: 50 },
  { day: "Ter", articles: 8, points: 80 },
  { day: "Qua", articles: 3, points: 30 },
  { day: "Qui", articles: 12, points: 120 },
  { day: "Sex", articles: 7, points: 70 },
  { day: "Sáb", articles: 4, points: 40 },
  { day: "Dom", articles: 6, points: 60 },
]

const leaderboard = [
  { rank: 1, name: "Ana Costa", points: 4560, avatar: "/diverse-user-avatars.png" },
  { rank: 2, name: "Pedro Silva", points: 4120, avatar: "/diverse-user-avatars.png" },
  { rank: 3, name: "Maria Santos", points: 3890, avatar: "/diverse-user-avatars.png" },
  { rank: 234, name: "Você", points: 2450, avatar: "/diverse-user-avatars.png", isCurrentUser: true },
]

export function GamificationDashboard() {
  const progressToNextLevel = ((userStats.points % 1000) / 1000) * 100

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      case "rare":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "epic":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20"
      case "legendary":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Level and Progress */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl font-bold text-white">
            {userStats.level}
          </div>
          <CardTitle>Nível {userStats.level}</CardTitle>
          <CardDescription>Informado Experiente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{userStats.points} pontos</span>
              <span>{userStats.nextLevelPoints} pontos</span>
            </div>
            <Progress value={progressToNextLevel} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {userStats.nextLevelPoints - userStats.points} pontos para o próximo nível
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Estatísticas</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{userStats.articlesRead}</div>
              <div className="text-xs text-muted-foreground">Artigos Lidos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{userStats.streak}</div>
              <div className="text-xs text-muted-foreground">Dias Seguidos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{Math.floor(userStats.timeSpent / 60)}h</div>
              <div className="text-xs text-muted-foreground">Tempo Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">#{userStats.rank}</div>
              <div className="text-xs text-muted-foreground">Ranking</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Atividade Semanal</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weeklyActivity.map((day) => (
              <div key={day.day} className="flex items-center justify-between">
                <span className="text-sm font-medium w-8">{day.day}</span>
                <div className="flex-1 mx-3">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                      style={{ width: `${(day.articles / 12) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">{day.articles} art.</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Conquistas</span>
          </CardTitle>
          <CardDescription>Desbloqueie badges lendo e interagindo com conteúdo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.map((achievement) => {
              const Icon = achievement.icon
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border transition-all ${
                    achievement.earned ? "bg-card border-border" : "bg-muted/50 border-muted opacity-60 grayscale"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        achievement.earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{achievement.name}</h4>
                        <Badge variant="outline" className={getRarityColor(achievement.rarity)}>
                          {achievement.rarity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      {achievement.earned && achievement.date && (
                        <p className="text-xs text-primary">Conquistado em {achievement.date}</p>
                      )}
                      {!achievement.earned && achievement.progress && (
                        <div className="space-y-1">
                          <Progress value={achievement.progress} className="h-1" />
                          <p className="text-xs text-muted-foreground">{achievement.progress}% completo</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Ranking</span>
          </CardTitle>
          <CardDescription>Top utilizadores esta semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaderboard.map((user) => (
              <div
                key={user.rank}
                className={`flex items-center space-x-3 p-2 rounded-lg ${
                  user.isCurrentUser ? "bg-primary/10 border border-primary/20" : ""
                }`}
              >
                <div className="flex items-center space-x-2">
                  {user.rank <= 3 ? (
                    <Medal
                      className={`h-4 w-4 ${user.rank === 1 ? "text-yellow-500" : user.rank === 2 ? "text-gray-400" : "text-orange-500"}`}
                    />
                  ) : (
                    <span className="text-sm font-medium w-4 text-center">#{user.rank}</span>
                  )}
                </div>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xs">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{user.name}</div>
                </div>
                <div className="text-xs text-muted-foreground">{user.points}pts</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
