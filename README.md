# 🚀 NotiLab - Assistente de Notícias com IA

Uma plataforma moderna de notícias com inteligência artificial que oferece resumos personalizados, chat interativo e gamificação para uma experiência de consumo de notícias única.

## ✨ Funcionalidades

- 🤖 **Chat IA (NotiBot)** - Assistente inteligente para explicar notícias
- 📰 **Feed Personalizado** - Notícias adaptadas ao seu perfil
- 🎮 **Gamificação** - Sistema de pontos, níveis e conquistas
- 📱 **Integrações Sociais** - WhatsApp, Telegram, Twitter
- 🔍 **Busca Inteligente** - Encontre notícias por tema ou categoria
- 📊 **Analytics** - Acompanhe seu consumo de notícias

## 🛠️ Stack Tecnológica

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **Backend**: Prisma ORM, PostgreSQL
- **IA**: OpenAI/Groq (opcional)
- **Deploy**: Vercel

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- Git

### Instalação

1. **Clone o repositório**
\`\`\`bash
git clone <seu-repo>
cd notilab
\`\`\`

2. **Execute o setup automático**
\`\`\`bash
pnpm setup
\`\`\`

3. **Configure as variáveis de ambiente**
\`\`\`bash
cp .env.example .env
# Edite o .env com suas configurações
\`\`\`

4. **Inicie o desenvolvimento**
\`\`\`bash
pnpm dev
\`\`\`

Acesse [http://localhost:3000](http://localhost:3000) para ver a aplicação.

## 📋 Scripts Disponíveis

\`\`\`bash
# Desenvolvimento
pnpm dev             # Iniciar servidor de desenvolvimento
pnpm build           # Build de produção
pnpm start           # Iniciar produção

# Banco de dados
pnpm db:push         # Sincronizar schema
pnpm db:studio       # Interface visual do Prisma
pnpm db:seed         # Popular com dados iniciais
pnpm db:reset        # Reset completo + seed

# Utilitários
pnpm setup           # Configuração inicial completa
pnpm check           # Verificar saúde do sistema
pnpm lint            # Verificar código
pnpm typecheck       # Verificar tipos TypeScript
pnpm agents:sync     # Sincronizar agentes Claude Code
\`\`\`

## 🤖 Governança de IA (Claude, Copilot, Codex)

Este projeto segue um sistema de governança "AI-first" para assistentes de código:

- [`AGENTS.md`](AGENTS.md) — regras do repositório, válidas para qualquer assistente (Claude, Copilot, Codex, Cursor).
- [`CLAUDE.md`](CLAUDE.md) — manual de operação específico do Claude Code, incluindo os 11 subagentes em `.claude/agents/`.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — instruções específicas do GitHub Copilot.
- [`docs/memory/`](docs/memory/) — conhecimento duradouro do projeto (arquitetura, regras de negócio, decisões).
- [`docs/manager/qualidade/QUALITY_GATE.md`](docs/manager/qualidade/QUALITY_GATE.md) — o que precisa passar antes de um merge.
- [`docs/manager/roadmap/ROADMAP.md`](docs/manager/roadmap/ROADMAP.md) — roadmap mantido manualmente.
- [`docs/manager/daily-reports/`](docs/manager/daily-reports/) — registo diário de trabalho.

## 🗄️ Estrutura do Banco

- **Users** - Perfis de utilizador com gamificação
- **News** - Notícias com categorias e reações
- **Categories** - Política, Desporto, Cultura, Economia, Leis
- **ChatSessions** - Conversas com IA
- **TrendingTopics** - Tópicos em alta

## 🎯 Perfis de Utilizador

- **👶 Jovem** - Linguagem simples, conteúdo viral
- **💼 Executivo** - Resumos rápidos, foco em economia
- **🎓 Estudante** - Explicações detalhadas, contexto histórico
- **👴 Senior** - Interface simplificada, notícias tradicionais

## 🔧 Configuração Avançada

### Variáveis de Ambiente

\`\`\`env
# Essenciais
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."

# IA (opcional)
OPENAI_API_KEY="..."
GROQ_API_KEY="..."

# Sociais (opcional)
WHATSAPP_TOKEN="..."
TELEGRAM_BOT_TOKEN="..."
\`\`\`

### Integrações Sociais

Configure bots do WhatsApp e Telegram para receber resumos automáticos das notícias mais importantes do dia.

## 📱 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### Docker

\`\`\`bash
# Em breve...
\`\`\`

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- 📧 Email: suporte@notilab.com
- 💬 Discord: [NotiLab Community](https://discord.gg/notilab)
- 📖 Docs: [docs.notilab.com](https://docs.notilab.com)

---

Feito com ❤️ pela equipa NotiLab
