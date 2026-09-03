import { type NextRequest, NextResponse } from "next/server"

// Types for Reddit API response
interface RedditPost {
  data: {
    id: string
    title: string
    url: string
    permalink: string
    thumbnail: string
    preview?: {
      images: Array<{
        source: {
          url: string
          width: number
          height: number
        }
      }>
    }
    author: string
    created_utc: number
    score: number
    num_comments: number
    subreddit: string
  }
}

interface RedditResponse {
  data: {
    children: RedditPost[]
  }
}

interface TranslatedNews {
  id: string
  title: string
  originalTitle: string
  translatedTitle: string
  summary: string
  imageUrl: string
  sourceUrl: string
  redditUrl: string
  author: string
  publishedAt: Date
  score: number
  comments: number
  subreddit: string
}

// Reddit subreddit names are 3-21 characters of letters, digits and underscores.
// Validating against this pattern is what keeps attacker-controlled text out of
// the outbound URL: no path traversal, no query or fragment injection, no way to
// steer the request off www.reddit.com.
const SUBREDDIT_PATTERN = /^[A-Za-z0-9_]{3,21}$/
const DEFAULT_SUBREDDIT = "worldnews"
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 15

// Returns null for anything that isn't a plain positive integer, so a bad
// "limit" is rejected instead of reaching the URL as NaN. An absent or empty
// value falls back to the default, matching how an absent or empty "subreddit"
// does -- "?limit=" is a parameter the caller left blank, not a bad value.
function parseLimit(raw: string | null): number | null {
  if (raw === null || raw === "") return DEFAULT_LIMIT
  if (!/^\d{1,3}$/.test(raw)) return null
  const parsed = Number.parseInt(raw, 10)
  if (parsed < 1) return null
  return Math.min(parsed, MAX_LIMIT)
}

