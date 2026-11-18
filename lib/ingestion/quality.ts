/**
 * quality.ts — Rejects fetched articles that should never reach the feed.
 *
 * Why this exists: the providers do full-text OR matching, and nothing checked
 * what came back. A run produced an NFL blog's link roundup, an MLB draft item,
 * a piracy release listing from rlsbb.cc, a phone-charging tutorial from CNET
 * and a climate-denial blog post — all because those pages happened to contain
 * a query term somewhere in the body. Three gates, cheapest first:
 *
 *   1. Source     — is the outlet a news publisher we accept?
 *   2. Shape      — is this a news article at all, or a release dump / index?
 *   3. Relevance  — is the article *about* the topic, or does it merely mention it?
 *
 * Every rejection is counted and reported so a gate that is too tight shows up
 * as a number rather than as a silently empty feed.
 */

import { hostOf, matchesDomain } from "./url-host"
import type { RawArticle } from "./types"

/**
 * Domains we accept. Matched against the article URL's hostname, not the
 * provider's display name.
 *
 * Display-name matching was tried first and was not safe: substring checks on
 * short words let "GIVEMESPORT" through on "sport" and "The Times of India"
 * through on "the times". A hostname is unambiguous and auditable.
 *
 * Deliberately an allowlist rather than a blocklist of bad domains: a blocklist
 * is endless whack-a-mole, and this editorial scope is narrow enough that naming
 * the wanted outlets is tractable. Grow it when a legitimate outlet is rejected
 * — the pipeline logs every rejected domain for exactly that purpose.
 */
const ALLOWED_DOMAINS = [
  // Wires and international
  "reuters.com", "apnews.com", "afp.com", "bbc.com", "bbc.co.uk",
  "theguardian.com", "aljazeera.com", "ft.com", "economist.com",
  "bloomberg.com", "cnn.com", "nytimes.com", "washingtonpost.com",
  "thetimes.co.uk", "news.sky.com", "sky.com", "npr.org", "dw.com",
  "france24.com", "lemonde.fr", "elpais.com", "politico.com", "politico.eu",
  "axios.com", "independent.co.uk", "euronews.com", "abcnews.go.com",
  "cbsnews.com", "nbcnews.com", "time.com", "newsweek.com", "theatlantic.com",
  "foreignpolicy.com", "cbc.ca", "irishtimes.com", "bangkokpost.com",
  "thehindu.com", "hindustantimes.com", "timesofindia.indiatimes.com",
  // Portugal / Brazil / Mozambique
  "lusa.pt", "publico.pt", "expresso.pt", "observador.pt", "jn.pt", "dn.pt",
  "sicnoticias.pt", "rtp.pt", "tsf.pt", "sapo.pt", "folha.uol.com.br",
  "oglobo.globo.com", "g1.globo.com", "estadao.com.br",
  "cartamz.com", "savana.co.mz", "opais.co.mz", "verdade.co.mz",
  "clubofmozambique.com", "zitamar.com", "jornalnoticias.co.mz",
  // Spain / football
  "marca.com", "as.com", "mundodeportivo.com", "sport.es", "elmundo.es",
  "abola.pt", "record.pt", "ojogo.pt", "espn.com", "espn.com.br",
  "theathletic.com", "skysports.com", "goal.com", "uefa.com", "fifa.com",
  "footballitalia.net", "fourfourtwo.com", "cadenaser.com",
  // Italy / France football
  "gazzetta.it", "corrieredellosport.it", "tuttosport.com", "ansa.it",
  "lequipe.fr", "rmcsport.bfmtv.com", "lefigaro.fr",
  // US celebrity and entertainment desks
  "variety.com", "hollywoodreporter.com", "deadline.com", "people.com",
  "ew.com", "billboard.com", "rollingstone.com", "vanityfair.com",
  "usatoday.com",
  // Financial markets
  "cnbc.com", "wsj.com", "marketwatch.com", "barrons.com", "fortune.com",
  "jornaldenegocios.pt", "dinheirovivo.pt", "expansion.com",
  // Added 2026-11-13 to un-dark two verticals: the Premier League and US-markets
  // queries each fetched 10 articles per run and kept ZERO, because the allowlist
  // removed their whole yield (roadmap #84,
  // docs/manager/strategy/scope-v2-intake-measurement.md). Each line below says
  // what the outlet is, because "grow it when a legitimate outlet is rejected"
  // only works if the reason is auditable later.
  //
  // English club football — the two Reach plc regionals ARE what the query
  // returns, and they run bylined, dedicated club desks. They are also the
  // rumour-heaviest outlets here: transfer speculation is their staple. Admitted
  // on the understanding that § H-style attribution rules and the review gate
  // bind the content — not because the outlet is above suspicion.
  "liverpoolecho.co.uk",          // Reach plc, Liverpool FC desk
  "manchestereveningnews.co.uk",  // Reach plc, Man City / Man Utd desks
  // Tier-1 English football desks absent from this list by oversight. Neither
  // appeared in the 2026-11-13 yield, so neither fixes the dark vertical today;
  // added because their rejection would be wrong whenever they do appear.
  "telegraph.co.uk",
  "standard.co.uk",               // Evening Standard, London football
  // Markets. NOTE what this does and does not fix: the US-markets query's actual
  // yield is Indian and Brazilian business press covering Wall Street, not US
  // tier-1 press — cnbc/wsj/marketwatch/bloomberg/ft are already allowlisted and
  // the provider is not returning them on the free tier. These two are genuine
  // business dailies and § H.2 binds the content whatever the outlet's
  // nationality, but this is SECOND-HAND coverage of US markets. If that is not
  // wanted, the fix is the query, not the allowlist.
  "economictimes.indiatimes.com", // The Economic Times, Indian business daily
  "financialexpress.com",         // The Financial Express, Indian business daily
]

