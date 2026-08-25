$ErrorActionPreference = 'Stop'

# This script deliberately uses the Docker database and refuses to read production credentials.
$env:DATABASE_URL = 'postgresql://grounds:grounds@localhost:5432/grounds_compliance?schema=public'
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
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
