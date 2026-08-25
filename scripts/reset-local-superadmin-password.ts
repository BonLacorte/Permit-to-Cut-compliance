import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/password";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL || "";

if (!email || !password) {
  throw new Error("Email and password are required. Run the PowerShell wrapper so the password is prompted securely.");
}
if (password.length < 12) {
  throw new Error("Use a password with at least 12 characters.");
}

const host = new URL(databaseUrl).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("This local-only reset refuses to run against a non-local database.");
}

const prisma = new PrismaClient();

async function main() {
  const safeEmail = email as string;
  const safePassword = password as string;
  const user = await prisma.user.findUnique({ where: { email: safeEmail } });
  if (!user || user.role !== Role.SUPERADMIN) {
    throw new Error("No local Superadmin account exists with that email.");
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(safePassword) } });
  console.log(`Reset the local Superadmin password for ${safeEmail}.`);
}

main().finally(async () => prisma.$disconnect());
