echo "🔧 Configuração de desenvolvimento NotiLab..."

# Verificar dependências de desenvolvimento
echo "📦 Verificando dependências..."

# Instalar hooks de git (opcional)
if [ -d ".git" ]; then
    echo "🪝 Configurando hooks de git..."
    
    # Pre-commit hook para lint
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "🔍 Executando lint antes do commit..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Lint falhou. Corrija os erros antes de fazer commit."
    exit 1
fi
EOF
    
    chmod +x .git/hooks/pre-commit
    echo "✅ Hook de pre-commit configurado"
fi

# Configurar VS Code (se existir)
if command -v code &> /dev/null; then
    echo "💻 Configurando VS Code..."
    
    mkdir -p .vscode
    
    cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
EOF

    cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next"
  ]
}
EOF
    
    echo "✅ Configuração do VS Code criada"
fi

echo "🎉 Configuração de desenvolvimento concluída!"
echo "💡 Dica: Execute 'npm run check' para verificar se tudo está funcionando"
