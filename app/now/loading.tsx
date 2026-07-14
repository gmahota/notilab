export default function NowLoading() {
  return (
    <div className="fixed inset-0 flex h-dvh w-screen flex-col justify-end gap-4 bg-black p-6 pb-28 md:pl-24 md:pr-28">
      <div className="shimmer h-4 w-32 rounded-full bg-white/10" />
      <div className="shimmer h-8 w-3/4 rounded-lg bg-white/10" />
      <div className="shimmer h-8 w-1/2 rounded-lg bg-white/10" />
      <div className="shimmer h-4 w-full max-w-md rounded bg-white/8" />
      <div className="shimmer h-9 w-36 rounded-md bg-white/10" />
    </div>
  )
}
