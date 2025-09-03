"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TestTube, TrendingUp, Users, Target, Play, Pause } from "lucide-react"

export function ABTesting() {
  const [tests, setTests] = useState([
    {
      id: 1,
      name: "Homepage Hero Text",
      status: "running",
      variants: ["Original", "Variant A"],
      traffic: 50,
      conversions: { original: 12.5, variant: 15.2 },
      confidence: 85,
      duration: "7 days",
    },
    {
      id: 2,
      name: "Newsletter CTA Button",
      status: "completed",
      variants: ["Blue Button", "Green Button"],
      traffic: 100,
      conversions: { original: 8.3, variant: 11.7 },
      confidence: 95,
      duration: "14 days",
    },
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Active Tests</CardTitle>
            <TestTube className="h-4 w-4 text-[#39FF14]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">3</div>
            <p className="text-xs text-gray-400">Currently running</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Avg. Lift</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#007BFF]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">+18.5%</div>
            <p className="text-xs text-gray-400">Conversion improvement</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Test Participants</CardTitle>
            <Users className="h-4 w-4 text-[#39FF14]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12.4K</div>
            <p className="text-xs text-gray-400">This month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Winning Tests</CardTitle>
            <Target className="h-4 w-4 text-[#007BFF]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">8/12</div>
            <p className="text-xs text-gray-400">Success rate: 67%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="active">Active Tests</TabsTrigger>
          <TabsTrigger value="create">Create Test</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="space-y-4">
            {tests.map((test) => (
              <Card key={test.id} className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{test.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={test.status === "running" ? "default" : "secondary"}
                        className={test.status === "running" ? "bg-[#39FF14] text-black" : "bg-gray-700 text-gray-300"}
                      >
                        {test.status}
                      </Badge>
                      {test.status === "running" && (
                        <Button size="sm" variant="outline" className="border-gray-700 bg-transparent">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    Duration: {test.duration} • Confidence: {test.confidence}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-300">Original</h4>
                      <div className="text-2xl font-bold text-white">{test.conversions.original}%</div>
                      <Progress value={test.conversions.original} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-300">Variant A</h4>
                      <div className="text-2xl font-bold text-[#39FF14]">{test.conversions.variant}%</div>
                      <Progress value={test.conversions.variant} className="h-2" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                    <span>
                      Traffic Split: {test.traffic}% / {100 - test.traffic}%
                    </span>
                    <span>
                      {test.conversions.variant > test.conversions.original ? "+" : ""}
                      {(
                        ((test.conversions.variant - test.conversions.original) / test.conversions.original) *
                        100
                      ).toFixed(1)}
                      % lift
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Create New A/B Test</CardTitle>
              <CardDescription>Set up a new experiment to optimize your content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Test Name</Label>
                <Input
                  placeholder="e.g., Homepage CTA Button Color"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Test Type</Label>
                <Select>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="headline">Headline Test</SelectItem>
                    <SelectItem value="cta">CTA Button Test</SelectItem>
                    <SelectItem value="layout">Layout Test</SelectItem>
                    <SelectItem value="image">Image Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Traffic Split (%)</Label>
                  <Input type="number" placeholder="50" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Test Duration (days)</Label>
                  <Input type="number" placeholder="14" className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Success Metric</Label>
                <Select>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select success metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clicks">Click-through Rate</SelectItem>
                    <SelectItem value="conversions">Conversion Rate</SelectItem>
                    <SelectItem value="engagement">Engagement Rate</SelectItem>
                    <SelectItem value="time">Time on Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full bg-[#007BFF] hover:bg-[#0056b3]">
                <Play className="h-4 w-4 mr-2" />
                Start A/B Test
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Test Results Summary</CardTitle>
              <CardDescription>Historical performance of completed tests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tests
                  .filter((test) => test.status === "completed")
                  .map((test) => (
                    <div key={test.id} className="p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">{test.name}</h4>
                        <Badge className="bg-[#39FF14] text-black">Winner: Variant A</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Improvement</p>
                          <p className="text-[#39FF14] font-medium">+41% conversion</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Confidence</p>
                          <p className="text-white font-medium">{test.confidence}%</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Participants</p>
                          <p className="text-white font-medium">2,847 users</p>
                        </div>
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
