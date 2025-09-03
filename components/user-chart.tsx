"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function UserChart() {
  const data = [
    { name: "Jovem", users: 4500, active: 3200 },
    { name: "Executivo", users: 3200, active: 2100 },
    { name: "Estudante", users: 2800, active: 2400 },
    { name: "Senior", users: 2043, active: 1200 },
  ]

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Utilizadores por Perfil</CardTitle>
        <CardDescription className="text-gray-400">Distribuição e atividade por tipo de utilizador</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
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
            <Bar dataKey="users" fill="#3B82F6" name="Total Utilizadores" radius={[4, 4, 0, 0]} />
            <Bar dataKey="active" fill="#10B981" name="Utilizadores Ativos" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
