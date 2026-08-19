"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Flame, Clock, Newspaper, Zap, ArrowRight } from "lucide-react"

import {
  fetchPublicStats,
  fetchTrendingTopics,
  formatCompactNumber,
  trendVolumeLabel,
  type PublicStats,
  type TrendMode,
  type TrendingTopic,
} from "@/lib/news-client"

/**
 * Feed sidebar — quick counts and what is actually trending.
 *
 * Everything here used to be a hardcoded array: "1,234" articles today, "45.6K"
 * active users, "2,890" AI summaries, and five invented topics led by "Eleições
 * 2024". None of it moved, and none of it was true. Both panels now read from
 * endpoints derived from our own articles, and each hides itself rather than
 * showing a placeholder when there is nothing real to show.
 *
 * "Utilizadores Ativos" is gone rather than reimplemented: we have no
 * active-user measurement worth publishing, and the honest replacement for an
 * invented number is no number. Distinct sources is measurable, so it took the
 * slot.
 */

const TOPIC_LIMIT = 5

const STAT_LABELS: Array<{ key: keyof PublicStats; label: string; icon: typeof Clock }> = [
  { key: "articlesToday", label: "Notícias Hoje", icon: Clock },
  { key: "aiSummaries", label: "Resumos IA", icon: Zap },
  { key: "sources", label: "Fontes", icon: Newspaper },
]

function StatRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="h-4 w-28 rounded bg-muted/20 animate-pulse" />
      <div className="h-4 w-10 rounded bg-muted/25 animate-pulse" />
    </div>
  )
}

function TopicRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-2">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-muted/20 animate-pulse" />
        <div className="h-4 w-16 rounded-md bg-muted/15 animate-pulse" />
      </div>
      <div className="h-3 w-12 rounded bg-muted/15 animate-pulse" />
    </div>
  )
}

export function TrendingSidebar() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsFailed, setStatsFailed] = useState(false)

  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [mode, setMode] = useState<TrendMode>("coverage")
  const [topicsLoading, setTopicsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetchPublicStats({ signal: controller.signal })
      .then(setStats)
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setStatsFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatsLoading(false)
      })

    fetchTrendingTopics({ limit: TOPIC_LIMIT, signal: controller.signal })
      .then((result) => {
        setMode(result.mode)
        setTopics(result.topics)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setTopics([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setTopicsLoading(false)
      })

    return () => controller.abort()
  }, [])

  return (
    <div className="space-y-6">
      {/* Quick Stats — hidden entirely if the counts can't be loaded, so the
          panel never shows a number we did not actually measure. */}
      {!statsFailed && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center">
            <Zap className="h-4 w-4 mr-2 text-primary" />
            Estatísticas Rápidas
          </h3>
          <div className="space-y-3">
            {statsLoading || !stats
              ? STAT_LABELS.map((s) => <StatRowSkeleton key={s.key} />)
              : STAT_LABELS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </div>
                    <span className="font-semibold text-primary">
                      {formatCompactNumber(stats[key])}
                    </span>
                  </div>
                ))}
          </div>
        </Card>
      )}

      {/* Trending Topics — derived from our own articles. Hidden when empty
          rather than filled with invented keywords. */}
      {(topicsLoading || topics.length > 0) && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-secondary" />
            Trending Agora
          </h3>
          <div className="space-y-3">
            {topicsLoading
              ? Array.from({ length: 3 }).map((_, i) => <TopicRowSkeleton key={i} />)
              : topics.map((trend, index) => (
                  <Link
                    key={trend.keyword}
                    href={`/feed?search=${encodeURIComponent(trend.keyword)}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <span className="font-medium text-sm">{trend.keyword}</span>
                        {index < 3 && <Flame className="h-3 w-3 text-secondary" />}
                      </div>
                      {trend.category && (
                        <Badge variant="outline" className="text-xs">
                          {trend.category}
                        </Badge>
                      )}
                    </div>
                    {/* The number is article or engagement count, never
                        "searches" — labelled so it can't be misread as a
                        percentage swing the way "+245%" was. */}
                    <div className="text-right text-xs text-muted-foreground">
                      {formatCompactNumber(trend.volume)}{" "}
                      {trendVolumeLabel(mode, trend.volume)}
                    </div>
                  </Link>
                ))}
          </div>

          {!topicsLoading && topics.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="w-full mt-4 text-primary">
              <Link href="/trending">
                Ver Todas as Tendências
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </Card>
      )}

      {/* AI Assistant Prompt */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold">NotiBot IA</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Pergunte-me qualquer coisa sobre as notícias ou peça resumos personalizados!
          </p>
          <Button asChild size="sm" className="w-full bg-primary hover:bg-primary/90">
            <Link href="/chat">Conversar com IA</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
