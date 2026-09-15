"use server";

import { ApplicationCheckType, DocumentRequirementMode, FeatureKey, LocExemption, Prisma, PttCheckType, PttValidityBasis, PttVehicleCapacityCategory, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, requireAdmin, requireSuperadmin, requireUser, setSession, userHasFeature } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseGroundsWorkbook, parsePtcRecordsWorkbook, parsePttRecordsWorkbook } from "@/lib/excel";
import { checkPtcImportWorkbook, checkPttImportWorkbook } from "@/lib/import-checker";
import { ptcImportCheckContext, pttImportCheckContext } from "@/lib/import-checker-context";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import { calculatePttFee, calculatePttValidity, checkPttVehicleCapacity, pttCapacityMaxFromCategory, pttFeeFinding, pttValidityFinding } from "@/lib/ptt-checks";
import { defaultPttValidityRuleData, resolvedPttValidityRule } from "@/lib/ptt-validity-rules";
import { prisma } from "@/lib/prisma";
import { calculatePtcFee, calculatePtcValidity, feeFinding, normalizePtcCalculationConfig, validityFinding } from "@/lib/ptc-checks";
import { defaultRuleData, resolvedPtcCalculationRule } from "@/lib/ptc-calculation-rules";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

import { createRecordSchema, updateRecordSchema, progressSchema, createPttRecordSchema, updatePttRecordSchema, passwordSchema, isNextRedirectError, optionalString, nullableString, nullableInt, nullableDecimal, nullableBoolean, nullableLocExemption, nullablePttValidityBasis, nullablePttVehicleCapacityCategory, documentRequirementMode, nullableDate, nullableVersionId, ptcRecordData, buildPtcChecks, persistPtcChecks, calculationRuleData, pttRecordData, buildPttChecks, persistPttChecks, pttTransportCapacityData, pttValidityRuleData, safeReturnTo, masterDataReturnTo, withVersionParam, withToast, redirectWithToast, revalidateReports, revalidatePttApplications, calculationConfigFromFormData } from "./_shared";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirectWithToast("/login", "error", "Invalid email or password.");
  }

  await setSession(user.id);
  redirectWithToast("/ptc/dashboard", "success", "Signed in successfully.");
}

export async function logoutAction() {
  clearSession();
  redirectWithToast("/login", "success", "Signed out successfully.");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/ptc/dashboard");
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
    returnTo
  });

  if (!parsed.success) redirectWithToast(returnTo, "error", "Password must be at least 6 characters.");
  const input = parsed.data;
  if (input.newPassword !== input.confirmPassword) redirectWithToast(returnTo, "error", "New passwords do not match.");

  const account = await prisma.user.findUnique({ where: { id: user.id } });
  if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
    redirectWithToast(returnTo, "error", "Current password is incorrect.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) }
  });

  clearSession();
  redirectWithToast("/login", "success", "Password changed. Please sign in again.");
}
