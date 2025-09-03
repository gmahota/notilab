"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Copy, ThumbsUp, ThumbsDown, Share, Sparkles, User } from "lucide-react"
import { useState } from "react"

interface Message {
  id: string
  content: string
  type: "user" | "assistant"
  timestamp: Date
  isTyping?: boolean
  suggestions?: string[]
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState<boolean | null>(null)

  const isUser = message.type === "user"
  const isAssistant = message.type === "assistant"

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const handleLike = (isPositive: boolean) => {
    setLiked(isPositive)
    // TODO: Send feedback to API
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        {isAssistant ? (
          <>
            <AvatarImage src="/placeholder.svg?key=notibot" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/diverse-user-avatars.png" />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted text-muted-foreground"
          }`}
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Message Meta */}
        <div className={`flex items-center mt-2 space-x-2 ${isUser ? "justify-end" : "justify-start"}`}>
          <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>

          {/* Assistant Message Actions */}
          {isAssistant && (
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLike(true)}
                className={`h-6 w-6 p-0 ${
                  liked === true ? "text-green-500" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLike(false)}
                className={`h-6 w-6 p-0 ${
                  liked === false ? "text-red-500" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>

              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                <Share className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Copy Feedback */}
        {copied && <div className="text-xs text-green-500 mt-1">Copiado para a área de transferência!</div>}
      </div>
    </div>
  )
}
