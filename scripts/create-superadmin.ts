import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/password";

const name = process.env.SUPERADMIN_NAME?.trim();
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL || "";

if (!name || !email || !password) {
  throw new Error("Name, email, and password are required. Run the PowerShell wrapper so credentials are prompted securely.");
}
if (password.length < 12) {
  throw new Error("Use a password with at least 12 characters.");
}

const host = new URL(databaseUrl).hostname;
if (host !== "localhost" && host !== "127.0.0.1" && process.env.ALLOW_NON_LOCAL_SUPERADMIN_CREATE !== "true") {
  throw new Error("This bootstrap refuses to run against a non-local database unless the production confirmation wrapper is used.");
}

const prisma = new PrismaClient();

async function main() {
  const safeName = name as string;
  const safeEmail = email as string;
  const safePassword = password as string;
  const existing = await prisma.user.findUnique({ where: { email: safeEmail } });
  if (existing) throw new Error("A user already exists with that email. Use the Accounts & Access screen to manage it.");

  await prisma.user.create({
    data: { name: safeName, email: safeEmail, passwordHash: await hashPassword(safePassword), role: Role.SUPERADMIN }
  });
  console.log(`Created local Superadmin account for ${safeEmail}.`);
}

main().finally(async () => prisma.$disconnect());

