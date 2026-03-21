/**
 * NotiLab Digest Service
 * 
 * Generates AI-powered daily/weekly email digests.
 */

export interface DigestArticle {
  title: string
  summary: string
  category: string
  url: string
  importanceScore: number
}

export interface DigestContent {
  subject: string
  greeting: string
  sections: DigestSection[]
  footer: string
  generatedAt: Date
}

interface DigestSection {
  title: string
  articles: DigestArticle[]
}

/**
 * Generate digest content from top articles.
 */
export function generateDigestContent(
  articles: DigestArticle[],
  frequency: "daily" | "weekly",
  categories: string[] = []
): DigestContent {
  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-PT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Group articles by category
  const grouped: Record<string, DigestArticle[]> = {}
  for (const article of articles) {
    const cat = article.category || "Geral"
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(article)
  }

  // Filter by user-preferred categories if specified
  const filteredCategories = categories.length > 0
    ? Object.entries(grouped).filter(([cat]) => categories.includes(cat.toLowerCase()))
    : Object.entries(grouped)

  const sections: DigestSection[] = filteredCategories.map(([title, arts]) => ({
    title,
    articles: arts
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, 5), // top 5 per category
  }))

  return {
    subject: frequency === "daily"
      ? `NotiLab Daily — ${dateStr}`
      : `NotiLab Weekly Digest — Semana de ${dateStr}`,
    greeting: frequency === "daily"
      ? `Bom dia! Aqui está o seu resumo de hoje, ${dateStr}.`
      : `Aqui está o resumo da semana que terminou em ${dateStr}.`,
    sections,
    footer: "Gerado com IA pelo NotiLab. Pode ajustar as suas preferências em notilab.com/profile",
    generatedAt: now,
  }
}

/**
 * Build HTML email from digest content.
 */
export function buildDigestHTML(digest: DigestContent): string {
  const articlesHTML = digest.sections
    .map(
      (section) => `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #007BFF; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #007BFF; padding-bottom: 4px;">${section.title}</h2>
        ${section.articles
          .map(
            (a) => `
          <div style="margin-bottom: 16px; padding: 12px; background: #1a1a1a; border-radius: 8px; border-left: 3px solid #39FF14;">
            <a href="${a.url}" style="color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none;">${a.title}</a>
            <p style="color: #999; font-size: 14px; margin-top: 4px;">${a.summary}</p>
          </div>`
          )
          .join("")}
      </div>`
    )
    .join("")

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #ffffff; padding: 20px; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="background: linear-gradient(135deg, #007BFF, #39FF14); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 28px;">⚡ NotiLab</h1>
  </div>
  <p style="color: #ccc; font-size: 15px; margin-bottom: 24px;">${digest.greeting}</p>
  ${articlesHTML}
  <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
  <p style="color: #666; font-size: 12px; text-align: center;">${digest.footer}</p>
</body>
</html>`
}
