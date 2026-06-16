# Grounds Compliance Web

Full-stack Next.js replacement for the Grounds for Cutting document compliance workbook.

## What It Implements

- Dynamic application record entry without fixed Excel document columns.
- Required document picker scoped to the selected type of application.
- Duplicate prevention across users on the same application record.
- Separate staff progress entries attached to one shared application record.
- Admin/staff roles.
- Dashboard, applications, missing documents, document summary, application summary, completion summary, and document-combination reports.
- Excel master-data import and report workbook export.
- PostgreSQL schema through Prisma.
- Docker Compose for local PostgreSQL.

## Local Setup

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start Docker Desktop.
3. Start Postgres:

```powershell
docker compose up -d postgres
```

4. Apply the database migration and seed Excel master data:

```powershell
npx prisma migrate dev
npm run prisma:seed
```

5. Run the app:

```powershell
npm run dev
```

6. Open `http://localhost:3000`.

## Seed Users

- Admin: `admin@example.com` / `admin123`
- Staff: `staff@example.com` / `staff123`

Change these credentials after first login in a real deployment.

## Verification Commands

```powershell
npx prisma validate
npm test
npm run lint
npm run build
```

## Deployment Notes

Vercel should host the Next.js app and its Node.js route handlers/server actions. Use Vercel Postgres, Neon, Supabase Postgres, or another managed PostgreSQL provider for `DATABASE_URL`. Docker Compose is only for local development because Vercel does not run a normal long-lived Docker Compose backend.

Before deploying, set these Vercel environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`

For production, run migrations against the hosted database with:

```powershell
npx prisma migrate deploy
```