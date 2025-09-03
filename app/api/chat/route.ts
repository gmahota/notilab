import { type NextRequest, NextResponse } from "next/server"

interface ChatMessage {
  id: string
  content: string
  type: "user" | "assistant"
  timestamp: Date
}

interface ChatRequest {
  message: string
  history: ChatMessage[]
}

// Mock AI responses - replace with actual AI service
const mockResponses = {
  "resumir as notícias de hoje": {
    message:
      "Aqui estão os principais destaques de hoje:\n\n🏛️ **Política**: Nova regulamentação de IA aprovada na Europa\n⚽ **Desporto**: Benfica vence na Champions League\n🎬 **Cultura**: Festival de Cinema de Lisboa anuncia programação\n💼 **Economia**: Mercados sobem após anúncios do BCE\n\nGostaria que eu detalhe algum destes tópicos?",
    suggestions: ["Detalhar lei de IA", "Mais sobre o Benfica", "Programação do festival", "Análise dos mercados"],
  },
  "explicar a nova lei de IA": {
    message:
      "A nova regulamentação europeia de IA é histórica! 🚀\n\n**Principais pontos:**\n• Classificação de sistemas de IA por risco\n• Proibição de IA para manipulação e vigilância em massa\n• Transparência obrigatória para modelos de grande escala\n• Multas até 7% do faturamento global\n\n**Impacto:** Empresas como OpenAI, Google e Meta terão que adaptar seus produtos para o mercado europeu.\n\nQuer saber mais sobre algum aspecto específico?",
    suggestions: [
      "Impacto nas empresas",
      "Cronograma de implementação",
      "Comparação com outras regiões",
      "Exceções da lei",
    ],
  },
  "notícias sobre futebol": {
    message:
      "⚽ **Últimas do Futebol:**\n\n🔴 **Benfica** venceu 3-1 na Champions, classificação garantida!\n🔵 **Porto** empata em casa, situação complicada\n🟢 **Sporting** lidera o campeonato nacional\n🏆 **Seleção** convocada para os próximos jogos\n\nDestaque para a performance histórica do Benfica na Europa após 10 anos!\n\nQue equipa te interessa mais?",
    suggestions: ["Análise do Benfica", "Situação do Porto", "Liderança do Sporting", "Convocatória da seleção"],
  },
  "tendências em tecnologia": {
    message:
      "🚀 **Tendências Tech em Alta:**\n\n🤖 **IA Generativa**: Novos modelos multimodais\n🔐 **Cibersegurança**: Aumento de 40% em ataques\n💚 **Tech Verde**: Investimentos em sustentabilidade\n🥽 **Realidade Mista**: Apple Vision Pro ganha tração\n📱 **5G**: Expansão para cidades menores\n\nA regulamentação de IA na Europa está a moldar o futuro da tecnologia global!\n\nQual área te interessa explorar?",
    suggestions: ["Novos modelos de IA", "Ameaças cibernéticas", "Tecnologia sustentável", "Realidade aumentada"],
  },
}

function generateAIResponse(message: string, history: ChatMessage[]) {
  const lowerMessage = message.toLowerCase()

  // Check for exact matches first
  for (const [key, response] of Object.entries(mockResponses)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return response
    }
  }

  // Keyword-based responses
  if (lowerMessage.includes("resumo") || lowerMessage.includes("hoje")) {
    return mockResponses["resumir as notícias de hoje"]
  }

  if (lowerMessage.includes("ia") || lowerMessage.includes("inteligência artificial")) {
    return mockResponses["explicar a nova lei de IA"]
  }

  if (lowerMessage.includes("futebol") || lowerMessage.includes("benfica") || lowerMessage.includes("porto")) {
    return mockResponses["notícias sobre futebol"]
  }

  if (lowerMessage.includes("tecnologia") || lowerMessage.includes("tech")) {
    return mockResponses["tendências em tecnologia"]
  }

  // Default response
  return {
    message:
      "Interessante pergunta! 🤔\n\nPosso ajudar-te com:\n• Resumos de notícias atuais\n• Explicações detalhadas de tópicos\n• Análises de tendências\n• Contexto histórico de eventos\n\nSobre que tema gostarias de saber mais?",
    suggestions: ["Notícias de hoje", "Política europeia", "Desporto nacional", "Tecnologia e inovação"],
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history }: ChatRequest = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

    const response = generateAIResponse(message, history)

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
