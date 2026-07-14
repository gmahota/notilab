import type { Metadata } from "next"
import { MapPin } from "lucide-react"

import { ComingSoon } from "@/components/immersive/coming-soon"

export const metadata: Metadata = {
  title: "Perto — NotiLab",
  description: "Notícias perto de ti — em breve.",
}

export default function PertoPage() {
  return (
    <ComingSoon
      icon={MapPin}
      title="Perto"
      description="Ainda não temos localização associada às notícias, por isso não há nada honesto para mostrar aqui. Esta secção liga-se assim que tivermos geolocalização de artigos."
    />
  )
}
