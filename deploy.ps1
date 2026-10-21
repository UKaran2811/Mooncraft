# ─────────────────────────────────────────────────────
# Mooncraft — One-command deploy to Cloudflare
# Usage: .\deploy.ps1
# ─────────────────────────────────────────────────────

Write-Host "`n🌙 Mooncraft — Deploying to Cloudflare Workers..." -ForegroundColor Cyan

# Step 1: Build frontend
Write-Host "`n📦 Building frontend (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend built successfully" -ForegroundColor Green

# Step 2: Deploy worker + assets
Write-Host "`n🚀 Deploying Worker + Assets to Cloudflare..." -ForegroundColor Yellow
npx wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Wrangler deploy failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Deployed successfully!" -ForegroundColor Green

Write-Host "`n🎉 Deployment complete!" -ForegroundColor Cyan
Write-Host "   API:     https://mooncraft.your-workers-subdomain.workers.dev/api/health" -ForegroundColor Gray
Write-Host "   Site:    https://mooncraft.your-workers-subdomain.workers.dev" -ForegroundColor Gray
Write-Host "   Custom:  https://mooncraftbymoniyal.com (after DNS setup)" -ForegroundColor Gray
Write-Host ""
