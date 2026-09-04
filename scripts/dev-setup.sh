echo "🔧 NotiLab development setup..."

# Check development dependencies
echo "📦 Checking dependencies..."

# Install git hooks (optional)
if [ -d ".git" ]; then
    echo "🪝 Setting up git hooks..."

    # Pre-commit hook for lint
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "🔍 Running lint before commit..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Lint failed. Fix the errors before committing."
    exit 1
fi
EOF

    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook configured"
fi

# Configure VS Code (if it exists)
if command -v code &> /dev/null; then
    echo "💻 Configuring VS Code..."
    
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
    
    echo "✅ VS Code configuration created"
fi

echo "🎉 Development setup complete!"
echo "💡 Tip: Run 'npm run check' to verify everything is working"
