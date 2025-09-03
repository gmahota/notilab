"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Bell, MessageCircle, Menu, Zap, TrendingUp, Globe, Gamepad2, Briefcase, Scale } from "lucide-react"
import Link from "next/link"

const categories = [
  { name: "Política", icon: Scale, slug: "politica" },
  { name: "Desporto", icon: Gamepad2, slug: "desporto" },
  { name: "Cultura", icon: Globe, slug: "cultura" },
  { name: "Economia", icon: Briefcase, slug: "economia" },
  { name: "Tendências", icon: TrendingUp, slug: "tendencias" },
]

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            
            <img src="/logo.png" alt="NotiLab Logo" className="h-8 w-auto" />
          </Link>

          {/* Desktop Categories */}
          <div className="hidden md:flex items-center space-x-1">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Link key={category.slug} href={`/feed?category=${category.slug}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {category.name}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {/* Search */}
            <Link href="/feed">
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <Search className="h-4 w-4" />
              </Button>
            </Link>

            {/* Chat IA */}
            <Link href="/chat">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                NotiBot
              </Button>
            </Link>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-secondary rounded-full animate-pulse" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>Perfil</DropdownMenuItem>
                <DropdownMenuItem>Preferências</DropdownMenuItem>
                <DropdownMenuItem>Histórico</DropdownMenuItem>
                <DropdownMenuItem>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Categories */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => {
                const Icon = category.icon
                return (
                  <Link key={category.slug} href={`/feed?category=${category.slug}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-muted-foreground hover:text-foreground"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category.name}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
