"use client"

import { Button } from "@/components/ui/button"
import { Sparkles, TrendingUp, Search, BookOpen } from "lucide-react"

interface ChatSuggestionsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
}

const suggestionIcons = [Sparkles, TrendingUp, Search, BookOpen]

export function ChatSuggestions({ suggestions, onSuggestionClick }: ChatSuggestionsProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground font-medium">Sugestões:</div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestionIcons[index % suggestionIcons.length]
          return (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(suggestion)}
              className="text-xs bg-background/50 hover:bg-accent/50 border-border/50"
            >
              <Icon className="h-3 w-3 mr-1" />
              {suggestion}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
