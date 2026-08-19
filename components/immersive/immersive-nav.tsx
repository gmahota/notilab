"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, MapPin, User, Users, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/now", label: "Agora", icon: Zap },
  { href: "/now/perto", label: "Perto", icon: MapPin },
  { href: "/now/explorar", label: "Explorar", icon: Compass },
  { href: "/now/seguir", label: "Seguir", icon: Users },
  { href: "/profile", label: "Perfil", icon: User },
] as const

/**
 * Always a single floating centered pill, on every breakpoint — no
 * responsive sidebar variant. Shared across /now, /now/perto, /now/explorar,
 * /now/seguir (all render it fixed/floating, so it never affects page
 * layout flow).
 */
export function ImmersiveNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação da experiência Agora"
      className="fixed z-40 flex items-center gap-1 rounded-full p-1.5"
      style={{
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        background: "rgba(10,10,14,.72)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        border: "1px solid rgba(255,255,255,.09)",
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full font-semibold transition-colors",
              active ? "text-white" : "text-white/55 hover:text-white"
            )}
            style={{
              padding: "9px 16px",
              fontSize: 13,
              background: active
                ? "linear-gradient(135deg, rgba(10,127,255,.9), rgba(10,127,255,.6))"
                : "transparent",
              boxShadow: active ? "0 0 16px rgba(10,127,255,.35)" : "none",
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