/**
 * Hostnames never accepted even if a suffix rule would allow them. Aggregators
 * that republish other outlets' text, and non-news sites.
 */
const BLOCKED_DOMAINS = [
  "biztoc.com", "rlsbb.cc", "wattsupwiththat.com", "wnd.com",
  "wealthofgeeks.com", "newsonjapan.com", "msn.com", "freerepublic.com",
  "zerohedge.com", "beforeitsnews.com", "breitbart.com", "dailymail.co.uk",
  "dailymail.com", "afterdawn.com", "devdiscourse.com", "givemesport.com",
]

/**
 * Titles matching these never describe reporting: scene-release dumps, live
 * index pages that change under the URL, and link roundups.
 */
const REJECTED_TITLE_PATTERNS = [
  /\b\d{3,4}p\b.*\b(web|bluray|hdtv|webrip|x264|h264|dvdrip)\b/i,
  /\b(1080p|720p|2160p)\b/i,
  /news and links\b/i,
  /\blive updates?\b.*\bon\b.*\d{4}/i,
  /^\s*(live|liveblog)[:\s]/i,
  /\bopen thread\b/i,
]

/** Below this, there is no article to summarise or explain. */
const MIN_CONTENT_CHARS = 200

/**
 * How far into the text a query term still counts as "the article is about it".
 * A term first appearing beyond this is a passing mention.
 */
const LEAD_CHARS = 400

export interface QualityReport {
  kept: RawArticle[]
  rejected: {
    source: number
    shape: number
    relevance: number
  }
  /** Distinct hostnames dropped by the allowlist, for tuning it. */
  rejectedSources: string[]
}

/** Lowercase and strip accents, so "Moçambique" matches "mocambique". */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function isAllowedSource(article: RawArticle): boolean {
  const host = hostOf(article.sourceUrl)
  if (!host) return false
  if (BLOCKED_DOMAINS.some((d) => matchesDomain(host, d))) return false
  return ALLOWED_DOMAINS.some((d) => matchesDomain(host, d))
}

function hasArticleShape(article: RawArticle): boolean {
  if (REJECTED_TITLE_PATTERNS.some((re) => re.test(article.title))) return false
  const body = article.content || article.description || ""
  return body.trim().length >= MIN_CONTENT_CHARS
}

/**
 * True when one of the query's terms appears in the title or the lead.
 *
 * Multi-word terms must match as a phrase — "real madrid" must not be satisfied
 * by an article containing "real" and "madrid" in unrelated sentences.
 */
export function isRelevant(article: RawArticle): boolean {
  if (article.mustMatch.length === 0) return true

  const haystack = normalise(
    `${article.title}\n${(article.description || article.content || "").slice(0, LEAD_CHARS)}`,
  )

  return article.mustMatch.some((term) => haystack.includes(normalise(term)))
}

/**
 * Applies all three gates. Returns what survived plus per-gate counts, so the
 * caller can log how much was dropped and why.
 */
export function applyQualityGate(articles: RawArticle[]): QualityReport {
  const report: QualityReport = {
    kept: [],
    rejected: { source: 0, shape: 0, relevance: 0 },
    rejectedSources: [],
  }
  const droppedSources = new Set<string>()

  for (const article of articles) {
    if (!isAllowedSource(article)) {
      report.rejected.source++
      droppedSources.add(hostOf(article.sourceUrl) ?? article.sourceName)
      continue
    }
    if (!hasArticleShape(article)) {
      report.rejected.shape++
      continue
    }
    if (!isRelevant(article)) {
      report.rejected.relevance++
      continue
    }
    report.kept.push(article)
  }

  report.rejectedSources = [...droppedSources].sort()
  return report
}
