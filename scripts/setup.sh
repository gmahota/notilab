echo "🚀 Configurando NotiLab..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi

# Verificar se PostgreSQL está disponível
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL não encontrado. Certifique-se de ter um banco PostgreSQL disponível."
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "⚠️  Configure as variáveis de ambiente no arquivo .env antes de continuar."
    exit 1
fi

# Gerar cliente Prisma
echo "🔧 Gerando cliente Prisma..."
npx prisma generate

# Executar migrações
echo "🗄️  Executando migrações do banco..."
npx prisma db push

# Executar seed
echo "🌱 Populando banco com dados iniciais..."
npx prisma db seed

echo "✅ Setup concluído! Execute 'npm run dev' para iniciar o desenvolvimento."
