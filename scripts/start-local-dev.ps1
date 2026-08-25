$ErrorActionPreference = 'Stop'

# Keep browser testing on the Docker database even when .env.local contains production credentials.
$env:DATABASE_URL = 'postgresql://grounds:grounds@localhost:5432/grounds_compliance?schema=public'
npm run dev -- --port 3028 -H 127.0.0.1
