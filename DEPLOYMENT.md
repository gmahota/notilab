# NotiLab - Guia de Deploy

## Pré-requisitos

### Ambiente de Desenvolvimento
\`\`\`bash
Node.js >= 18.0.0
npm >= 9.0.0
PostgreSQL >= 14.0
Redis >= 6.0 (opcional)
\`\`\`

### Variáveis de Ambiente
\`\`\`env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/notilab"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-here"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI Services (opcional)
OPENAI_API_KEY="sk-..."
GROQ_API_KEY="gsk_..."

# Email (opcional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Social Media APIs (opcional)
TWITTER_API_KEY="..."
FACEBOOK_API_KEY="..."
\`\`\`

## Instalação Local

### 1. Clone e Instale
\`\`\`bash
git clone <repository-url>
cd notilab
npm install
\`\`\`

### 2. Configure o Banco de Dados
\`\`\`bash
# Gerar cliente Prisma
npx prisma generate

# Executar migrações
npx prisma db push

# Seed inicial (opcional)
npm run seed
\`\`\`

### 3. Execute o Projeto
\`\`\`bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
\`\`\`

## Deploy na Vercel

### 1. Configuração Automática
\`\`\`bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
\`\`\`

### 2. Configurar Variáveis
No painel da Vercel:
- Settings → Environment Variables
- Adicionar todas as variáveis do `.env.example`

Obrigatórias em **Production** — sem elas partes do sistema falham em silêncio:

| Variável | Sem ela |
|---|---|
| `DATABASE_URL` | o site não arranca |
| `CRON_SECRET` | as seis rotas de cron devolvem 500 e nada é ingerido |
| `GNEWS_API_KEY` / `NEWSAPI_KEY` | os providers devolvem `[]` e a ingestão termina com `fetched: 0` sem erro |
| `OPENAI_API_KEY` ou `GROQ_API_KEY` | o enriquecimento de IA falha artigo a artigo |
| `NEXT_PUBLIC_BASE_URL` | *opcional* — ver a nota abaixo; sem ela o origin vem da variável de sistema da Vercel |

Variáveis novas só entram em builds novos: **depois de as adicionar é preciso um redeploy**.

#### O origin público (links de partilha, referral, digest)

Resolvido num único sítio, `lib/base-url.ts`, por esta ordem: `NEXT_PUBLIC_BASE_URL` →
`NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → fallback.
As duas do meio são
[system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
que a Vercel define sozinha, desde que **Enable access to System Environment Variables**
esteja activa em Settings → Environment Variables. Contêm o domínio de produção do
projecto (o custom domain mais curto, ou o `.vercel.app` se não houver) e **não** o
`VERCEL_URL`, que é o URL daquele deployment e muda a cada deploy.

Definir `NEXT_PUBLIC_BASE_URL` à mão só é necessário fora da Vercel (o deploy manual em
VPS mais abaixo) ou para forçar um domínio diferente do de produção. Como qualquer
`NEXT_PUBLIC_*` é inlined no bundle no momento do build, mudá-la exige um build novo — um
redeploy do build anterior não pega.

### 3. Configurar Banco de Dados
Recomendado: **Neon** ou **Supabase**
- Criar database PostgreSQL
- Copiar connection string
- Adicionar como `DATABASE_URL`

### 4. Cron Jobs

As seis rotas de cron são declaradas em `vercel.json`. Dois pontos que não são óbvios:

**Os crons só existem se o `vercel.json` estiver no deployment de produção.** Não há nada
a configurar no painel — a Vercel lê a lista do ficheiro em cada deploy de produção. Um
deployment antigo que não tenha `vercel.json` corre com zero crons registados.

**`CRON_SECRET` é obrigatório.** Todas as rotas em `app/api/cron/*` devolvem 500 sem ele
(ver `app/api/cron/sync-news/route.ts`). Definir em Settings → Environment Variables; a
Vercel injecta automaticamente `Authorization: Bearer $CRON_SECRET` nas invocações.

**Cada rota declara `maxDuration = 60`.** O limite por defeito das funções é curto e o
`sync-news` gasta ~11s só em esperas entre queries de provider; sem isto a execução é
morta a meio e nada é persistido. 60s é o tecto do plano Hobby.

#### Cadências e o limite do plano Hobby

O plano Hobby aceita no máximo **uma execução por dia** por cron, com precisão de ±59 min
([docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Expressões sub-diárias como
`*/30 * * * *` **falham o deployment**, não são apenas ignoradas.

As etapas são encadeadas (`sync → AI → ranking → digest → envio`), e com ±59 min de
imprecisão um intervalo curto não garante a ordem: uma etapa marcada para as 06:00 pode
disparar às 06:59 e a seguinte marcada para as 06:30 pode disparar às 06:30, fora de ordem.
Daí os **intervalos de 2h** — no pior caso sobra ~1h entre o fim de uma etapa e o início da
seguinte. Os horários são UTC e trabalham para trás a partir do envio do digest, para
chegar de manhã em Maputo (UTC+2):

| Cron | UTC | Maputo | Porquê |
|---|---|---|---|
| `sync-news` | 20:00 | 22:00 | ingestão da noite anterior; 12 pedidos GNews/dia, dentro do tier gratuito |
| `process-ai-news` | 22:00 | 00:00 | enriquece o que o sync trouxe |
| `recalculate-ranking` | 00:00 | 02:00 | precisa dos scores de importância da IA |
| `generate-digest` | 02:00 | 04:00 | monta a edição a partir do feed ranqueado |
| `send-digest` | 05:00 | 07:00 | entrega de manhã |
| `send-messaging` | 07:00 | 09:00 | WhatsApp/Telegram depois do email |

**Consequência a assumir:** em Hobby o conteúdo do site só é actualizado 1× por dia. Para
a frescura de 15–30 min que o produto pressupõe é preciso passar a Pro (permite cadência
ao minuto) ou disparar as rotas a partir de um agendador externo — um workflow agendado no
GitHub Actions a chamar os endpoints com o `CRON_SECRET` contorna o limite sem mudar de plano.

## Deploy Manual (VPS/Servidor)

### 1. Preparar Servidor
\`\`\`bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm postgresql nginx

# Configurar PostgreSQL
sudo -u postgres createdb notilab
sudo -u postgres createuser notilab_user
\`\`\`

### 2. Deploy da Aplicação
\`\`\`bash
# Clone do repositório
git clone <repository-url>
cd notilab

# Instalar dependências
npm ci --production

# Build da aplicação
npm run build

# Configurar PM2 (opcional)
npm install -g pm2
pm2 start npm --name "notilab" -- start
\`\`\`

### 3. Configurar Nginx
\`\`\`nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## Configurações de Produção

### Performance
\`\`\`javascript
// next.config.mjs
export default {
  experimental: {
    serverComponentsExternalPackages: ['prisma']
  },
  images: {
    domains: ['your-domain.com'],
    formats: ['image/webp', 'image/avif']
  }
}
\`\`\`

### Segurança
\`\`\`env
# Produção
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
JWT_SECRET=<strong-random-secret>
\`\`\`

## Monitoramento

### Health Checks
- **Endpoint**: `/api/health`
- **Status**: 200 = OK, 500 = Error
- **Métricas**: Database, Redis, APIs

### Logs
\`\`\`bash
# PM2 logs
pm2 logs notilab

# Vercel logs
vercel logs

# Docker logs
docker logs notilab-container
\`\`\`

## Backup e Recuperação

### Banco de Dados
\`\`\`bash
# Backup
pg_dump notilab > backup_$(date +%Y%m%d).sql

# Restore
psql notilab < backup_20240115.sql
\`\`\`

### Arquivos
\`\`\`bash
# Backup uploads
tar -czf uploads_backup.tar.gz public/uploads/

# Restore
tar -xzf uploads_backup.tar.gz
\`\`\`

## Troubleshooting

### Problemas Comuns
1. **Build falha**: Verificar Node.js version
2. **Database error**: Verificar connection string
3. **404 em produção**: Verificar build output
4. **Slow performance**: Verificar database indexes

### Debug
\`\`\`bash
# Logs detalhados
DEBUG=* npm run dev

# Verificar build
npm run build
npm run start

# Test database
npx prisma studio
