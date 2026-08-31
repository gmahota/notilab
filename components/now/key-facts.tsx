import type { StoryKeyFactView } from "@/lib/story-view"

/**
 * Spec § 11/§ 16 — facts short enough to read at a glance.
 *
 * The value carries the visual weight because that is what the eye lands on:
 * "58.5M" first, "acres" second, "potentially affected" third. Renders nothing
 * when there are no facts: an empty "Key facts" heading suggests we looked and
 * found none, when in truth nothing has extracted them yet.
 */
export function KeyFacts({ facts }: { facts: StoryKeyFactView[] }) {
  if (facts.length === 0) return null

  return (
    <section aria-labelledby="key-facts-heading">
      <h2
        id="key-facts-heading"
        className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
      >
        Key facts
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {facts.map((fact, i) => (
          <div
            key={`${fact.value}-${fact.label}-${i}`}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <dd className="text-2xl font-bold leading-none tracking-tight">{fact.value}</dd>
            <dt className="mt-1 text-sm font-medium">{fact.label}</dt>
            {fact.context && (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{fact.context}</p>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
