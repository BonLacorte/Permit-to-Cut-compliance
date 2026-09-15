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

export async function createUserAction(formData: FormData) {
  await requireSuperadmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF") === "ADMIN" ? Role.ADMIN : Role.STAFF;
  if (!name || !email || password.length < 6) {
    redirectWithToast("/admin/users", "error", "Name, email, and a 6-character password are required.");
  }

  try {
    await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password) }
    });
  } catch {
    redirectWithToast("/admin/users", "error", "Could not create the user. The email may already exist.");
  }

  revalidatePath("/admin/users");
  redirectWithToast("/admin/users", "success", "User created.");
}
export async function deleteUserAction(formData: FormData) {
  const admin = await requireSuperadmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/users", "error", "User id is required.");
  if (id === admin.id) redirectWithToast("/admin/users", "error", "You cannot delete your own account.");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) redirectWithToast("/admin/users", "error", "User was not found.");
  if (target.role === Role.SUPERADMIN) redirectWithToast("/admin/users", "error", "Superadmin accounts cannot be deleted from this screen.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.updateMany({ where: { createdById: id }, data: { createdById: admin.id } });
      await tx.applicationRecord.updateMany({ where: { editedById: id }, data: { editedById: null } });
      await tx.pttApplicationRecord.updateMany({ where: { createdById: id }, data: { createdById: admin.id } });
      await tx.pttApplicationRecord.updateMany({ where: { editedById: id }, data: { editedById: null } });
      await tx.progressEntry.updateMany({ where: { userId: id }, data: { userId: admin.id } });
      await tx.activityLog.updateMany({ where: { userId: id }, data: { userId: admin.id } });
      await tx.user.delete({ where: { id } });
      await tx.activityLog.create({
        data: { userId: admin.id, action: "DELETE_USER", targetType: "user", targetId: id, metadata: { email: target.email } }
      });
    });
  } catch {
    redirectWithToast("/admin/users", "error", "Could not delete the user.");
  }

  revalidatePath("/admin/users");
  revalidateReports();
  redirectWithToast("/admin/users", "success", "User deleted.");
}

export async function resetUserPasswordAction(formData: FormData) {
  const superadmin = await requireSuperadmin();
  const userId = String(formData.get("userId") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (!userId) redirectWithToast("/admin/users", "error", "User id is required.");
  if (newPassword.length < 6) redirectWithToast("/admin/users", "error", "New password must be at least 6 characters.");
  if (newPassword !== confirmPassword) redirectWithToast("/admin/users", "error", "New passwords do not match.");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirectWithToast("/admin/users", "error", "User was not found.");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
    await tx.activityLog.create({
      data: { userId: superadmin.id, action: "RESET_USER_PASSWORD", targetType: "user", targetId: userId, metadata: { email: target.email } }
    });
  });

  revalidatePath("/admin/users");
  redirectWithToast("/admin/users", "success", `Password reset for ${target.email}.`);
}

export async function updateUserFeatureAccessAction(formData: FormData) {
  const superadmin = await requireSuperadmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) redirectWithToast("/admin/users", "error", "User id is required.");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirectWithToast("/admin/users", "error", "User was not found.");
  if (target.role !== Role.ADMIN && target.role !== Role.STAFF) redirectWithToast("/admin/users", "error", "Feature access can only be assigned to Admin or Staff accounts.");
  const features = [
    ...(formData.get("ptcFeesChecker") === "on" ? [FeatureKey.PTC_FEES_CHECKER] : []),
    ...(formData.get("ptcValidityChecker") === "on" ? [FeatureKey.PTC_VALIDITY_CHECKER] : []),
    ...(formData.get("pttFeesChecker") === "on" ? [FeatureKey.PTT_FEES_CHECKER] : []),
    ...(formData.get("pttValidityChecker") === "on" ? [FeatureKey.PTT_VALIDITY_CHECKER] : []),
    ...(formData.get("pttVehicleCapacityChecker") === "on" ? [FeatureKey.PTT_VEHICLE_CAPACITY_CHECKER] : [])
  ];

  await prisma.$transaction(async (tx) => {
    await tx.userFeatureAccess.deleteMany({ where: { userId } });
    if (features.length > 0) await tx.userFeatureAccess.createMany({ data: features.map((feature) => ({ userId, feature })) });
    await tx.activityLog.create({
      data: { userId: superadmin.id, action: "UPDATE_FEATURE_ACCESS", targetType: "user", targetId: userId, metadata: { features } }
    });
  });

  revalidatePath("/admin/users");
  redirectWithToast("/admin/users", "success", "Feature access updated.");
}

