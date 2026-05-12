#!/bin/bash
set -e

APP_DIR="/var/www/loja"
PM2_APP_NAME="loja"

echo "==> Atualizando código..."
cd "$APP_DIR"
git pull origin main

echo "==> Instalando dependências..."
npm ci --omit=dev

echo "==> Gerando Prisma Client..."
npx prisma generate

echo "==> Rodando migrações..."
npx prisma migrate deploy

echo "==> Fazendo build..."
npm run build

echo "==> Reiniciando aplicação..."
pm2 restart "$PM2_APP_NAME" || pm2 start npm --name "$PM2_APP_NAME" -- start

echo ""
echo "Deploy concluído com sucesso!"
