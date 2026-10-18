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

## Duplicate review and selective merge

PTC/PTT duplicate badges, dashboard counts, and export flags match permit numbers across **all** Versions, including archived and Uncategorized records, before applying list filters. Matching ignores case and surrounding/repeated whitespace, but preserves punctuation and leading zeros. Blank numbers never match.

Superadmin can explicitly enable **Duplicate Management (PTC & PTT)** in Accounts & Access for Admin/Superadmin accounts, including their own. It is off by default. Staff can see duplicate flags but cannot compare or merge.

From Applications, open **Duplicate Review** or **Compare duplicates**. Select a retained record, explicitly select records to delete, and optionally copy individual fields from those deletions. Only one donor is allowed per field. Selected blank values clear fields; Manual Remarks append without repeating identical blocks. PTC Type and submitted documents/progress are never transferred. The retained Version and creation metadata stay unchanged.

Generate the server preview, review resulting values and unavailable checks, then confirm the merge. Checkers run automatically using retained-Version rules, even for archived Versions. Missing inputs clear unavailable calculated values and save recognizable not-checked remarks/metadata. Any relevant record, history, or rule change invalidates the preview. A serializable transaction refreshes the retained record and check history, stores durable snapshots in `activity_log` (`MERGE_DUPLICATE_RECORDS`), and deletes only selected duplicates. Snapshots survive deletion; no restore screen is provided.

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
