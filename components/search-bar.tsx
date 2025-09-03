"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Sparkles, X } from "lucide-react"

const suggestedSearches = [
  "Eleições 2024",
  "Champions League",
  "IA e Tecnologia",
  "Economia Portugal",
  "Cultura Lisboa",
]

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    // TODO: Implement search functionality
    console.log("Searching for:", searchQuery)
  }

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar notícias..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            className="pl-10 pr-4 w-64 lg:w-80"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Button onClick={() => handleSearch(query)} className="bg-primary hover:bg-primary/90">
          <Sparkles className="h-4 w-4 mr-2" />
          Buscar IA
        </Button>
      </div>

      {/* Search Suggestions */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="p-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Pesquisas Sugeridas</div>
            <div className="space-y-2">
              {suggestedSearches.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    handleSearch(suggestion)
                    setIsExpanded(false)
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isExpanded && <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />}
    </div>
  )
}
