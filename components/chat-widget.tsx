"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MessageCircle, X, Minimize2, Maximize2 } from "lucide-react"
import { ChatInterface } from "./chat-interface"
import { motion, AnimatePresence } from "framer-motion"

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.div
            key="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg glow-blue relative"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping pointer-events-none" />
            {/* Notification Dot */}
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-secondary rounded-full animate-pulse" />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Card
              className={`bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl transition-all duration-300 ${
                isMinimized ? "w-80 h-16" : "w-96 h-[500px]"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <div className="absolute -top-1 -right-1 h-2 w-2 bg-secondary rounded-full" />
                  </div>
                  <span className="font-semibold">NotiBot</span>
                </div>

                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)} className="h-6 w-6 p-0">
                    {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-6 w-6 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Chat Content */}
              {!isMinimized && (
                <div className="h-[calc(100%-4rem)]">
                  <ChatInterface />
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
