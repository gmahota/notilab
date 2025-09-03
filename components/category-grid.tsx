"use client"

import { Card } from "@/components/ui/card"
import { Scale, Gamepad2, Globe, Briefcase, Zap, Users, BookOpen } from "lucide-react"

const categories = [
  {
    name: "Política",
    icon: Scale,
    description: "Eleições, leis e decisões governamentais",
    color: "from-red-500/20 to-red-600/20",
    borderColor: "border-red-500/30",
    count: "234 notícias",
  },
  {
    name: "Desporto",
    icon: Gamepad2,
    description: "Futebol, competições e resultados",
    color: "from-green-500/20 to-green-600/20",
    borderColor: "border-green-500/30",
    count: "189 notícias",
  },
  {
    name: "Cultura",
    icon: Globe,
    description: "Arte, música, cinema e eventos",
    color: "from-purple-500/20 to-purple-600/20",
    borderColor: "border-purple-500/30",
    count: "156 notícias",
  },
  {
    name: "Economia",
    icon: Briefcase,
    description: "Mercados, empresas e finanças",
    color: "from-blue-500/20 to-blue-600/20",
    borderColor: "border-blue-500/30",
    count: "298 notícias",
  },
  {
    name: "Tecnologia",
    icon: Zap,
    description: "Inovação, startups e ciência",
    color: "from-yellow-500/20 to-yellow-600/20",
    borderColor: "border-yellow-500/30",
    count: "167 notícias",
  },
  {
    name: "Sociedade",
    icon: Users,
    description: "Comunidade, saúde e educação",
    color: "from-pink-500/20 to-pink-600/20",
    borderColor: "border-pink-500/30",
    count: "203 notícias",
  },
]

export function CategoryGrid() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="space-y-8">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold">Explore por Categoria</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Descubra notícias organizadas por temas que mais lhe interessam
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <Card
                key={category.name}
                className={`p-6 cursor-pointer card-hover relative overflow-hidden bg-gradient-to-br ${category.color} ${category.borderColor} border-2 group`}
              >
                <div className="relative z-10 space-y-4">
                  {/* Icon and Name */}
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-background/20 backdrop-blur-sm">
                      <Icon className="h-6 w-6 text-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{category.name}</h3>
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">{category.description}</p>

                  {/* Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{category.count}</span>
                    <div className="flex items-center text-sm text-primary">
                      <BookOpen className="h-4 w-4 mr-1" />
                      Explorar
                    </div>
                  </div>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
