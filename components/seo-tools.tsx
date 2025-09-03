"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, TrendingUp, Globe, CheckCircle, AlertCircle } from "lucide-react"

export function SEOTools() {
  const [seoScore, setSeoScore] = useState(78)
  const [keywords, setKeywords] = useState(["notícias", "IA", "tecnologia", "política"])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">SEO Score</CardTitle>
            <Search className="h-4 w-4 text-[#39FF14]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{seoScore}/100</div>
            <Progress value={seoScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Keywords Ranking</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#007BFF]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">24</div>
            <p className="text-xs text-gray-400">+12% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Organic Traffic</CardTitle>
            <Globe className="h-4 w-4 text-[#39FF14]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12.5K</div>
            <p className="text-xs text-gray-400">+8% from last week</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="keywords" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="content">Content SEO</TabsTrigger>
          <TabsTrigger value="technical">Technical SEO</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
        </TabsList>

        <TabsContent value="keywords" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Keyword Research</CardTitle>
              <CardDescription>Discover and track high-performing keywords</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="Enter keyword..." className="bg-gray-800 border-gray-700 text-white" />
                <Button className="bg-[#007BFF] hover:bg-[#0056b3]">
                  <Search className="h-4 w-4 mr-2" />
                  Research
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Current Keywords</Label>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="bg-gray-800 text-gray-300">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Content Optimization</CardTitle>
              <CardDescription>Optimize your content for better search rankings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Meta Title</Label>
                <Input placeholder="Enter meta title..." className="bg-gray-800 border-gray-700 text-white" />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Meta Description</Label>
                <Textarea placeholder="Enter meta description..." className="bg-gray-800 border-gray-700 text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#39FF14]" />
                  <span className="text-sm text-gray-300">Title length optimal</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">Add more keywords</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Technical SEO Audit</CardTitle>
              <CardDescription>Monitor technical SEO health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Page Speed", status: "good", score: 92 },
                  { name: "Mobile Friendly", status: "good", score: 98 },
                  { name: "SSL Certificate", status: "good", score: 100 },
                  { name: "Sitemap", status: "warning", score: 75 },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-gray-300">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={item.score} className="w-20" />
                      <span className="text-sm text-gray-400">{item.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Competitor Analysis</CardTitle>
              <CardDescription>Track competitor performance and opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Observador", traffic: "2.1M", keywords: 15420, score: 85 },
                  { name: "Público", traffic: "1.8M", keywords: 12350, score: 82 },
                  { name: "Expresso", traffic: "1.5M", keywords: 11200, score: 79 },
                ].map((competitor, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div>
                      <h4 className="font-medium text-white">{competitor.name}</h4>
                      <p className="text-sm text-gray-400">{competitor.traffic} monthly visits</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-300">{competitor.keywords} keywords</p>
                      <p className="text-sm text-[#39FF14]">Score: {competitor.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