// Function to translate text using LibreTranslate
async function translateText(text: string, source = "en", target = "pt"): Promise<string> {
  try {
    const response = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text",
      }),
    })

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`)
    }

    const data = await response.json()
    return data.translatedText || text
  } catch (error) {
    console.error("Translation error:", error)
    // Return original text if translation fails
    return text
  }
}

// Function to generate summary from title (simple version)
function generateSummary(title: string): string {
  // For now, we'll use a simple approach
  // In the future, this could be enhanced with AI summarization
  return `${title.slice(0, 150)}${title.length > 150 ? "..." : ""}`
}

// Function to get image URL with fallback
function getImageUrl(post: RedditPost["data"]): string {
  // Try to get high-quality image from preview
  if (post.preview && post.preview.images && post.preview.images.length > 0) {
    const imageUrl = post.preview.images[0].source.url
    // Decode HTML entities in URL
    return imageUrl.replace(/&amp;/g, "&")
  }

  // Fallback to thumbnail if it's not a placeholder
  if (post.thumbnail && post.thumbnail !== "self" && post.thumbnail !== "default" && post.thumbnail.startsWith("http")) {
    return post.thumbnail
  }

  // Use a simple data URL fallback that works everywhere
  return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMWExYTFhIi8+CjxyZWN0IHg9IjM1MCIgeT0iMjUwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjNzEzZjEyIi8+CjxjaXJjbGUgY3g9IjM4MCIgY3k9IjI3MCIgcj0iOCIgZmlsbD0iI2ZmNjUwMCIvPgo8cGF0aCBkPSJNMzcwIDMwMGgyMHYxMGgtMjB6IiBmaWxsPSIjZmY2NTAwIi8+CjxwYXRoIGQ9Ik0zODAgMzIwaDIwdjEwaDIwdi0xMGgxMHYzMGgtNjB2LTMweiIgZmlsbD0iI2ZmNjUwMCIvPgo8cGF0aCBkPSJNMzUwIDM2MGgxMDB2MjBIMzUweiIgZmlsbD0iIzQ0NDA0NCIvPgo8dGV4dCB4PSI0MDAiIHk9IjQwMCIgZmlsbD0iIzg4ODg4OCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ob3TDrWNpYSBSZWRkaXQ8L3RleHQ+Cjwvc3ZnPgo="
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Validate before any outbound request. This runs outside the inner
    // try/catch on purpose: a rejected request must return 400, not fall
    // through to the demo fallback and report success.
    const subredditParam = searchParams.get("subreddit")
    const subreddit = subredditParam === null || subredditParam === "" ? DEFAULT_SUBREDDIT : subredditParam
    if (!SUBREDDIT_PATTERN.test(subreddit)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid subreddit",
          message: "subreddit must be 3-21 characters of letters, digits or underscores",
        },
        { status: 400 }
      )
    }

    const limit = parseLimit(searchParams.get("limit"))
    if (limit === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid limit",
          message: `limit must be an integer between 1 and ${MAX_LIMIT}`,
        },
        { status: 400 }
      )
    }

    try {
      // Fetch Reddit data
      const redditUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}.json?limit=${limit}`
      const redditResponse = await fetch(redditUrl, {
        headers: {
          "User-Agent": "NotiLab/1.0 (news aggregator)",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!redditResponse.ok) {
        throw new Error(`Reddit API error: ${redditResponse.status}`)
      }

      const redditData: RedditResponse = await redditResponse.json()
      const posts = redditData.data.children

      // Process posts in parallel
      const processedNews: TranslatedNews[] = await Promise.all(
        posts.map(async (post) => {
          const postData = post.data
          
          // Translate title to Portuguese
          const translatedTitle = await translateText(postData.title)
          
          // Generate summary (for now, just use translated title as base)
          const summary = generateSummary(translatedTitle)
          
          return {
            id: postData.id,
            title: translatedTitle,
            originalTitle: postData.title,
            translatedTitle,
            summary,
            imageUrl: getImageUrl(postData),
            sourceUrl: postData.url,
            redditUrl: `https://reddit.com${postData.permalink}`,
            author: postData.author,
            publishedAt: new Date(postData.created_utc * 1000),
            score: postData.score,
            comments: postData.num_comments,
            subreddit: postData.subreddit,
          }
        })
      )

      return NextResponse.json({
        success: true,
        data: processedNews,
        meta: {
          source: "reddit",
          subreddit,
          count: processedNews.length,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (networkError) {
      console.warn("Network error, using fallback data:", networkError)
      
      // Fallback data for testing/demo purposes
      const fallbackNews: TranslatedNews[] = [
        {
          id: "demo1",
          title: "Avanços em Energia Renovável Revolucionam Mercado Global",
          originalTitle: "Renewable Energy Breakthroughs Revolutionize Global Market",
          translatedTitle: "Avanços em Energia Renovável Revolucionam Mercado Global",
          summary: "Novas tecnologias em energia solar e eólica prometem reduzir custos e aumentar eficiência energética mundialmente.",
          imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMGY0YzMzIi8+CjxjaXJjbGUgY3g9IjQwMCIgY3k9IjIwMCIgcj0iNjAiIGZpbGw9IiNmZmQ3MDAiLz4KPHN0cm9rZSB4PSIzNDAiIHk9IjE0MCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIHN0cm9rZT0iI2ZmZDcwMCIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik0zNTAgNDAwaDEwMHY4MEgzNTB6IiBmaWxsPSIjMjI3N2ZmIi8+CjxwYXRoIGQ9Ik0zNjAgMzgwaDgwdjIwSDM2MHoiIGZpbGw9IiNlZWZmZmYiLz4KPHN2ZyB4PSIzODAiIHk9IjQyMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA1NWZmIj4KICA8cGF0aCBkPSJNMCA0MEw0MCAyMEw0MCA0MEgweiIvPgo8L3N2Zz4KPHN2ZyB4PSIzNzAiIHk9IjQ0MCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMDA4ODAwIj4KICA8cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iMjAiIHJ4PSIxMCIvPgo8L3N2Zz4KPHN2ZyB4PSIzOTAiIHk9IjQ4MCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA3N2ZmIj4KICA8cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iNDAiIHJ4PSI1Ii8+Cjwvc3ZnPgo8dGV4dCB4PSI0MDAiIHk9IjU1MCIgZmlsbD0iI2ZmZmZmZiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5FbmVyZ2lhIFJlbm92w6F2ZWw8L3RleHQ+Cjwvc3ZnPgo=",
          sourceUrl: "https://example.com/renewable-energy",
          redditUrl: "https://reddit.com/r/worldnews/demo1",
          author: "EnergyExpert",
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          score: 2456,
          comments: 342,
          subreddit: "worldnews",
        },
        {
          id: "demo2",
          title: "Descoberta Arqueológica Revela Civilização Antiga no Pacífico",
          originalTitle: "Archaeological Discovery Reveals Ancient Pacific Civilization",
          translatedTitle: "Descoberta Arqueológica Revela Civilização Antiga no Pacífico",
          summary: "Cientistas descobrem ruínas de uma civilização de 3000 anos nas ilhas remotas do Pacífico.",
          imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjNGM3NjY2Ii8+CjxyZWN0IHg9IjEwMCIgeT0iNDAwIiB3aWR0aD0iNjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzk0NjQzNiIvPgo8cmVjdCB4PSIyMDAiIHk9IjMwMCIgd2lkdGg9IjQwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiM3MDQ0MjIiLz4KPGNpcmNsZSBjeD0iNDAwIiBjeT0iMTgwIiByPSI4MCIgZmlsbD0iI2ZmZDcwMCIvPgo8cGF0aCBkPSJNMzAwIDI1MEw1MDAgMjUwTDQ1MCAyMDBMMzUwIDIwMFoiIGZpbGw9IiM4ODg4ODgiLz4KPHBhdGggZD0iTTM1MCA0NTBINDUwVjUwMEgzNTBaIiBmaWxsPSIjNjY2NjY2Ii8+CjxwYXRoIGQ9Ik0zMjAgMzUwaDU2djUwSDMyMHoiIGZpbGw9IiM1NTU1NTUiLz4KPHBhdGggZD0iTTQzMCAzNTBoNTZ2NTBINDMweiIgZmlsbD0iIzU1NTU1NSIvPgo8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNzAiIHI9IjEwIiBmaWxsPSIjZmZkNzAwIi8+CjxjaXJjbGUgY3g9IjQ2MCIgY3k9IjM3MCIgcj0iMTAiIGZpbGw9IiNmZmQ3MDAiLz4KPHN2ZyB4PSIzODAiIHk9IjMyMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjYWE4ODU1Ij4KICA8cGF0aCBkPSJNMjAgMEw0MCAyMEwyMCA0MEwwIDIwWiIvPgo8L3N2Zz4KPHN2ZyB4PSIyMDAiIHk9IjEwMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA3NzAwIj4KICA8cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHJ4PSIyMCIvPgo8L3N2Zz4KPHN2ZyB4PSI1NDAiIHk9IjEwMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA3NzAwIj4KICA8cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHJ4PSIyMCIvPgo8L3N2Zz4KPHN2ZyB4PSIzNzAiIHk9IjEwMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA3NzAwIj4KICA8cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHJ4PSIyMCIvPgo8L3N2Zz4KPHR4dCB4PSI0MDAiIHk9IjU1MCIgZmlsbD0iI2ZmZmZmZiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BcnF1ZW9sb2dpYTwvdGV4dD4KPC9zdmc+Cg==",
          sourceUrl: "https://example.com/pacific-discovery",
          redditUrl: "https://reddit.com/r/worldnews/demo2",
          author: "ArchaeologyNews",
          publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          score: 1834,
          comments: 278,
          subreddit: "worldnews",
        },
        {
          id: "demo3",
          title: "Nova Vacina Promete Combater Malária na África",
          originalTitle: "New Vaccine Shows Promise Against Malaria in Africa",
          translatedTitle: "Nova Vacina Promete Combater Malária na África",
          summary: "Ensaios clínicos mostram eficácia de 85% de nova vacina contra malária em populações africanas.",
          imageUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMjIzM2ZmIi8+CjxyZWN0IHg9IjMwMCIgeT0iMjAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgcng9IjIwIiBmaWxsPSIjZmZmZmZmIi8+CjxyZWN0IHg9IjM0MCIgeT0iMjQwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgcng9IjEwIiBmaWxsPSIjZTE0ZDJhIi8+CjxyZWN0IHg9IjM3MCIgeT0iMjcwIiB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHJ4PSI1IiBmaWxsPSIjZmZmZmZmIi8+CjxjaXJjbGUgY3g9IjQwMCIgY3k9IjMwMCIgcj0iMTIiIGZpbGw9IiNlMTRkMmEiLz4KPHBhdGggZD0iTTM5MCAyOTBMNDEwIDI5MEw0MTAgMzEwTDM5MCAzMTBaIiBmaWxsPSIjZmZmZmZmIi8+CjxwYXRoIGQ9Ik0zOTUgMjk1TDQwNSAyOTVMNDA1IDMwNUwzOTUgMzA1WiIgZmlsbD0iI2UxNGQyYSIvPgo8c3ZnIHg9IjMyMCIgeT0iMTUwIiB3aWR0aD0iMTYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDBjY2ZmIj4KICA8cGF0aCBkPSJNMCAyMEM4IDEyIDE2IDQgMzIgMEg5NkwxNjAgMTZMMTQ0IDMySDMyQzE2IDI4IDggMjQgMCAyMFoiLz4KPC9zdmc+CjxzdmcgeD0iMzIwIiB5PSI0NDgiIHdpZHRoPSIxNjAiIGhlaWdodD0iNDAiIGZpbGw9IiMwMGNjZmYiPgogIDxwYXRoIGQ9Ik0wIDIwQzggMTIgMTYgNCAzMiAwSDk2TDE2MCAxNkwxNDQgMzJIMzJDMTYgMjggOCAyNCAwIDIwWiIvPgo8L3N2Zz4KPHN2ZyB4PSIyMDAiIHk9IjI4MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDBjY2ZmIj4KICA8cGF0aCBkPSJNMCAyMEM2IDEyIDEyIDQgMjQgMEg1Nkw4MCA4TDcyIDE2TDggMzJIMEwyNFoiLz4KPC9zdmc+CjxzdmcgeD0iNTIwIiB5PSIyODAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzAwY2NmZiI+CiAgPHBhdGggZD0iTTAgMjBDNiAxMiAxMiA0IDI0IDBINTZMODAgOEw3MiAxNkw4IDMySDJMMjRaIi8+Cjwvc3ZnPgo8dGV4dCB4PSI0MDAiIHk9IjU1MCIgZmlsbD0iI2ZmZmZmZiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5WYWNpbmEgU2HDumRlPC90ZXh0Pgo8L3N2Zz4K",
          sourceUrl: "https://example.com/malaria-vaccine",
          redditUrl: "https://reddit.com/r/worldnews/demo3",
          author: "HealthReporter",
          publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          score: 3421,
          comments: 567,
          subreddit: "worldnews",
        },
      ].slice(0, limit)

      return NextResponse.json({
        success: true,
        data: fallbackNews,
        meta: {
          source: "reddit_fallback",
          subreddit,
          count: fallbackNews.length,
          timestamp: new Date().toISOString(),
          note: "Using fallback data due to network limitations",
        },
      })
    }
  } catch (error) {
    console.error("Reddit news API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Reddit news",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}