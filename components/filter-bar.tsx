"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Scale, Gamepad2, Globe, Briefcase, TrendingUp, Filter, Clock, Heart, Eye } from "lucide-react"

const categories = [
  { name: "Todas", icon: Globe, slug: "all" },
  { name: "Política", icon: Scale, slug: "politica" },
  { name: "Desporto", icon: Gamepad2, slug: "desporto" },
  { name: "Cultura", icon: Globe, slug: "cultura" },
  { name: "Economia", icon: Briefcase, slug: "economia" },
  { name: "Tendências", icon: TrendingUp, slug: "tendencias" },
]

const sortOptions = [
  { name: "Mais Recentes", value: "recent", icon: Clock },
  { name: "Mais Populares", value: "popular", icon: Heart },
  { name: "Mais Visualizadas", value: "views", icon: Eye },
  { name: "Trending", value: "trending", icon: TrendingUp },
]

export function FilterBar() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [sortBy, setSortBy] = useState("recent")

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
      {/* Categories */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => {
          const Icon = category.icon
          const isActive = activeCategory === category.slug

          return (
            <Button
              key={category.slug}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category.slug)}
              className={`${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent/50"
              } transition-all duration-200`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {category.name}
            </Button>
          )
        })}
      </div>

      {/* Sort Options */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground hidden sm:block">Ordenar por:</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              {sortOptions.find((opt) => opt.value === sortBy)?.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {sortOptions.map((option) => {
              const Icon = option.icon
              return (
                <DropdownMenuItem key={option.value} onClick={() => setSortBy(option.value)} className="cursor-pointer">
                  <Icon className="h-4 w-4 mr-2" />
                  {option.name}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
