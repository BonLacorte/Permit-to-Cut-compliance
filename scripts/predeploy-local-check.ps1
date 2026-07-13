param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$LocalDatabaseUrl = "postgresql://grounds:grounds@localhost:5432/grounds_compliance?schema=public"
$env:DATABASE_URL = $LocalDatabaseUrl

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Command
}

function Assert-DockerRunning {
  cmd.exe /c "docker info >NUL 2>NUL"
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running. Start Docker Desktop, wait until it is ready, then rerun this script."
  }
}
function Wait-ForLocalPostgres {
  $maxAttempts = 30
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    cmd.exe /c "docker exec grounds-compliance-postgres pg_isready -U grounds -d grounds_compliance >NUL 2>NUL"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Local Postgres is ready." -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 2
  }

  throw "Local Postgres did not become ready after $($maxAttempts * 2) seconds."
}

Write-Host "Deployment safety local preflight" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Database: local Docker Postgres on localhost:5432"
Write-Host "Production will not be touched by this script."

Invoke-Step "Current Git commit" {
  git rev-parse HEAD
}

Invoke-Step "Current working tree status" {
  git status --short
}

Invoke-Step "Start local Postgres" {
  Assert-DockerRunning
  docker compose up -d postgres
  Wait-ForLocalPostgres
}

Invoke-Step "Apply local migrations" {
  npx prisma migrate deploy
}

Invoke-Step "Run unit tests" {
  npm run test
}

Invoke-Step "Run production build against local database" {
  npm run build
}

Write-Host ""
Write-Host "Local pre-deployment checks passed." -ForegroundColor Green
Write-Host "No production deploy was performed."