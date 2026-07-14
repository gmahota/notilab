import type { Metadata } from "next"
import { Compass } from "lucide-react"

import { ComingSoon } from "@/components/immersive/coming-soon"

export const metadata: Metadata = {
  title: "Explorar — NotiLab",
  description: "Mapa interativo de notícias — em breve.",
}

export default function ExplorarPage() {
  return (
    <ComingSoon
      icon={Compass}
      title="Explorar"
      description="O mapa interativo chega quando tivermos localização geográfica associada às notícias. Por agora não existe esse dado, por isso preferimos não mostrar um mapa a fingir."
    />
  )
}
