"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function NewsChart() {
  const data = [
    { name: "Jan", published: 65, views: 2400 },
    { name: "Fev", published: 59, views: 1398 },
    { name: "Mar", published: 80, views: 9800 },
    { name: "Abr", published: 81, views: 3908 },
    { name: "Mai", published: 56, views: 4800 },
    { name: "Jun", published: 55, views: 3800 },
    { name: "Jul", published: 40, views: 4300 },
  ]

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Notícias e Visualizações</CardTitle>
        <CardDescription className="text-gray-400">Evolução mensal de conteúdo publicado e engagement</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#F9FAFB",
              }}
            />
            <Line type="monotone" dataKey="published" stroke="#3B82F6" strokeWidth={2} name="Notícias Publicadas" />
            <Line type="monotone" dataKey="views" stroke="#10B981" strokeWidth={2} name="Visualizações (k)" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
