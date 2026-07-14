"use client"

import { MessageCircle, Send, X } from "lucide-react"

interface SocialShareProps {
  title: string
  /** Relative path, e.g. /news/123 */
  url: string
}

const BASE_URL = "https://notilab.app"

const PLATFORMS = [
  {
    id: "whatsapp",
    label: "Share on WhatsApp",
    icon: MessageCircle,
    build: (text: string, link: string) =>
      `https://wa.me/?text=${text}%20${link}`,
    hover:
      "hover:text-[#25D366] hover:bg-[#25D366]/12 hover:border-[#25D366]/35 hover:[box-shadow:0_0_10px_rgba(37,211,102,0.3)]",
  },
  {
    id: "telegram",
    label: "Share on Telegram",
    icon: Send,
    build: (text: string, link: string) =>
      `https://t.me/share/url?url=${link}&text=${text}`,
    hover:
      "hover:text-[#2AABEE] hover:bg-[#2AABEE]/12 hover:border-[#2AABEE]/35 hover:[box-shadow:0_0_10px_rgba(42,171,238,0.3)]",
  },
  {
    id: "x",
    label: "Share on X",
    icon: X,
    build: (text: string, link: string) =>
      `https://twitter.com/intent/tweet?text=${text}&url=${link}`,
    hover:
      "hover:text-white hover:bg-white/10 hover:border-white/30 hover:[box-shadow:0_0_10px_rgba(255,255,255,0.15)]",
  },
] as const

export function SocialShare({ title, url }: SocialShareProps) {
  const fullUrl = `${BASE_URL}${url}`
  const encodedText = encodeURIComponent(`📰 ${title}`)
  const encodedUrl = encodeURIComponent(fullUrl)

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {PLATFORMS.map(({ id, label, icon: Icon, build, hover }) => (
        <a
          key={id}
          href={build(encodedText, encodedUrl)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={`
            w-7 h-7 rounded-lg flex items-center justify-center
            text-white/35 border border-transparent
            transition-all duration-200 cursor-pointer
            ${hover}
          `}
        >
          <Icon className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  )
}
