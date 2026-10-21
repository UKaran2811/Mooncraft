# ─────────────────────────────────────────────────────
# Mooncraft — Push all secrets to Cloudflare Workers
# Reads from .dev.vars and pushes each as a secret.
# Usage: .\push-secrets.ps1
# ─────────────────────────────────────────────────────

Write-Host "`n🔐 Pushing secrets to Cloudflare Worker 'mooncraft'..." -ForegroundColor Cyan

$varsFile = ".dev.vars"
if (-not (Test-Path $varsFile)) {
    Write-Host "❌ .dev.vars file not found!" -ForegroundColor Red
    exit 1
}

$lines = Get-Content $varsFile
$count = 0

foreach ($line in $lines) {
    $line = $line.Trim()
    # Skip comments and empty lines
    if ($line -eq "" -or $line.StartsWith("#")) { continue }
    
    # Skip placeholder values (FILL_IN_*)
    if ($line -match "FILL_IN_") { 
        $key = ($line -split "=", 2)[0]
        Write-Host "⏭  Skipping $key (placeholder value)" -ForegroundColor DarkGray
        continue 
    }
    
    # Parse KEY=VALUE
    $parts = $line -split "=", 2
    if ($parts.Count -lt 2) { continue }
    
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    
    # Remove surrounding quotes if present
    if (($value.StartsWith("'") -and $value.EndsWith("'")) -or ($value.StartsWith('"') -and $value.EndsWith('"'))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    
    # Skip NODE_ENV (already set in wrangler.jsonc vars)
    if ($key -eq "NODE_ENV") { continue }
    
    Write-Host "  📤 $key" -ForegroundColor Yellow -NoNewline
    echo $value | npx wrangler secret put $key 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor Green
        $count++
    } else {
        Write-Host " ❌" -ForegroundColor Red
    }
}

Write-Host "`n✅ Done! Pushed $count secrets." -ForegroundColor Green
Write-Host ""
