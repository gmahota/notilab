# 🚀 NotiLab - AI News Assistant

A modern AI-powered news platform offering personalized summaries, interactive chat, and gamification for a unique news consumption experience.

## ✨ Features

- 🤖 **AI Chat (NotiBot)** - Smart assistant to explain the news
- 📰 **Personalized Feed** - News tailored to your profile
- 🎮 **Gamification** - Points, levels, and achievements system
- 📱 **Social Integrations** - WhatsApp, Telegram, Twitter
- 🔍 **Smart Search** - Find news by topic or category
- 📊 **Analytics** - Track your news consumption

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

2. **Run the automatic setup**
\`\`\`bash
pnpm setup
\`\`\`

3. **Configure the environment variables**
\`\`\`bash
cp .env.example .env
# Edit .env with your settings
\`\`\`

4. **Start the development server**
\`\`\`bash
pnpm dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📋 Available Scripts

\`\`\`bash
# Development
pnpm dev             # Start the development server
pnpm build           # Production build
pnpm start           # Start production

# Database
pnpm db:push         # Sync schema
pnpm db:studio       # Prisma visual interface
pnpm db:seed         # Seed with initial data
pnpm db:reset        # Full reset + seed

# Utilities
pnpm setup           # Full initial setup
pnpm check           # Check system health
pnpm lint            # Lint code
pnpm typecheck       # Check TypeScript types
pnpm agents:sync     # Sync Claude Code agents
\`\`\`

## 🤖 AI Governance (Claude, Copilot, Codex)

This project follows an "AI-first" governance system for code assistants:

- [`AGENTS.md`](AGENTS.md) — repository rules, valid for any assistant (Claude, Copilot, Codex, Cursor).
- [`CLAUDE.md`](CLAUDE.md) — Claude Code-specific operating manual, including the 11 subagents in `.claude/agents/`.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — GitHub Copilot-specific instructions.
- [`docs/memory/`](docs/memory/) — durable project knowledge (architecture, business rules, decisions).
- [`docs/manager/quality/QUALITY_GATE.md`](docs/manager/quality/QUALITY_GATE.md) — what must pass before a merge.
- [`docs/manager/roadmap/ROADMAP.md`](docs/manager/roadmap/ROADMAP.md) — manually maintained roadmap.
- [`docs/manager/daily-reports/`](docs/manager/daily-reports/) — daily work log.

## 🗄️ Database Structure

- **Users** - User profiles with gamification
- **News** - News with categories and reactions
- **Categories** - Politics, Sports, Culture, Economy, Law
- **ChatSessions** - Conversations with AI
- **TrendingTopics** - Trending topics

## 🎯 User Profiles

- **👶 Young** - Simple language, viral content
- **💼 Executive** - Quick summaries, focus on economy
- **🎓 Student** - Detailed explanations, historical context
- **👴 Senior** - Simplified interface, traditional news

## 🔧 Advanced Configuration

### Environment Variables

\`\`\`env
# Essentials
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

Configure WhatsApp and Telegram bots to receive automatic summaries of the day's most important news.

## 📱 Deploy

### Vercel (Recommended)

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

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: suporte@notilab.com
- 💬 Discord: [NotiLab Community](https://discord.gg/notilab)
- 📖 Docs: [docs.notilab.com](https://docs.notilab.com)

---

Made with ❤️ by the NotiLab team
