#!/bin/bash

# 개발 환경 시작 스크립트

echo "🚀 Starting development environment with production databases..."

# .env.local을 .env로 복사 (백업 생성)
if [ -f .env ]; then
    cp .env .env.backup
    echo "📄 Backed up existing .env to .env.backup"
fi

cp .env.local .env
echo "📝 Using local development configuration"

# SSH 터널 확인
echo "🔍 Checking SSH tunnel requirements..."

# netcat 설치 확인
if ! command -v nc &> /dev/null; then
    echo "❌ netcat is required but not installed."
    echo "   Install with: brew install netcat (macOS) or apt-get install netcat (Ubuntu)"
    exit 1
fi

# SSH 터널 스크립트 존재 확인
if [ ! -f scripts/connect-prod-db.sh ]; then
    echo "❌ SSH tunnel script not found"
    exit 1
fi

echo "✅ Requirements check passed"
echo ""
echo "📋 Next steps to connect to production databases:"
echo "   1. Get SSH access to your Coolify server"
echo "   2. Edit scripts/connect-prod-db.sh with your server IP"
echo "   3. Run: ./scripts/connect-prod-db.sh (in a separate terminal)"
echo "   4. Run: npm run dev (in this terminal)"
echo ""
echo "⚠️  Note: You need SSH access to your Coolify server with the following:"
echo "   - Server IP address"
echo "   - SSH private key"
echo "   - Root or sudo access"
echo ""

read -p "Do you want to start the development server now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏃 Starting development server..."
    npm run dev
else
    echo "👋 Development server not started. Run 'npm run dev' when ready."
fi