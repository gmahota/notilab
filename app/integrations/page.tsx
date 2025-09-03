import { Navigation } from "@/components/navigation"
import { SocialIntegrations } from "@/components/social-integrations"
import { NotificationCenter } from "@/components/notification-center"
import { SocialAnalytics } from "@/components/social-analytics"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Integrações Sociais
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Conecte suas redes sociais e configure alertas personalizados para receber notícias onde preferir
            </p>
          </div>

          {/* Integration Tabs */}
          <Tabs defaultValue="social" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="social">Redes Sociais</TabsTrigger>
              <TabsTrigger value="notifications">Notificações</TabsTrigger>
              <TabsTrigger value="analytics">Análises</TabsTrigger>
            </TabsList>

            <TabsContent value="social" className="space-y-6">
              <SocialIntegrations />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <NotificationCenter />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <SocialAnalytics />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
