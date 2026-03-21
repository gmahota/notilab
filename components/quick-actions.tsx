"use client"

import { Button } from "@/components/ui/button"
import { MessageCircle, Mail, Bot, Twitter } from "lucide-react"
import { motion } from "framer-motion"

const actions = [
  {
    label: "Send to WhatsApp",
    icon: MessageCircle,
    color: "text-green-400",
    hoverGlow: "hover:shadow-[0_0_25px_rgba(34,197,94,0.2)]",
    href: "https://wa.me/?text=Check%20out%20NotiLab%20-%20AI-powered%20news%20intelligence",
  },
  {
    label: "Daily Summary",
    icon: Mail,
    color: "text-blue-400",
    hoverGlow: "hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]",
    href: "/profile",
  },
  {
    label: "Telegram Bot",
    icon: Bot,
    color: "text-sky-400",
    hoverGlow: "hover:shadow-[0_0_25px_rgba(56,189,248,0.2)]",
    href: "https://t.me/NotiLabBot",
  },
  {
    label: "Share on X",
    icon: Twitter,
    color: "text-foreground",
    hoverGlow: "hover:shadow-[0_0_25px_rgba(255,255,255,0.1)]",
    href: "https://twitter.com/intent/tweet?text=Check%20out%20NotiLab%20-%20AI-powered%20news%20intelligence",
  },
]

export function QuickActions() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Share & Connect</h2>
        <p className="text-muted-foreground mt-2">Get your news wherever you are</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon
          const isExternal = action.href.startsWith("http")

          return (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                asChild
                variant="ghost"
                className={`w-full h-auto flex-col gap-3 py-8 glass rounded-2xl border border-border/50 hover:border-primary/30 hover:scale-105 transition-all duration-300 ${action.hoverGlow}`}
              >
                <a
                  href={action.href}
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  <Icon className={`h-7 w-7 ${action.color}`} />
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </a>
              </Button>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
