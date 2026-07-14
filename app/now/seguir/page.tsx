import type { Metadata } from "next"
import { Users } from "lucide-react"

import { ComingSoon } from "@/components/immersive/coming-soon"

export const metadata: Metadata = {
  title: "Seguir — NotiLab",
  description: "Segue fontes e tópicos — em breve.",
}

export default function SeguirPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Seguir"
      description="Seguir fontes e tópicos precisa de contas de utilizador e de um sistema de subscrições que ainda não existe no produto. Esta secção liga-se assim que essa base estiver pronta."
    />
  )
}
