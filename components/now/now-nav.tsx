"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bookmark, Compass, MessageCircleQuestion, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Spec § 7 — four destinations, no more.
 *
 * This replaces the V1 rail (Agora / Perto / Explorar / Seguir / Perfil), whose
 * two map-based entries were placeholders for geolocation data the schema still
 * does not have. EXPLORE points at the existing `/feed` (search, categories,
 * trends) rather than a new page, and ASK at the existing NotiBot at `/chat`.
 */

const ITEMS = [
  { href: "/now", label: "NOW", icon: Zap },
  { href: "/feed", label: "EXPLORE", icon: Compass },
  { href: "/chat", label: "ASK", icon: MessageCircleQuestion },
  { href: "/saved", label: "SAVED", icon: Bookmark },
] as const

export function NowNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="NotiLab sections"
      className={cn(
        "fixed z-40 flex text-white",
        "inset-x-0 bottom-0 h-16 flex-row items-center justify-around border-t border-white/10 bg-black/80 backdrop-blur-xl",
        "md:inset-y-0 md:left-0 md:right-auto md:h-full md:w-20 md:flex-col md:justify-center md:gap-2 md:border-r md:border-t-0",
      )}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/now" ? pathname.startsWith("/now") : pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold tracking-wide transition-colors md:w-16 md:py-3",
              active ? "text-primary" : "text-white/50 hover:text-white",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
