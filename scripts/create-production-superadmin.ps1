$ErrorActionPreference = 'Stop'

$line = Get-Content -LiteralPath '.env.local' | Where-Object { $_ -like 'DATABASE_URL=*' } | Select-Object -First 1
if (-not $line) { throw 'DATABASE_URL was not found in .env.local.' }

$confirm = Read-Host 'Type CREATE PRODUCTION SUPERADMIN to create a Superadmin in the database from .env.local'
if ($confirm -ne 'CREATE PRODUCTION SUPERADMIN') { throw 'Confirmation text did not match. No account was created.' }

$env:DATABASE_URL = ($line -replace '^DATABASE_URL=', '').Trim('"')
$env:ALLOW_NON_LOCAL_SUPERADMIN_CREATE = 'true'
$env:SUPERADMIN_NAME = Read-Host 'Superadmin name'
$env:SUPERADMIN_EMAIL = Read-Host 'Superadmin email'
$securePassword = Read-Host 'Superadmin password (12+ characters)' -AsSecureString
$credential = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:SUPERADMIN_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($credential)
  npx tsx scripts/create-superadmin.ts
}
finally {
  if ($credential -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($credential) }
  Remove-Item Env:SUPERADMIN_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:SUPERADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPERADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ALLOW_NON_LOCAL_SUPERADMIN_CREATE -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
