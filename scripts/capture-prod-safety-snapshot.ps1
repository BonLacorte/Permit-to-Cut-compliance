param(
  [switch]$SkipDump,
  [string]$EnvFilePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Get-ProductionDatabaseUrl {
  $envFile = if ($EnvFilePath) { $EnvFilePath } else { Join-Path $ProjectRoot ".env.local" }
  if (-not (Test-Path -LiteralPath $envFile)) {
    throw ".env.local was not found. Refusing to continue because the production DATABASE_URL source is missing."
  }

  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $line) {
    throw "DATABASE_URL was not found in .env.local. Refusing to continue."
  }

  $value = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
  if (-not $value) {
    throw "DATABASE_URL in .env.local is blank. Refusing to continue."
  }

  if ($value -match 'localhost|127\.0\.0\.1|grounds_compliance') {
    throw "DATABASE_URL appears to be local, not production. Refusing to create a production safety snapshot."
  }

  return $value
}

function New-TempEnvFile {
  param([Parameter(Mandatory = $true)][string]$DatabaseUrl)

  $path = Join-Path ([System.IO.Path]::GetTempPath()) ("grounds-prod-db-" + [Guid]::NewGuid().ToString("N") + ".env")
  Set-Content -LiteralPath $path -Value ("DATABASE_URL=" + $DatabaseUrl) -NoNewline
  return $path
}

function Invoke-PostgresContainer {
  param(
    [Parameter(Mandatory = $true)][string]$EnvFile,
    [Parameter(Mandatory = $true)][string]$ShellCommand,
    [string]$MountSource,
    [string]$MountTarget
  )

  $dockerArgs = @("run", "--rm", "--env-file", $EnvFile)
  if ($MountSource -and $MountTarget) {
    $dockerArgs += @("-v", "${MountSource}:${MountTarget}")
  }
  $dockerArgs += @("postgres:17-alpine", "sh", "-c", $ShellCommand)

  $output = & docker @dockerArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Docker postgres tool failed with exit code $LASTEXITCODE."
  }
  return $output
}

$databaseUrl = Get-ProductionDatabaseUrl
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot "backups"
$backupDir = Join-Path $backupRoot "prod-safety-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$manifestPath = Join-Path $backupDir "manifest.txt"
$countsPath = Join-Path $backupDir "production-counts.json"
$dumpPathInContainer = "/backups/production-before-deploy.dump"
$dumpPath = Join-Path $backupDir "production-before-deploy.dump"
$tempEnvFile = New-TempEnvFile -DatabaseUrl $databaseUrl

try {
  Write-Host "Production safety snapshot" -ForegroundColor Green
  Write-Host "Project: $ProjectRoot"
  Write-Host "Output folder: $backupDir"
  Write-Host "DATABASE_URL loaded from .env.local but will not be printed."

  $gitCommit = (git rev-parse HEAD).Trim()
  $gitStatus = git status --short
  $vercelProject = if (Test-Path -LiteralPath ".vercel\project.json") { Get-Content -LiteralPath ".vercel\project.json" -Raw } else { "No .vercel/project.json found." }
  $migrations = Get-ChildItem -LiteralPath "prisma\migrations" -Directory | Select-Object -ExpandProperty Name

  $manifest = @()
  $manifest += "Production safety snapshot"
  $manifest += "Created at: $(Get-Date -Format o)"
  $manifest += "Git commit: $gitCommit"
  $manifest += ""
  $manifest += "Git status --short:"
  if ($gitStatus) { $manifest += $gitStatus } else { $manifest += "Clean working tree" }
  $manifest += ""
  $manifest += "Vercel project metadata:"
  $manifest += $vercelProject
  $manifest += ""
  $manifest += "Prisma migrations present locally:"
  $manifest += $migrations
  $manifest += ""
  $manifest += "IMPORTANT: DATABASE_URL is intentionally not recorded in this manifest."
  Set-Content -LiteralPath $manifestPath -Value ($manifest -join [Environment]::NewLine)

  $countsSql = @"
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', now(),
  'application_records', (SELECT count(*) FROM public.application_records),
  'ptc_versions', (SELECT count(*) FROM public.ptc_versions),
  'application_types', (SELECT count(*) FROM public.application_types),
  'required_documents', (SELECT count(*) FROM public.required_documents),
  'progress_entries', (SELECT count(*) FROM public.progress_entries),
  'progress_documents', (SELECT count(*) FROM public.progress_documents),
  'regional_offices', (SELECT count(*) FROM public.regional_offices),
  'provincial_offices', (SELECT count(*) FROM public.provincial_offices),
  'ptt_application_records', (SELECT count(*) FROM public.ptt_application_records),
  'ptt_transport_types', (SELECT count(*) FROM public.ptt_transport_types),
  'users', (SELECT count(*) FROM public.users)
));
"@
  $countsSqlPath = Join-Path $backupDir "production-counts.sql"
  try {
    Set-Content -LiteralPath $countsSqlPath -Value $countsSql -NoNewline
    $countsCommand = "psql `"`$DATABASE_URL`" --tuples-only --no-align --file /backups/production-counts.sql"
    Invoke-PostgresContainer -EnvFile $tempEnvFile -MountSource $backupDir -MountTarget "/backups" -ShellCommand $countsCommand | Set-Content -LiteralPath $countsPath
    if (-not (Test-Path -LiteralPath $countsPath) -or (Get-Item -LiteralPath $countsPath).Length -eq 0) {
      throw "Could not capture production table counts."
    }
  } finally {
    if (Test-Path -LiteralPath $countsSqlPath) {
      Remove-Item -LiteralPath $countsSqlPath -Force
    }
  }
  if ($SkipDump) {
    Write-Host "SkipDump was set. Manifest and counts were created, but no pg_dump file was created." -ForegroundColor Yellow
  } else {
    $dumpCommand = "pg_dump `"`$DATABASE_URL`" --format=custom --file `"$dumpPathInContainer`""
    Invoke-PostgresContainer -EnvFile $tempEnvFile -MountSource $backupDir -MountTarget "/backups" -ShellCommand $dumpCommand | Out-Host
    if (-not (Test-Path -LiteralPath $dumpPath)) {
      throw "pg_dump finished but the expected dump file was not found: $dumpPath"
    }
  }

  Write-Host ""
  Write-Host "Production safety snapshot created." -ForegroundColor Green
  Write-Host "Manifest: $manifestPath"
  Write-Host "Counts: $countsPath"
  if (-not $SkipDump) { Write-Host "Dump: $dumpPath" }
  Write-Host "No deployment was performed."
} finally {
  if (Test-Path -LiteralPath $tempEnvFile) {
    Remove-Item -LiteralPath $tempEnvFile -Force
  }
}