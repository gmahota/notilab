"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Mail, Phone, Calendar, TrendingUp, Filter, Download, UserPlus } from "lucide-react"

export function LeadManagement() {
  const [leads, setLeads] = useState([
    {
      id: 1,
      name: "João Silva",
      email: "joao@email.com",
      phone: "+351 912 345 678",
      source: "Newsletter",
      status: "hot",
      score: 85,
      lastActivity: "2024-01-15",
      interests: ["Política", "Tecnologia"],
    },
    {
      id: 2,
      name: "Maria Santos",
      email: "maria@email.com",
      phone: "+351 923 456 789",
      source: "Social Media",
      status: "warm",
      score: 65,
      lastActivity: "2024-01-14",
      interests: ["Desporto", "Economia"],
    },
    {
      id: 3,
      name: "Pedro Costa",
      email: "pedro@email.com",
      phone: "+351 934 567 890",
      source: "Website",
      status: "cold",
      score: 35,
      lastActivity: "2024-01-12",
      interests: ["Cultura"],
    },
  ])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "hot":
        return "bg-red-500"
      case "warm":
        return "bg-yellow-500"
      case "cold":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-[#39FF14]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1,247</div>
            <p className="text-xs text-gray-400">+12% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Hot Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">89</div>
            <p className="text-xs text-gray-400">Ready to convert</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Conversion Rate</CardTitle>
            <UserPlus className="h-4 w-4 text-[#007BFF]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">24.5%</div>
            <p className="text-xs text-gray-400">+3.2% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Avg. Lead Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#39FF14]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">67</div>
            <p className="text-xs text-gray-400">Quality score</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="leads">All Leads</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Lead Database</CardTitle>
                  <CardDescription>Manage and track your leads</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-gray-700 bg-transparent">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm" className="border-gray-700 bg-transparent">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input placeholder="Search leads..." className="bg-gray-800 border-gray-700 text-white flex-1" />
                  <Select>
                    <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="hot">Hot</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {leads.map((lead) => (
                    <div key={lead.id} className="p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-gray-300" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white">{lead.name}</h4>
                            <p className="text-sm text-gray-400">{lead.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(lead.status)} text-white`}>
                            {lead.status.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-400">Score: {lead.score}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Source</p>
                          <p className="text-white">{lead.source}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Phone</p>
                          <p className="text-white">{lead.phone}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Last Activity</p>
                          <p className="text-white">{lead.lastActivity}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Interests</p>
                          <div className="flex gap-1 mt-1">
                            {lead.interests.map((interest, index) => (
                              <Badge key={index} variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Lead Score</span>
                          <span className="text-xs text-gray-400">{lead.score}/100</span>
                        </div>
                        <Progress value={lead.score} className="h-2" />
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="border-gray-700 bg-transparent">
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-700 bg-transparent">
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-700 bg-transparent">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Lead Segments</CardTitle>
              <CardDescription>Organize leads into targeted segments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "High-Value Prospects", count: 156, color: "bg-red-500" },
                  { name: "Newsletter Subscribers", count: 892, color: "bg-blue-500" },
                  { name: "Social Media Leads", count: 234, color: "bg-green-500" },
                ].map((segment, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${segment.color}`}></div>
                      <h4 className="font-medium text-white">{segment.name}</h4>
                    </div>
                    <p className="text-2xl font-bold text-white">{segment.count}</p>
                    <p className="text-sm text-gray-400">leads in segment</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Lead Generation Campaigns</CardTitle>
              <CardDescription>Track performance of your marketing campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Newsletter Signup Campaign", leads: 234, conversion: 12.5, cost: "€156" },
                  { name: "Social Media Ads", leads: 189, conversion: 8.7, cost: "€289" },
                  { name: "Content Marketing", leads: 145, conversion: 15.2, cost: "€98" },
                ].map((campaign, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{campaign.name}</h4>
                      <Badge variant="secondary" className="bg-gray-700 text-gray-300">
                        Active
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Leads Generated</p>
                        <p className="text-white font-medium">{campaign.leads}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Conversion Rate</p>
                        <p className="text-[#39FF14] font-medium">{campaign.conversion}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Cost per Lead</p>
                        <p className="text-white font-medium">{campaign.cost}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { source: "Website", percentage: 45, count: 561 },
                    { source: "Social Media", percentage: 30, count: 374 },
                    { source: "Newsletter", percentage: 15, count: 187 },
                    { source: "Referrals", percentage: 10, count: 125 },
                  ].map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{item.source}</span>
                        <span className="text-gray-400">{item.count} leads</span>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Lead Quality Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { quality: "Hot (80-100)", percentage: 15, color: "bg-red-500" },
                    { quality: "Warm (60-79)", percentage: 35, color: "bg-yellow-500" },
                    { quality: "Cold (40-59)", percentage: 30, color: "bg-blue-500" },
                    { quality: "Low (0-39)", percentage: 20, color: "bg-gray-500" },
                  ].map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{item.quality}</span>
                        <span className="text-gray-400">{item.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${item.color}`}
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
