/**
 * Route-level fallback for `/now`. Mirrors the story layout — media block, then
 * text — so the first paint is already the right shape (spec § 30: never a
 * full-screen spinner).
 */
export default function NowLoading() {
  return (
    <div className="fixed inset-0 flex h-dvh w-screen flex-col overflow-hidden bg-black md:pl-20">
      <div className="shimmer h-[38svh] w-full shrink-0 bg-white/[0.06] md:h-[42svh]" />
      <div className="flex flex-1 flex-col gap-3 px-5 pt-5 md:mx-auto md:w-full md:max-w-[820px] md:px-8">
        <div className="shimmer h-3 w-40 rounded-full bg-white/10" />
        <div className="shimmer h-7 w-11/12 rounded-lg bg-white/10" />
        <div className="shimmer h-7 w-2/3 rounded-lg bg-white/10" />
        <div className="shimmer h-4 w-full rounded bg-white/[0.07]" />
        <div className="shimmer h-4 w-4/5 rounded bg-white/[0.07]" />
        <div className="shimmer mt-3 h-16 w-full rounded-xl bg-white/[0.05]" />
        <div className="shimmer mb-24 mt-auto h-11 w-48 rounded-md bg-white/10" />
      </div>
    </div>
  )
}
