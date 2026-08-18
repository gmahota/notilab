"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageBubble } from "@/components/message-bubble"
import { ChatSuggestions } from "@/components/chat-suggestions"
import { fetchFeedPage } from "@/lib/news-client"
import { Send, Mic, MicOff, ImageIcon, Sparkles, Loader2 } from "lucide-react"

interface Message {
  id: string
  content: string
  type: "user" | "assistant"
  timestamp: Date
  isTyping?: boolean
  suggestions?: string[]
  sources?: ArticleSource[]
}

/** One article the answer was drawn from, so the reader can verify it. */
interface ArticleSource {
  id: string
  title: string
  sourceName: string
}

/**
 * The opening suggestions used to be the four keys of the route's canned-answer
 * table ("Explicar a nova lei de IA", …), so they were guaranteed to hit
 * fabricated text. Only the roundup is offered up front now; the rest are
 * replaced with real headlines once the feed loads.
 */
const initialMessages: Message[] = [
  {
    id: "1",
    content: "Olá! Sou o NotiBot. Respondo a partir das notícias que temos em base — se não tivermos cobertura sobre algo, digo-te.",
    type: "assistant",
    timestamp: new Date(),
    suggestions: ["Resumir as notícias de hoje"],
  },
]

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Offer real headlines as openers instead of hardcoded topics.
  useEffect(() => {
    const controller = new AbortController()

    fetchFeedPage({ limit: 3, signal: controller.signal })
      .then((page) => {
        if (page.articles.length === 0) return
        const openers = page.articles.map((a) => a.title.slice(0, 70))
        setMessages((prev) =>
          prev.map((m, i) =>
            i === 0 ? { ...m, suggestions: ["Resumir as notícias de hoje", ...openers] } : m,
          ),
        )
      })
      .catch(() => {
        // Keep the single roundup suggestion.
      })

    return () => controller.abort()
  }, [])

  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      type: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-5), // Send last 5 messages for context
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message,
        type: "assistant",
        timestamp: new Date(),
        suggestions: data.suggestions,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Desculpe, ocorreu um erro. Tente novamente em alguns momentos.",
        type: "assistant",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  const toggleVoice = () => {
    setIsListening(!isListening)
    // TODO: Implement voice recognition
  }

  const handleImageUpload = () => {
    // TODO: Implement image upload
    console.log("Image upload clicked")
  }

  return (
    <Card className="h-[600px] flex flex-col bg-card/50 backdrop-blur-sm">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 text-muted-foreground">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-sm">NotiBot está digitando...</span>
          </div>
        )}

        {/* Suggestions */}
        {messages.length > 0 && messages[messages.length - 1].suggestions && !isLoading && (
          <ChatSuggestions
            suggestions={messages[messages.length - 1].suggestions!}
            onSuggestionClick={handleSuggestionClick}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          {/* Voice Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleVoice}
            className={isListening ? "text-secondary" : "text-muted-foreground"}
          >
            {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>

          {/* Image Upload */}
          <Button type="button" variant="ghost" size="sm" onClick={handleImageUpload} className="text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
          </Button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta sobre notícias..."
              disabled={isLoading}
              className="pr-12"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          </div>

          {/* Send Button */}
          <Button type="submit" disabled={!input.trim() || isLoading} className="bg-primary hover:bg-primary/90">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {/* Quick Actions */}
        <div className="flex items-center justify-center mt-3 text-xs text-muted-foreground">
          <span>Pressione Enter para enviar • Shift+Enter para nova linha</span>
        </div>
      </div>
    </Card>
  )
}
