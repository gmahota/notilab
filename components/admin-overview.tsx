"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Brain,
  TrendingUp,
  Radio,
  Mail,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Newspaper,
} from "lucide-react"
import type { OverviewStats } from "@/lib/admin/overview"

interface AdminOverviewProps {
  stats: OverviewStats
  userName: string
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string
  value: number | string
  sub?: string
  icon: React.ElementType
  iconColor: string
  href?: string
  alert?: boolean
}

function StatCard({ title, value, sub, icon: Icon, iconColor, href, alert }: StatCardProps) {
  const inner = (
    <Card className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors ${alert ? "border-red-800 hover:border-red-700" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${alert ? "text-red-400" : "text-white"}`}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-gray-800`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}

// ---------------------------------------------------------------------------
// Recent news row
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    PUBLISHED: { label: "Published", color: "text-green-400 border-green-800 bg-green-900/20" },
    DRAFT: { label: "Draft", color: "text-gray-400 border-gray-700 bg-gray-800/40" },
    PENDING_REVIEW: { label: "Pending", color: "text-yellow-400 border-yellow-800 bg-yellow-900/20" },
    APPROVED: { label: "Approved", color: "text-blue-400 border-blue-800 bg-blue-900/20" },
    REJECTED: { label: "Rejected", color: "text-red-400 border-red-800 bg-red-900/20" },
  }
  const { label, color } = map[status] ?? { label: status, color: "text-gray-400 border-gray-700" }
  return (
    <Badge variant="outline" className={`text-xs ${color}`}>
      {label}
    </Badge>
  )
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminOverview({ stats, userName }: AdminOverviewProps) {
  const aiHealthy = stats.ai.failed === 0
  const aiWarning = stats.ai.failed > 0 && stats.ai.failed < 10
  const aiCritical = stats.ai.failed >= 10

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Welcome back, {userName}</p>
        </div>
        <div className="flex items-center gap-2">
          {aiCritical ? (
            <Badge variant="outline" className="text-red-400 border-red-700 bg-red-900/20">
              <AlertTriangle className="w-3 h-3 mr-1.5" />
              AI Errors
            </Badge>
          ) : aiWarning ? (
            <Badge variant="outline" className="text-yellow-400 border-yellow-700 bg-yellow-900/20">
              <AlertTriangle className="w-3 h-3 mr-1.5" />
              AI Warnings
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-400 border-green-700 bg-green-900/20">
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              All Systems OK
            </Badge>
          )}
        </div>
      </div>

      {/* --- Row 1: News stats --- */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">News</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Articles"
            value={stats.news.total}
            sub={`${stats.news.today} today · ${stats.news.thisWeek} this week`}
            icon={Newspaper}
            iconColor="text-blue-400"
            href="/admin/news"
          />
          <StatCard
            title="Published"
            value={stats.news.published}
            icon={CheckCircle2}
            iconColor="text-green-400"
            href="/admin/news"
          />
          <StatCard
            title="Pending Review"
            value={stats.news.pendingReview}
            icon={Clock}
            iconColor="text-yellow-400"
            alert={stats.news.pendingReview > 20}
            href="/admin/news"
          />
          <StatCard
            title="Drafts"
            value={stats.news.draft}
            icon={FileText}
            iconColor="text-gray-400"
            href="/admin/news"
          />
        </div>
      </section>

      {/* --- Row 2: AI + Trending + Sources --- */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            title="AI Processed"
            value={stats.ai.processed}
            icon={Brain}
            iconColor="text-purple-400"
            href="/admin/ai-monitor"
          />
          <StatCard
            title="AI Pending"
            value={stats.ai.pending}
            icon={Clock}
            iconColor="text-yellow-400"
            href="/admin/ai-monitor"
          />
          <StatCard
            title="AI Failed"
            value={stats.ai.failed}
            icon={AlertTriangle}
            iconColor="text-red-400"
            alert={stats.ai.failed > 0}
            href="/admin/ai-monitor"
          />
          <StatCard
            title="Trending Topics"
            value={stats.trending.count}
            icon={TrendingUp}
            iconColor="text-orange-400"
            href="/admin/trending"
          />
        </div>
      </section>

      {/* --- Row 3: Sources + Distribution --- */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Sources & Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Sources"
            value={stats.sources.active}
            sub={`${stats.sources.total} total`}
            icon={Radio}
            iconColor="text-cyan-400"
            href="/admin/sources"
          />
          <StatCard
            title="Email Subscribers"
            value={stats.subscriptions.email}
            icon={Mail}
            iconColor="text-indigo-400"
          />
          <StatCard
            title="Messaging Subs"
            value={stats.subscriptions.messaging}
            sub="Telegram + WhatsApp"
            icon={MessageSquare}
            iconColor="text-teal-400"
          />
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm font-medium">Last Digest</p>
              {stats.lastDigest.generatedAt ? (
                <>
                  <p className="text-white text-lg font-bold mt-1">
                    {formatRelativeTime(stats.lastDigest.generatedAt)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {stats.lastDigest.frequency} · {stats.lastDigest.articleCount} articles
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-sm mt-1">Never generated</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* --- Recent articles table --- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recent Articles</h2>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" asChild>
            <Link href="/admin/news">View all →</Link>
          </Button>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Title</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3 hidden md:table-cell">Source</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3 hidden lg:table-cell">Score</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3 hidden md:table-cell">Published</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentNews.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      No articles yet
                    </td>
                  </tr>
                ) : (
                  stats.recentNews.map((article) => (
                    <tr key={article.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium line-clamp-1 max-w-xs">{article.title}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-gray-400">{article.sourceName}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-gray-400 tabular-nums">
                          {article.rankingScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(article.status)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-gray-500 text-xs">
                          {formatRelativeTime(article.publishedAt)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  )
}
