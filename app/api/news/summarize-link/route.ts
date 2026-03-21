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
      explanation: `Here's what you need to know: This story matters because it represents a turning point in how we approach this topic. The main takeaway is that change is coming faster than expected, and both businesses and consumers should prepare for the new landscape.`,
      context: `This development is part of a broader trend that started in 2024. Similar initiatives have been attempted before, but this time the conditions are different — stronger political will, better technology, and more public support. Experts predict this will become the standard within 2-3 years.`,
      shareText: `📰 Just read about the latest from ${domain} — Here's the AI breakdown:\n\n🔑 Key insight: Major shifts are underway that will impact everyone.\n\n🤖 Analyzed by NotiLab AI`,
      tags: ["analysis", "trending", domain],
      readTime: "2 min",
      sentiment: "neutral",
    })
  } catch {
    return NextResponse.json({ error: "Failed to analyze link" }, { status: 500 })
  }
}
