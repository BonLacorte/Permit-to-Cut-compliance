# Free Deployment Guide

This project can be deployed with a zero-dollar starting setup by using **Vercel Hobby** for the Next.js app and **Neon Free** for PostgreSQL.

This is a no-charge development/small-office path, not a guarantee that the app will stay free forever under heavier usage. Monitor both dashboards and avoid paid add-ons.

## Target Architecture

- **App hosting:** Vercel Hobby plan for the Next.js frontend and server-side route handlers/server actions.
- **Database:** Neon Free PostgreSQL.
- **Production Docker:** Do not use Docker in production on Vercel. Docker Compose remains local-only for development.
- **Runtime:** Vercel Node.js runtime for server-side TypeScript/JavaScript functions.

Official references:

- Vercel Pricing: https://vercel.com/pricing
- Vercel Node.js Runtime: https://vercel.com/docs/functions/runtimes/node-js
- Neon Pricing: https://neon.com/pricing
- Neon Plans: https://neon.com/docs/introduction/plans

## Before You Start

You need:

- A GitHub account.
- A Vercel account on the Hobby plan.
- A Neon account on the Free plan.
- This project working locally.
- The Excel master data file available locally if you plan to import after deployment.

Important: do not commit `.env`, database passwords, production secrets, uploaded local files, or Excel files containing private data unless you intentionally want them in the repository.

## Step 1: Push The Project To GitHub

1. Open the project folder locally.
2. Confirm `.env` is ignored by Git.
3. Create a GitHub repository.
4. Commit the project files.
5. Push to GitHub.

Example commands:

```bash
git status
git add .
git commit -m "Prepare grounds compliance app for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2: Create A Neon Free Database

1. Go to https://neon.com and sign in.
2. Create a new project.
3. Choose the Free plan.
4. Open the project dashboard.
5. Copy the pooled PostgreSQL connection string.

Use the pooled connection string for Vercel because serverless functions open short-lived database connections.

The value should look similar to this:

```text
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

## Step 3: Add Environment Variables In Vercel

In Vercel, import the GitHub repo, then add these environment variables under Project Settings.

Required:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
SESSION_SECRET=use-a-long-random-secret-here
```

Generate a strong `SESSION_SECRET`. For example, locally:

```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

Optional/local-only guidance:

```text
MASTER_DATA_XLSX=
```

Do not point `MASTER_DATA_XLSX` to a local Windows path in production. Vercel cannot read `C:\...` files from your computer. For production, either import Excel from the Admin page after deployment, or seed/import locally while temporarily pointing your local `DATABASE_URL` to Neon.

## Step 4: Deploy The App On Vercel

1. Go to https://vercel.com/new.
2. Import the GitHub repository.
3. Keep the framework preset as Next.js.
4. Use the default install command unless you intentionally changed package managers.
5. Use `npm run build` as the build command.
6. Confirm the environment variables are present.
7. Click Deploy.

The first deployment can fail if the database schema has not been migrated yet. That is okay; run the migration step next, then redeploy.

## Step 5: Run Prisma Migrations Against Neon

From your local machine, temporarily set `DATABASE_URL` to the Neon pooled connection string, then run:

```bash
npx prisma migrate deploy
```

If your local shell uses PowerShell:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
npx prisma migrate deploy
```

This creates the database tables in Neon.

## Step 6: Seed Or Import Master Data

Choose one option.

Option A: Import from the deployed Admin page:

1. Open the deployed Vercel URL.
2. Log in as an admin user.
3. Go to Master Data.
4. Use Import Excel.
5. Upload the current master data workbook.

Option B: Seed/import from your local machine into Neon:

1. Set local `DATABASE_URL` to the Neon connection string.
2. Make sure the Excel file path is valid on your local machine if the seed script needs it.
3. Run the project seed/import command used by this app.

Example:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
npx prisma db seed
```

## Step 7: Redeploy And Test

1. Redeploy from Vercel if the first build failed before migrations.
2. Open the production URL.
3. Log in.
4. Create a test application record.
5. Select submitted files.
6. Edit the application and confirm submitted files can be replaced.
7. Check Dashboard, Missing Documents, and Document Combinations.
8. Export reports if needed.

## Step 8: Keep It Free As Safely As Possible

Use this setup carefully:

- Keep traffic private and small.
- Do not enable paid Vercel add-ons.
- Do not upgrade Vercel from Hobby unless you accept monthly charges.
- Do not upgrade Neon from Free unless you accept database charges.
- Watch the Vercel usage dashboard.
- Watch the Neon usage dashboard.
- Keep Neon scale-to-zero enabled for small/intermittent use.
- Export Excel reports regularly as backups.
- Keep a local backup of the source code and important exported data.

## Free-Tier Cautions

Vercel Hobby is listed by Vercel as free, but it still has monthly included limits. The pricing page currently lists included usage such as Edge Requests, Fast Data Transfer, function CPU/memory, and invocations. If usage grows beyond the free limits or if paid features are enabled, charges or an upgrade may be required.

Neon Free is listed as $0 with no credit card required. The pricing page currently lists limits such as 100 CU-hours monthly per project and 0.5 GB storage per project. Neon compute can scale to zero when idle, which helps small apps stay within the free allowance. If the database grows or receives steady traffic, you may need a paid plan.

For real office production use, treat this as a starting setup. Free plans are best for pilots, demos, small internal usage, or early rollout. They are not a replacement for a monitored production budget once the app becomes important to daily operations.

## Recommended No-Charge Setup

Use this exact approach for the lowest risk of surprise costs:

1. Vercel Hobby account only.
2. Neon Free project only.
3. No paid add-ons.
4. No public marketing traffic.
5. Admin-only import/export workflow.
6. Regular Excel exports as backups.
7. Monthly usage checks in both Vercel and Neon.