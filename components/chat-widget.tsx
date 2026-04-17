"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, X, Send, Loader2, Minus } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: "user" | "bot"
  text: string
  timestamp: Date
}

// ─── Mock responses ───────────────────────────────────────────────────────────

const MOCK_REPLIES = [
  "Today's theme? Rapid change across tech, politics, and climate. Ask me to dig into any of it.",
  "Key takeaway: AI regulation is accelerating. EU's leading the charge — others are scrambling to keep up.",
  "Top 3 right now: AI policy, energy transition, sports upset. Want the 30s version of any?",
  "30 seconds: tech disruption meets geopolitical shifts. Pick a topic and I'll break it down.",
  "No noise — that story is one decision affecting millions over the next decade. Scary? A bit.",
]

let mockIdx = 0
const getMockReply = () => MOCK_REPLIES[mockIdx++ % MOCK_REPLIES.length]

// ─── Typing dots ─────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  )
}

// ─── Message bubble ──────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5 mr-2">
          <Sparkles className="h-3 w-3 text-blue-400" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white/8 border border-white/10 text-white/85 rounded-bl-sm"
        }`}
      >
        {msg.text}
      </div>
    </motion.div>
  )
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

function ChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "bot",
      text: "Hey! I'm NotiBot. 👋 Drop a question, paste a link, or just tell me what's going on.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      setInput("")
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", text: trimmed, timestamp: new Date() },
      ])
      setLoading(true)

      // Try real API, fall back to mock
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        })
        const data = res.ok ? await res.json() : null
        const reply = data?.message ?? getMockReply()
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "bot", text: reply, timestamp: new Date() },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "bot", text: getMockReply(), timestamp: new Date() },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading]
  )

  const SUGGESTIONS = ["What happened today?", "Explain AI regulation", "30s market summary"]

  return (
    <motion.div
      key="panel"
      initial={{ scale: 0.88, opacity: 0, y: 24 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.88, opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="w-[22rem] rounded-2xl bg-[#0c1120] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7),0_0_40px_rgba(0,123,255,0.12)] overflow-hidden flex flex-col"
      style={{ maxHeight: minimized ? "auto" : "520px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#0a0f1c] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">NotiBot</p>
            <p className="text-[10px] text-[#39FF14] font-medium mt-0.5">● Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            aria-label={minimized ? "Expand" : "Minimise"}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all duration-200 cursor-pointer"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all duration-200 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map((msg) => (
              <Bubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions — show only when 1 message */}
          {messages.length === 1 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/55 hover:bg-blue-500/15 hover:border-blue-500/35 hover:text-blue-300 transition-all duration-200 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="flex items-center gap-2 px-3 py-3 border-t border-white/8 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              autoComplete="off"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all duration-200"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send"
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 hover:[box-shadow:0_0_14px_rgba(0,123,255,0.5)] cursor-pointer shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </form>
        </>
      )}
    </motion.div>
  )
}

// ─── Widget (FAB + panel) ────────────────────────────────────────────────────

export function ChatWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {open && <ChatPanel key="panel" onClose={() => setOpen(false)} />}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close NotiBot" : "Open NotiBot"}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="relative flex items-center gap-2.5 pl-4 pr-5 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg hover:[box-shadow:0_0_28px_rgba(0,123,255,0.55)] transition-colors duration-200 cursor-pointer"
      >
        {/* Pulse ring — only when closed */}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-blue-500/35 animate-ping pointer-events-none" />
        )}

        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="h-4 w-4" />
            </motion.span>
          ) : (
            <motion.span
              key="spark"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>

        NotiBot

        {/* Green online dot */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#39FF14] border-2 border-[#0c1120]" />
        )}
      </motion.button>
    </div>
  )
}
