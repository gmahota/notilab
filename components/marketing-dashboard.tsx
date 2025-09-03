"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarketingAnalytics } from "./marketing-analytics"
import { CampaignManager } from "./campaign-manager"
import { NewsletterManager } from "./newsletter-manager"
import { SEOTools } from "./seo-tools"
import { SocialMediaManager } from "./social-media-manager"
import { ABTesting } from "./ab-testing"
import { LeadManagement } from "./lead-management"
import { Megaphone, TrendingUp, Mail, Share2, Search, BarChart3, TestTube, Users } from "lucide-react"

interface MarketingDashboardProps {
  user: any
}

export function MarketingDashboard({ user }: MarketingDashboardProps) {
  const [activeTab, setActiveTab] = useState("analytics")

  const marketingStats = {
    totalSubscribers: 15420,
    monthlyGrowth: 12.5,
    emailOpenRate: 24.8,
    socialEngagement: 8.9,
    seoScore: 85,
    conversionRate: 3.2,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Megaphone className="w-8 h-8 mr-3 text-pink-400" />
            Marketing & Promoção
          </h1>
          <p className="text-gray-400 mt-1">Ferramentas de marketing digital e análise de performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className="bg-green-600 text-white">
            <TrendingUp className="w-3 h-3 mr-1" />+{marketingStats.monthlyGrowth}% este mês
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Subscribers</CardTitle>
            <Mail className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{marketingStats.totalSubscribers.toLocaleString()}</div>
            <p className="text-xs text-green-400">+{marketingStats.monthlyGrowth}% este mês</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Open Rate</CardTitle>
            <Mail className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{marketingStats.emailOpenRate}%</div>
            <p className="text-xs text-green-400">+2.1% vs média</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Social Engagement</CardTitle>
            <Share2 className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{marketingStats.socialEngagement}%</div>
            <p className="text-xs text-green-400">+1.3% esta semana</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">SEO Score</CardTitle>
            <Search className="w-4 h-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{marketingStats.seoScore}/100</div>
            <p className="text-xs text-green-400">+5 pontos</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Conversão</CardTitle>
            <TrendingUp className="w-4 h-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{marketingStats.conversionRate}%</div>
            <p className="text-xs text-green-400">+0.8% este mês</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">ROI</CardTitle>
            <BarChart3 className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">245%</div>
            <p className="text-xs text-green-400">+15% vs Q anterior</p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Tools Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 bg-gray-900 border-gray-800">
          <TabsTrigger value="analytics" className="text-gray-300 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-gray-300 data-[state=active]:text-white">
            <Megaphone className="w-4 h-4 mr-2" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="newsletter" className="text-gray-300 data-[state=active]:text-white">
            <Mail className="w-4 h-4 mr-2" />
            Newsletter
          </TabsTrigger>
          <TabsTrigger value="social" className="text-gray-300 data-[state=active]:text-white">
            <Share2 className="w-4 h-4 mr-2" />
            Social Media
          </TabsTrigger>
          <TabsTrigger value="seo" className="text-gray-300 data-[state=active]:text-white">
            <Search className="w-4 h-4 mr-2" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="testing" className="text-gray-300 data-[state=active]:text-white">
            <TestTube className="w-4 h-4 mr-2" />
            A/B Testing
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-gray-300 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <MarketingAnalytics stats={marketingStats} />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignManager user={user} />
        </TabsContent>

        <TabsContent value="newsletter">
          <NewsletterManager user={user} />
        </TabsContent>

        <TabsContent value="social">
          <SocialMediaManager />
        </TabsContent>

        <TabsContent value="seo">
          <SEOTools />
        </TabsContent>

        <TabsContent value="testing">
          <ABTesting />
        </TabsContent>

        <TabsContent value="leads">
          <LeadManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
