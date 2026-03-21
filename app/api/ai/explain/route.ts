import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { topic, complexity } = await request.json()

    if (!topic || !complexity) {
      return NextResponse.json({ error: "Missing topic or complexity" }, { status: 400 })
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const explanations: Record<string, Record<string, string>> = {
      simple: {
        default: `Here's a quick breakdown of "${topic}":\n\nThis is a significant development that impacts multiple sectors. The key takeaway is that regulatory frameworks are evolving to keep pace with technological innovation, with implications for businesses and consumers worldwide. Experts suggest this will lead to more transparency and accountability in the industry.`,
      },
      child: {
        default: `Let me explain "${topic}" in a super simple way! 🎯\n\nImagine the world is like a big playground. Sometimes new toys come along that are really powerful, and the grown-ups need to make rules so everyone plays fair and nobody gets hurt. That's basically what's happening here — the people in charge are making rules for a really cool but powerful new "toy" so it helps everyone! 🌟`,
      },
      expert: {
        default: `Technical analysis of "${topic}":\n\nFrom a macro perspective, this development signals a paradigm shift in regulatory approaches toward emerging technologies. The framework introduces a risk-based classification system, mandatory impact assessments, and compliance mechanisms with enforcement teeth. Cross-jurisdictional implications suggest a Brussels Effect scenario with global regulatory convergence likely within 24-36 months.`,
      },
    }

    const complexityLevel = explanations[complexity] ? complexity : "simple"
    const explanation = explanations[complexityLevel].default

    return NextResponse.json({
      explanation,
      readTime: complexity === "child" ? "30s" : complexity === "simple" ? "1 min" : "3 min",
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
