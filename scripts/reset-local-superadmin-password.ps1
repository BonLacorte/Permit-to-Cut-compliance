$ErrorActionPreference = 'Stop'

# This reset intentionally targets only the Docker database.
$env:DATABASE_URL = 'postgresql://grounds:grounds@localhost:5432/grounds_compliance?schema=public'
$env:SUPERADMIN_EMAIL = Read-Host 'Superadmin email'
$securePassword = Read-Host 'New Superadmin password (12+ characters)' -AsSecureString
$credential = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:SUPERADMIN_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($credential)
  npx tsx scripts/reset-local-superadmin-password.ts
}
finally {
  if ($credential -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($credential) }
  Remove-Item Env:SUPERADMIN_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:SUPERADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
