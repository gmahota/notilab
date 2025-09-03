import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();

  // Mock data for individual news article
  const mockNews = {
    id,
    title: "Nova Lei de IA da União Europeia Entra em Vigor: O Que Muda para Portugal?",
    content: `
      <p>A União Europeia deu um passo histórico na regulamentação da inteligência artificial com a entrada em vigor da nova Lei de IA, que promete transformar o panorama tecnológico em Portugal e em toda a Europa.</p>
      
      <h2>Principais Mudanças</h2>
      <p>A legislação estabelece regras claras para o desenvolvimento e uso de sistemas de IA, categorizando-os por níveis de risco. Sistemas de alto risco, como os utilizados em saúde, educação e segurança pública, terão requisitos mais rigorosos.</p>
      
      <h2>Impacto em Portugal</h2>
      <p>Para as empresas portuguesas, especialmente startups de tecnologia no Porto e Lisboa, a nova lei representa tanto desafios quanto oportunidades. Será necessário adaptar produtos e serviços às novas exigências, mas também se abre um mercado mais confiável para consumidores.</p>
      
      <h2>Cronograma de Implementação</h2>
      <p>A implementação será gradual, com diferentes prazos para diferentes tipos de sistemas. Empresas têm até 2026 para se adequar completamente às novas regras.</p>
      
      <p>Esta mudança coloca a Europa na vanguarda da regulamentação de IA mundial, estabelecendo um precedente que outros países provavelmente seguirão.</p>
    `,
    summary:
      "A nova Lei de IA da UE estabelece regras rigorosas para sistemas de inteligência artificial, impactando empresas portuguesas e criando um marco regulatório mundial.",
    imageUrl: "/european-parliament-ai-law.png",
    sourceName: "TechNews Portugal",
    publishedAt: new Date("2024-01-15T10:30:00Z"),
    category: { name: "Leis", slug: "leis", color: "#8B5CF6" },
    tags: ["IA", "União Europeia", "Regulamentação", "Tecnologia", "Portugal"],
    trending: true,
    priority: "HIGH",
    aiSummary:
      "🤖 A UE criou regras para IA que vão mudar tudo em Portugal. Empresas têm até 2026 para se adaptar. É tipo um 'código da estrada' para robôs inteligentes!",
    sentiment: "NEUTRAL",
    readTime: 8,
    reactions: [
      { type: "LIKE", count: 342 },
      { type: "LOVE", count: 89 },
      { type: "ANGRY", count: 23 },
    ],
    views: 15420,
    author: "Ana Silva",
  }

  return NextResponse.json(mockNews)
}
