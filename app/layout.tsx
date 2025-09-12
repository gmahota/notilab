import type React from "react"
import type { Metadata } from "next"
// Temporarily commenting out Google Fonts due to network restrictions
// import { Inter, Poppins } from "next/font/google"
// import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

// Temporarily commenting out font configurations due to network restrictions
// const inter = Inter({
//   subsets: ["latin"],
//   display: "swap",
//   variable: "--font-inter",
// })

// const poppins = Poppins({
//   subsets: ["latin"],
//   weight: ["400", "500", "600", "700", "800"],
//   display: "swap",
//   variable: "--font-poppins",
// })

export const metadata: Metadata = {
  title: "NotiLab - Notícias Inteligentes com IA",
  description:
    "Plataforma moderna de notícias com IA personalizada. Resumos inteligentes, tendências e conteúdo adaptado ao seu perfil.",
  generator: "NotiLab",
  keywords: ["notícias", "IA", "inteligência artificial", "resumos", "tendências", "personalização"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt" className="dark">
      <body className="font-sans antialiased">
        <Suspense fallback={null}>{children}</Suspense>
        {/* <Analytics /> */}
      </body>
    </html>
  )
}
