import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock AI analysis of the pasted link
    const domain = parsedUrl.hostname.replace("www.", "")

    return NextResponse.json({
      title: `Analysis of article from ${domain}`,
      source: domain,
      summary: `This article discusses a significant development that has implications for multiple sectors. The key points are: (1) A major policy or technological shift is underway, (2) Multiple stakeholders are affected, and (3) The long-term impact could reshape the industry.`,
      explanation: `Here's what you need to know in plain English: this story represents a turning point. The main takeaway is that change is arriving faster than expected — and both businesses and individuals should prepare for the new landscape that follows.`,
      whyItMatters: `This development is part of a broader trend underway since 2024. Similar initiatives have been attempted before, but this time the conditions are different — stronger political will, better technology, and wider public support. Experts predict this will become the standard within 2–3 years, affecting how millions of people live and work.`,
      shareText: `📰 Just read about the latest from ${domain} — Here's the AI breakdown:\n\n🔑 Key insight: Major shifts are underway that will impact everyone.\n\n🤖 Analyzed by NotiLab AI`,
      tags: ["analysis", "trending", domain],
      readTime: "2 min",
      sentiment: "neutral",
    })
  } catch {
    return NextResponse.json({ error: "Failed to analyze link" }, { status: 500 })
  }
}
