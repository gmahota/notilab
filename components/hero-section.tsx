"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Zap, TrendingUp } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          {/* Main Heading */}
          <div className="space-y-4">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <Sparkles className="h-4 w-4 mr-2" />
              Notícias Inteligentes com IA
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
                O Futuro das
              </span>
              <br />
              <span className="text-foreground">Notícias é Aqui</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Resumos inteligentes, tendências em tempo real e conteúdo personalizado. A IA que transforma como você
              consome informação.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-semibold card-hover"
            >
              <Zap className="h-5 w-5 mr-2" />
              Começar Agora
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="border-secondary text-secondary hover:bg-secondary/10 px-8 py-6 text-lg font-semibold bg-transparent"
            >
              <TrendingUp className="h-5 w-5 mr-2" />
              Ver Tendências
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 card-hover">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">1000+</div>
                <div className="text-muted-foreground">Notícias Resumidas</div>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 card-hover">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-secondary">24/7</div>
                <div className="text-muted-foreground">Monitorização IA</div>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 card-hover">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">5min</div>
                <div className="text-muted-foreground">Tempo de Leitura</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
