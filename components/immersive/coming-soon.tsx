import type { LucideIcon } from "lucide-react"

import { ImmersiveNav } from "@/components/immersive/immersive-nav"

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description: string
}

/** Honest "not built yet" shell for /now/* stub routes — no fake data, no fake preview. */
export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-y-auto bg-black">
      <div className="flex min-h-full items-center justify-center px-6 pb-24 pt-16 md:pb-16 md:pl-28 md:pr-10">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Em breve</p>
          <h1 className="mb-3 text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm leading-relaxed text-white/60">{description}</p>
        </div>
      </div>
      <ImmersiveNav />
    </div>
  )
}
