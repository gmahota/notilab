"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Copy, ExternalLink, ThumbsUp, ThumbsDown, Share, Sparkles, User } from "lucide-react"
import { useState } from "react"

interface ArticleSource {
  id: string
  title: string
  sourceName: string
}

interface Message {
  id: string
  content: string
  type: "user" | "assistant"
  timestamp: Date
  isTyping?: boolean
  suggestions?: string[]
  /** Articles the answer was drawn from — absent when it wasn't grounded. */
  sources?: ArticleSource[]
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

        {/* Sources — lets the reader check the answer against the article it
            came from. An answer with no sources was not grounded in our
            coverage, and shows nothing here rather than a vague citation. */}
        {isAssistant && message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
              {message.sources.length === 1 ? "Fonte" : "Fontes"}
            </p>
            {message.sources.map((source) => (
              <Link
                key={source.id}
                href={`/news/${source.id}`}
                className="flex items-start gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
              >
                <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1 group-hover:underline">
                  {source.title}
                  <span className="text-muted-foreground/50"> · {source.sourceName}</span>
                </span>
              </Link>
            ))}
          </div>
        )}

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
