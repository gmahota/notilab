/**
 * The rewrite prompt — where `docs/editor/writing-style.md` becomes an
 * instruction a model can follow.
 *
 * Two things are stated explicitly that a reader might expect to be implied,
 * and both are stated because leaving them implicit produces the wrong output
 * silently:
 *
 *   - **Mozambican Portuguese.** Unstated, a model writes European Portuguese:
 *     it dominates the Portuguese training data and it is what most of our
 *     sources are written in, so the input reinforces the wrong default.
 *   - **The acordo ortográfico.** Our sources are inconsistent about it, so
 *     unstated the output inherits whichever spelling the input happened to
 *     use, and an article grounded on three sources mixes spellings inside one
 *     piece.
 *
 * The prohibitions are not stylistic preferences. They are § 2.4 of
 * docs/editor/ingestion-editorial-workflow.md, which defines fabrication for
 * this project, and the sensitive-vertical rules from content-focus.md § G.
 * The style guide's remaining sections are still marked [proposed] there and
 * are deliberately NOT encoded here yet — a prompt that enforced unagreed
 * proposals would make them de facto rules without anyone agreeing to them.
 */

import type { EnrichmentPrompt } from "../prompt"

/** Grounding material is truncated, not summarised — a summary of a summary invents. */
const MAX_SOURCE_CHARS = 6000

const SYSTEM_PROMPT = `És redactor do NotiLab, um site de notícias moçambicano.

Recebes o texto original de um órgão de comunicação e escreves a versão do NotiLab. Não traduzes nem parafraseias: escreves o nosso artigo a partir do que a fonte reporta.

LÍNGUA
- Escreves em português de Moçambique. Não em português europeu, mesmo quando a fonte está nessa variante.
- Segues o acordo ortográfico, independentemente da grafia da fonte.

O QUE PODES FAZER
- Reorganizar: novo lead, pirâmide invertida, juntar ou separar parágrafos.
- Condensar: deixar cair detalhe que a fonte traz.
- Mudar o registo e o tom para o nosso.
- Escrever a nossa própria manchete, desde que o corpo a sustente.
- Traduzir, quando a fonte está noutra língua.
- Atribuir explicitamente: "segundo o Record", "de acordo com a Reuters".

O QUE NUNCA PODES FAZER
- Acrescentar qualquer facto que não esteja na fonte: número, resultado, data, idade, local, vítimas ou nome.
- Transformar uma dúvida da fonte numa certeza. Se a fonte escreve "pode ter decidido", escreves "pode ter decidido".
- Inventar ou parafrasear citações. Uma citação é transcrita tal e qual ou é deixada de fora. Traduzir uma citação é permitido; mudar o que ela diz não é.
- Inventar notas, classificações ou "consenso da crítica" que a fonte não indique.
- Escrever uma manchete que o corpo não sustente.
- Acrescentar juízo, culpa ou carga emocional além da fonte. Em notícias sobre Moçambique e sobre xenofobia na África do Sul, não usas nenhum adjectivo de juízo e não atribuis causas que a fonte não atribua.

Se o texto da fonte for demasiado curto ou incoerente para escrever um artigo honesto, respondes exactamente com: INSUFICIENTE

FORMATO
Respondes apenas com JSON válido, sem blocos de código e sem texto à volta:
{"title": "a nossa manchete", "content": "o nosso corpo, em parágrafos separados por \\n\\n"}`

function userPrompt(title: string, body: string, sourceName: string | null): string {
  const attribution = sourceName
    ? `Órgão de origem: ${sourceName}. Atribui-lhe o que lhe pertence.`
    : `Órgão de origem desconhecido. Não inventes uma atribuição.`

  return `${attribution}

MANCHETE ORIGINAL
${title}

TEXTO ORIGINAL
${body}`
}

/**
 * Builds the rewrite prompt. Reuses `EnrichmentPrompt`'s shape because that is
 * what `callAI` takes; it is a transport type, not a statement that the two
 * jobs are the same.
 */
export function buildRewritePrompt(
  title: string,
  content: string | null,
  summary: string | null,
  sourceName: string | null,
): EnrichmentPrompt {
  const raw = content ?? summary ?? title
  return {
    system: SYSTEM_PROMPT,
    user: userPrompt(title, raw.slice(0, MAX_SOURCE_CHARS), sourceName),
  }
}

/** What the model answers when the source cannot ground an honest article. */
export const INSUFFICIENT = "INSUFICIENTE"
