/**
 * category-catalog.ts — The `Category` row every slug the categoriser can emit
 * needs in the database.
 *
 * It lives beside the categoriser rather than under `prisma/` because the thing
 * that must stay true is a property of ingestion: `CATEGORY_RULES` in
 * `normalize.ts` emits a slug, and a row must exist for it or the article is
 * silently demoted to the fallback. Keeping the two files adjacent makes the
 * pairing visible when either one is edited.
 *
 * This is presentation metadata only — name, description, colour, icon. It is
 * consumed by `scripts/db/ensure-categories.ts`, which inserts a missing row and
 * never touches an existing one, so editing a description here does NOT rename
 * anything already in the database. Changing a live row is a deliberate
 * migration, not a side effect of this file.
 *
 * Slug values are persisted Portuguese data, not identifiers — see `AGENTS.md`
 * § Language Rules. Renaming one is a migration plus an editorial decision.
 */

export interface CategoryPresentation {
  name: string
  description: string
  color: string
  icon: string
}

/**
 * Keyed by slug. Must cover `CATEGORY_SLUGS` from `normalize.ts` — the script
 * asserts it and refuses to write a partial taxonomy.
 *
 * `mocambique`, `africa-do-sul` and `filmes` are listed although no sync query
 * feeds them under the 2026-11-12 scope: their `CATEGORY_RULES` blocks remain,
 * so a stray on-topic article can still route there and still needs somewhere
 * truthful to land. See `docs/editor/content-focus.md`.
 */
export const CATEGORY_CATALOG: Readonly<Record<string, CategoryPresentation>> = {
  desporto: {
    name: "Desporto",
    description:
      "Futebol de clubes — Premier League, Liga Portugal, LaLiga, Serie A, PSG e provas da UEFA",
    color: "#39FF14",
    icon: "trophy",
  },
  celebridades: {
    name: "Celebridades",
    description: "Celebridades norte-americanas — música, cinema e cultura pop",
    color: "#FF2E88",
    icon: "star",
  },
  economia: {
    name: "Economia",
    description: "Mercados financeiros e economia",
    color: "#FFD23F",
    icon: "trending-up",
  },
  mocambique: {
    name: "Moçambique",
    description: "Política de Moçambique",
    color: "#E60000",
    icon: "landmark",
  },
  "africa-do-sul": {
    name: "África do Sul",
    description: "Xenofobia e questões sociais na África do Sul",
    color: "#FFB612",
    icon: "alert-triangle",
  },
  filmes: {
    name: "Cinema & Séries",
    description:
      "Crítica e notícias de cinema e séries — Netflix, Prime Video, Marvel; ação, comédia e doramas",
    color: "#7c3aed",
    icon: "clapperboard",
  },
  general: {
    name: "Geral",
    description: "Notícias sem categoria específica identificada",
    color: "#8899A6",
    icon: "newspaper",
  },
}

/**
 * Slugs the categoriser can emit that this catalog has no row for. Empty is the
 * only acceptable state; anything else means a taxonomy edit landed in one file
 * and not the other.
 */
export function slugsMissingFromCatalog(slugs: readonly string[]): string[] {
  return slugs.filter((slug) => !(slug in CATEGORY_CATALOG))
}

/**
 * Catalog entries no rule can reach. Not an error — a retired category keeps its
 * row for referential integrity — but worth printing, so a slug that is dead by
 * accident rather than by decision is visible.
 */
export function catalogEntriesWithNoRule(slugs: readonly string[]): string[] {
  return Object.keys(CATEGORY_CATALOG).filter((slug) => !slugs.includes(slug))
}
