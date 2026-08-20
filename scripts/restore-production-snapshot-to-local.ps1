param(
  [Parameter(Mandatory = $true)]
  [string]$SnapshotDirectory,
  [switch]$ConfirmLocalRestore
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not $ConfirmLocalRestore) {
  throw "Refusing to replace the local database. Re-run with -ConfirmLocalRestore after confirming the snapshot path."
}

$backupRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "backups"))
$snapshotPath = [System.IO.Path]::GetFullPath($SnapshotDirectory)
if (-not $snapshotPath.StartsWith($backupRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "SnapshotDirectory must be inside the local backups folder."
}

$dumpPath = Join-Path $snapshotPath "production-before-deploy.dump"
$countsPath = Join-Path $snapshotPath "production-counts.json"
if (-not (Test-Path -LiteralPath $dumpPath)) { throw "Production dump was not found: $dumpPath" }
if (-not (Test-Path -LiteralPath $countsPath)) { throw "Production count manifest was not found: $countsPath" }

function Invoke-Docker {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed: docker $($Arguments -join ' ')" }
}

Write-Host "Preparing local Docker Postgres. Production is never contacted by this script." -ForegroundColor Yellow
& docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { throw "Could not start local Docker Postgres." }

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$localBackupDirectory = Join-Path $backupRoot "local-before-production-clone-$timestamp"
New-Item -ItemType Directory -Force -Path $localBackupDirectory | Out-Null
$localDumpInContainer = "/tmp/local-before-production-clone.dump"
$localDumpPath = Join-Path $localBackupDirectory "local-before-production-clone.dump"

Invoke-Docker exec grounds-compliance-postgres pg_dump -U grounds -Fc -d grounds_compliance -f $localDumpInContainer
Invoke-Docker cp "grounds-compliance-postgres:$localDumpInContainer" $localDumpPath
Invoke-Docker exec grounds-compliance-postgres rm -f $localDumpInContainer
if (-not (Test-Path -LiteralPath $localDumpPath) -or (Get-Item -LiteralPath $localDumpPath).Length -eq 0) {
  throw "Local backup was not created. Refusing to continue."
}

Write-Host "Replacing only the local Docker database from the selected production snapshot." -ForegroundColor Yellow
$terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'grounds_compliance' AND pid <> pg_backend_pid();"
Invoke-Docker exec grounds-compliance-postgres psql -U grounds -d postgres -c $terminateSql
Invoke-Docker exec grounds-compliance-postgres dropdb -U grounds --if-exists grounds_compliance
Invoke-Docker exec grounds-compliance-postgres createdb -U grounds grounds_compliance

$restoreConnection = "postgresql://grounds:grounds@host.docker.internal:5432/grounds_compliance"
$restoreCommand = @'
pg_restore --no-owner --no-privileges --file - /snapshot/production-before-deploy.dump | sed '/^SET transaction_timeout = 0;$/d' | psql "$RESTORE_CONNECTION"
'@.Trim()
& docker run --rm --volume "${snapshotPath}:/snapshot:ro" --env "RESTORE_CONNECTION=$restoreConnection" postgres:17-alpine sh -c $restoreCommand
if ($LASTEXITCODE -ne 0) { throw "Could not restore the selected snapshot into local Docker Postgres." }

$expected = Get-Content -LiteralPath $countsPath -Raw | ConvertFrom-Json
$countSql = @"
SELECT jsonb_build_object(
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
)::text;
"@
$actual = (docker exec -i grounds-compliance-postgres psql -U grounds -d grounds_compliance -At -c $countSql | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw "Could not verify local restored row counts." }

$countNames = @("application_records", "ptc_versions", "application_types", "required_documents", "progress_entries", "progress_documents", "regional_offices", "provincial_offices", "ptt_application_records", "ptt_transport_types", "users")
$mismatches = @($countNames | Where-Object { [string]$expected.$_ -ne [string]$actual.$_ })
if ($mismatches.Count -gt 0) {
  throw "Restored counts do not match the snapshot for: $($mismatches -join ', '). Local backup is available at $localBackupDirectory."
}

Write-Host "Local production-data clone complete." -ForegroundColor Green
Write-Host "Local backup: $localBackupDirectory"
Write-Host "Restored snapshot: $snapshotPath"
Write-Host "Production users and audit authors were preserved. Run local Prisma migrations next if the local code has newer migrations."