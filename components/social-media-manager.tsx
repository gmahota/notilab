"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  CalendarIcon,
  Clock,
  Users,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react"

export function SocialMediaManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [posts, setPosts] = useState([
    {
      id: 1,
      platform: "Twitter",
      content: "Nova lei de IA aprovada no Parlamento Europeu! 🚀 #IA #Tecnologia",
      scheduledFor: "2024-01-15 14:00",
      status: "scheduled",
      engagement: { likes: 45, comments: 12, shares: 8 },
    },
    {
      id: 2,
      platform: "Facebook",
      content: "Análise completa sobre o impacto da inteligência artificial no jornalismo moderno.",
      scheduledFor: "2024-01-15 16:30",
      status: "published",
      engagement: { likes: 128, comments: 34, shares: 22 },
    },
  ])

  const platforms = [
    { name: "Facebook", icon: Facebook, color: "#1877F2", followers: "12.5K" },
    { name: "Twitter", icon: Twitter, color: "#1DA1F2", followers: "8.2K" },
    { name: "Instagram", icon: Instagram, color: "#E4405F", followers: "15.1K" },
    { name: "LinkedIn", icon: Linkedin, color: "#0A66C2", followers: "5.8K" },
  ]

  return (
    <div className="space-y-6">
      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {platforms.map((platform, index) => {
          const IconComponent = platform.icon
          return (
            <Card key={index} className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">{platform.name}</CardTitle>
                <IconComponent className="h-4 w-4" style={{ color: platform.color }} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{platform.followers}</div>
                <p className="text-xs text-gray-400">followers</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Create New Post</CardTitle>
              <CardDescription>Compose and schedule posts across all platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Select Platforms</Label>
                <div className="flex gap-2">
                  {platforms.map((platform, index) => {
                    const IconComponent = platform.icon
                    return (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="border-gray-700 hover:bg-gray-800 bg-transparent"
                      >
                        <IconComponent className="h-4 w-4 mr-2" style={{ color: platform.color }} />
                        {platform.name}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Post Content</Label>
                <Textarea
                  placeholder="What's happening?"
                  className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Schedule Date</Label>
                  <Input type="date" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Schedule Time</Label>
                  <Input type="time" className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="bg-[#007BFF] hover:bg-[#0056b3]">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Schedule Post
                </Button>
                <Button variant="outline" className="border-gray-700 hover:bg-gray-800 bg-transparent">
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Scheduled Posts</CardTitle>
              <CardDescription>Manage your upcoming social media posts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-gray-700 text-gray-300">
                          {post.platform}
                        </Badge>
                        <Badge
                          variant={post.status === "published" ? "default" : "secondary"}
                          className={
                            post.status === "published" ? "bg-[#39FF14] text-black" : "bg-gray-700 text-gray-300"
                          }
                        >
                          {post.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock className="h-4 w-4" />
                        {post.scheduledFor}
                      </div>
                    </div>

                    <p className="text-gray-300 mb-3">{post.content}</p>

                    {post.status === "published" && (
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {post.engagement.likes}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          {post.engagement.comments}
                        </div>
                        <div className="flex items-center gap-1">
                          <Share2 className="h-4 w-4" />
                          {post.engagement.shares}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">Total Reach</CardTitle>
                <Users className="h-4 w-4 text-[#39FF14]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">45.2K</div>
                <p className="text-xs text-gray-400">+15% from last week</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">Engagement Rate</CardTitle>
                <Heart className="h-4 w-4 text-[#007BFF]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">8.7%</div>
                <p className="text-xs text-gray-400">+2.1% from last week</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">New Followers</CardTitle>
                <Users className="h-4 w-4 text-[#39FF14]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">+342</div>
                <p className="text-xs text-gray-400">This week</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Content Calendar</CardTitle>
              <CardDescription>View and manage your content schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border border-gray-700"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
