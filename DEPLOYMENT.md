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

### 3. Configurar Banco de Dados
Recomendado: **Neon** ou **Supabase**
- Criar database PostgreSQL
- Copiar connection string
- Adicionar como `DATABASE_URL`

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
