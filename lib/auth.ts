import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { FeatureKey, Role } from "@prisma/client";

const COOKIE_NAME = "grounds_session";

function getSecret() {
  return process.env.SESSION_SECRET || "development-only-secret-change-me";
}

async function sign(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature).toString("base64url");
}

export async function setSession(userId: string) {
  const value = `${userId}.${Date.now()}`;
  const signature = await sign(value);
  cookies().set(COOKIE_NAME, `${value}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const value = `${parts[0]}.${parts[1]}`;
  const expected = await sign(value);
  if (expected !== parts[2]) return null;

  return prisma.user.findUnique({
    where: { id: parts[0] },
    select: { id: true, name: true, email: true, role: true }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) redirect("/dashboard");
  return user;
}

export async function requireSuperadmin() {
  const user = await requireUser();
  if (user.role !== Role.SUPERADMIN) redirect("/dashboard");
  return user;
}

export async function getUserFeatureKeys(userId: string, role?: Role) {
  if (role === Role.SUPERADMIN) return new Set(Object.values(FeatureKey));
  const rows = await prisma.userFeatureAccess.findMany({ where: { userId }, select: { feature: true } });
  return new Set(rows.map((row) => row.feature));
}

export async function userHasFeature(user: { id: string; role: Role }, feature: FeatureKey) {
  if (user.role === Role.SUPERADMIN) return true;
  if (user.role !== Role.ADMIN) return false;
  return (await prisma.userFeatureAccess.count({ where: { userId: user.id, feature } })) > 0;
}

export async function requireFeature(feature: FeatureKey) {
  const user = await requireUser();
  if (!(await userHasFeature(user, feature))) redirect("/dashboard");
  return user;
}

export { verifyPassword };
