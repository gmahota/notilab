import { Navigation } from "@/components/navigation"
import { UserPreferences } from "@/components/user-preferences"
import { GamificationDashboard } from "@/components/gamification-dashboard"
import { ReadingHistory } from "@/components/reading-history"
import { PersonalizedFeed } from "@/components/personalized-feed"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Meu Perfil
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Personalize sua experiência no NotiLab e acompanhe seu progresso
            </p>
          </div>

          {/* Profile Tabs */}
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="preferences">Preferências</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="feed">Feed Personalizado</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <GamificationDashboard />
            </TabsContent>

            <TabsContent value="preferences" className="space-y-6">
              <UserPreferences />
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <ReadingHistory />
            </TabsContent>

            <TabsContent value="feed" className="space-y-6">
              <PersonalizedFeed />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
