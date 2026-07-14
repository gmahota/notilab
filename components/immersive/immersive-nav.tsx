"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Flame, MapPin, User, Users, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/now", label: "Agora", icon: Zap },
  { href: "/now/perto", label: "Perto", icon: MapPin },
  { href: "/now/explorar", label: "Explorar", icon: Compass },
  { href: "/now/seguir", label: "Seguir", icon: Users },
  { href: "/profile", label: "Perfil", icon: User },
] as const

const TRENDING_ITEM = { href: "/trending", label: "Em Alta", icon: Flame } as const

export function ImmersiveNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação da experiência Agora"
      className={cn(
        "fixed z-40 flex text-white",
        "inset-x-0 bottom-0 h-16 flex-row items-center justify-around border-t border-white/10 bg-black/70 backdrop-blur-xl",
        "md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-20 md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:py-8"
      )}
    >
      <div className="hidden md:mb-6 md:flex md:flex-col md:items-center">
        <span className="text-gradient text-lg font-bold">N</span>
      </div>

      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
              "md:w-16 md:py-3",
              active ? "text-primary" : "text-white/55 hover:text-white"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "glow-blue-sm rounded-full")} />
            {label}
          </Link>
        )
      })}

      <Link
        href={TRENDING_ITEM.href}
        aria-current={pathname === TRENDING_ITEM.href ? "page" : undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
          "md:mt-auto md:w-16 md:py-3",
          pathname === TRENDING_ITEM.href ? "text-secondary" : "text-white/55 hover:text-white"
        )}
      >
        <Flame className="h-5 w-5" />
        {TRENDING_ITEM.label}
      </Link>
    </nav>
  )
}
