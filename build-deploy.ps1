$ErrorActionPreference = "Stop"
Write-Host "==> Building deploy.zip for Hostinger manual deploy..." -ForegroundColor Cyan
Write-Host "    This will: build frontend (vite), copy to backend/dist, zip backend (+ .env) to backend/deploy.zip" -ForegroundColor Gray

# Ensure backend dependencies (archiver not needed - uses Compress-Archive)
if (-not (Test-Path "backend/package.json")) {
  Write-Error "backend/package.json not found - run from project root"
  exit 1
}

# Run the canonical deploy script (handles frontend build, dist copy, staging, zip)
node backend/deploy.js

if ($LASTEXITCODE -ne 0) {
  Write-Error "deploy.js failed"
  exit 1
}

$zip = "backend/deploy.zip"
if (Test-Path $zip) {
  $size = (Get-Item $zip).Length / 1MB
  Write-Host ""
  Write-Host "Done: $zip ($([math]::Round($size,2)) MB)" -ForegroundColor Green
  Write-Host "Upload this file in Hostinger hPanel > File Manager > your Node.js app root > Extract" -ForegroundColor Yellow
  Write-Host "Contents: server.js, package.json, db.js, scraper.js, .env, dist/ (no node_modules, no .env.local, no uploads)"
  Get-ChildItem $zip | Format-List Name, Length, LastWriteTime

  # Optional: list zip contents
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $zip).Path)
  Write-Host "Zip entries:"
  $z.Entries | Select-Object FullName, Length | Sort-Object FullName | Format-Table -AutoSize
  $z.Dispose()
} else {
  Write-Error "deploy.zip not created"
  exit 1
}
