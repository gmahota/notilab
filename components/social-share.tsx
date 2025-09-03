"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Share2, Copy, Check, MessageCircle, Send, Twitter, Facebook, Linkedin, Mail } from "lucide-react"

interface SocialShareProps {
  title: string
  summary: string
  url: string
  category: string
}

const socialPlatforms = [
  {
    name: "WhatsApp",
    icon: MessageCircle,
    color: "bg-green-500 hover:bg-green-600",
    action: "whatsapp",
  },
  {
    name: "Telegram",
    icon: Send,
    color: "bg-blue-500 hover:bg-blue-600",
    action: "telegram",
  },
  {
    name: "Twitter",
    icon: Twitter,
    color: "bg-black hover:bg-gray-800",
    action: "twitter",
  },
  {
    name: "Facebook",
    icon: Facebook,
    color: "bg-blue-600 hover:bg-blue-700",
    action: "facebook",
  },
  {
    name: "LinkedIn",
    icon: Linkedin,
    color: "bg-blue-700 hover:bg-blue-800",
    action: "linkedin",
  },
  {
    name: "Email",
    icon: Mail,
    color: "bg-gray-600 hover:bg-gray-700",
    action: "email",
  },
]

export function SocialShare({ title, summary, url, category }: SocialShareProps) {
  const [copied, setCopied] = useState(false)
  const [customMessage, setCustomMessage] = useState("")

  const shareUrl = `https://notilab.app${url}`
  const defaultMessage = `📰 ${title}\n\n${summary}\n\n#NotiLab #${category}`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const shareToSocial = (platform: string) => {
    const message = customMessage || defaultMessage
    const encodedMessage = encodeURIComponent(message)
    const encodedUrl = encodeURIComponent(shareUrl)

    let shareLink = ""

    switch (platform) {
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`
        break
      case "telegram":
        shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`
        break
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`
        break
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        break
      case "linkedin":
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        break
      case "email":
        shareLink = `mailto:?subject=${encodeURIComponent(title)}&body=${encodedMessage}%20${encodedUrl}`
        break
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "width=600,height=400")
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partilhar Notícia</DialogTitle>
          <DialogDescription>Escolha como quer partilhar esta notícia</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Article Preview */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <Badge variant="secondary">{category}</Badge>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem Personalizada (Opcional)</Label>
            <Textarea
              id="message"
              placeholder={defaultMessage}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Social Platforms */}
          <div className="space-y-3">
            <Label>Partilhar em:</Label>
            <div className="grid grid-cols-2 gap-2">
              {socialPlatforms.map((platform) => {
                const Icon = platform.icon
                return (
                  <Button
                    key={platform.name}
                    variant="outline"
                    onClick={() => shareToSocial(platform.action)}
                    className={`${platform.color} text-white border-0`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {platform.name}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Copy Link */}
          <div className="space-y-2">
            <Label>Ou copie o link:</Label>
            <div className="flex items-center space-x-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-green-500">Link copiado para a área de transferência!</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
