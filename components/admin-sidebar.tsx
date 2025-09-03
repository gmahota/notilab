"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  BarChart3,
  MessageSquare,
  Folder,
  Zap,
  Workflow,
  Megaphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

interface AdminSidebarProps {
  userRole: string
}

export function AdminSidebar({ userRole }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  const menuItems = [
    {
      title: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      roles: ["REDATOR", "REVISOR", "SUPERVISOR", "MARKETING", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Notícias",
      href: "/admin/news",
      icon: FileText,
      roles: ["REDATOR", "REVISOR", "SUPERVISOR", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Gerador IA",
      href: "/admin/ai-generator",
      icon: Zap,
      roles: ["REDATOR", "CRIADOR_CONTEUDO", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Workflow",
      href: "/admin/workflow",
      icon: Workflow,
      roles: ["REVISOR", "SUPERVISOR", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Utilizadores",
      href: "/admin/users",
      icon: Users,
      roles: ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      roles: ["MARKETING", "SUPERVISOR", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Marketing",
      href: "/admin/marketing",
      icon: Megaphone,
      roles: ["MARKETING", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Categorias",
      href: "/admin/categories",
      icon: Folder,
      roles: ["SUPERVISOR", "ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Chat IA",
      href: "/admin/chat",
      icon: MessageSquare,
      roles: ["ADMIN", "SUPER_ADMIN"],
    },
    {
      title: "Configurações",
      href: "/admin/settings",
      icon: Settings,
      roles: ["ADMIN", "SUPER_ADMIN"],
    },
  ]

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(userRole))

  return (
    <div
      className={cn(
        "bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-white font-semibold">NotiLab Admin</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white hover:bg-gray-800",
                    collapsed && "justify-center",
                  )}
                >
                  <Icon className={cn("w-5 h-5", !collapsed && "mr-3")} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Role Badge */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-800">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Função</p>
            <p className="text-white font-medium mt-1">{userRole.replace("_", " ")}</p>
          </div>
        </div>
      )}
    </div>
  )
}
