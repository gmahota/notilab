# 🚀 NotiLab — AI News Assistant

A modern AI-powered news platform offering personalised summaries, interactive chat and gamification for a distinctive news-reading experience.

## ✨ Features

- 🤖 **AI Chat (NotiBot)** — an intelligent assistant that explains the news
- 📰 **Personalised Feed** — news adapted to your profile
- 🎮 **Gamification** — points, levels and achievements
- 📱 **Social Integrations** — WhatsApp, Telegram, Twitter
- 🔍 **Smart Search** — find news by topic or category
- 📊 **Analytics** — track your news consumption

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **Backend**: Prisma ORM, PostgreSQL
- **AI**: OpenAI/Groq (optional)
- **Deploy**: Vercel

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Git

### Installation

1. **Clone the repository**
\`\`\`bash
git clone <your-repo>
cd notilab
\`\`\`

2. **Run the automated setup**
\`\`\`bash
pnpm setup
\`\`\`

3. **Configure environment variables**
\`\`\`bash
cp .env.example .env
# Edit .env with your own settings
\`\`\`

4. **Start development**
\`\`\`bash
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📋 Available Scripts

\`\`\`bash
# Development
pnpm dev             # Start the development server
pnpm build           # Production build
pnpm start           # Start production

# Database
pnpm db:push         # Sync the schema
pnpm db:studio       # Prisma visual interface
pnpm db:seed         # Populate with seed data
pnpm db:reset        # Full reset + seed

# Quality gate
pnpm gate            # Run the whole gate (lint, typecheck, test, checks, build)
pnpm lint            # Check code style
pnpm typecheck       # Check TypeScript types
pnpm test            # Run the Jest suite
pnpm check:authorization  # Every API route has a declared authorization posture
pnpm check:secrets   # Scan for hardcoded secrets

# Utilities
pnpm setup           # Complete initial setup
pnpm check           # System health check
pnpm agents:sync     # Sync the Claude Code agents
\`\`\`

## 🤖 AI Governance (Claude, Copilot, Codex)

This project follows an "AI-first" governance system for coding assistants:

- [`AGENTS.md`](AGENTS.md) — repository rules, applicable to any assistant (Claude, Copilot, Codex, Cursor).
- [`CLAUDE.md`](CLAUDE.md) — the Claude Code operating manual, including the 11 subagents in `.claude/agents/`.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — GitHub Copilot-specific instructions.
- [`docs/memory/`](docs/memory/) — durable project knowledge (architecture, business rules, decisions).
- [`docs/manager/quality/QUALITY_GATE.md`](docs/manager/quality/QUALITY_GATE.md) — what has to pass before a merge, and — just as importantly — what the gate does *not* cover.
- [`docs/manager/roadmap/ROADMAP.md`](docs/manager/roadmap/ROADMAP.md) — hand-maintained roadmap.
- [`docs/manager/daily-reports/`](docs/manager/daily-reports/) — daily work log.

## 🗄️ Database Structure

- **Users** — user profiles with gamification
- **News** — articles with categories and reactions
- **Categories** — Politics, Sport, Culture, Economy, Law
- **ChatSessions** — AI conversations
- **TrendingTopics** — trending topics

## 🎯 User Profiles

- **👶 Young** — simple language, viral content
- **💼 Executive** — quick summaries, economy focus
- **🎓 Student** — detailed explanations, historical context
- **👴 Senior** — simplified interface, traditional news

## 🔧 Advanced Configuration

### Environment Variables

\`\`\`env
# Essential
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."

# AI (optional)
OPENAI_API_KEY="..."
GROQ_API_KEY="..."

# Social (optional)
WHATSAPP_TOKEN="..."
TELEGRAM_BOT_TOKEN="..."
\`\`\`

### Social Integrations

Configure the WhatsApp and Telegram bots to receive automatic summaries of the day's most important news.

## 📱 Deploy

### Vercel (recommended)

1. Connect your repository to Vercel
2. Configure the environment variables
3. Automatic deploy on every push

### Docker

\`\`\`bash
# Coming soon...
\`\`\`

## 🤝 Contributing

1. Fork the project
2. Create a branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📄 Licence

This project is under the MIT licence. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: suporte@notilab.com
- 💬 Discord: [NotiLab Community](https://discord.gg/notilab)
- 📖 Docs: [docs.notilab.com](https://docs.notilab.com)

---

Made with ❤️ by the NotiLab team
