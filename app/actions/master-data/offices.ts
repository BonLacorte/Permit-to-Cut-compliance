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

import { createRecordSchema, updateRecordSchema, progressSchema, createPttRecordSchema, updatePttRecordSchema, passwordSchema, isNextRedirectError, optionalString, nullableString, nullableInt, nullableDecimal, nullableBoolean, nullableLocExemption, nullablePttValidityBasis, nullablePttVehicleCapacityCategory, documentRequirementMode, nullableDate, nullableVersionId, ptcRecordData, buildPtcChecks, persistPtcChecks, calculationRuleData, pttRecordData, buildPttChecks, persistPttChecks, pttTransportCapacityData, pttValidityRuleData, safeReturnTo, masterDataReturnTo, withVersionParam, withToast, redirectWithToast, revalidateReports, revalidatePttApplications, calculationConfigFromFormData } from "../_shared";

export async function createRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=general");
  const name = String(formData.get("name") || "").trim();
  if (!name) redirectWithToast(returnTo, "error", "Regional office name is required.");

  try {
    const count = await prisma.regionalOffice.count({ where: { group: PERMIT_GROUP_PTC } });
    await prisma.regionalOffice.upsert({
      where: { group_name: { group: PERMIT_GROUP_PTC, name } },
      update: { active: true },
      create: { group: PERMIT_GROUP_PTC, name, sortOrder: count + 1 }
    });
  } catch {
    redirectWithToast(returnTo, "error", "Could not add the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Regional office added.");
}

export async function updateRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=general");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) redirectWithToast(returnTo, "error", "Regional office name is required.");

  try {
    await prisma.regionalOffice.update({ where: { id }, data: { name, active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not update the regional office. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Regional office updated.");
}

export async function deleteRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=general");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Regional office id is required.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.provincialOffice.updateMany({ where: { regionalOfficeId: id }, data: { active: false } });
      await tx.regionalOffice.update({ where: { id }, data: { active: false } });
    });
  } catch {
    redirectWithToast(returnTo, "error", "Could not delete the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Regional office deleted.");
}

export async function createProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=general");
  const regionalOfficeId = String(formData.get("regionalOfficeId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!regionalOfficeId || !name) redirectWithToast(returnTo, "error", "Regional office and provincial office name are required.");

  try {
    const region = await prisma.regionalOffice.findFirst({ where: { id: regionalOfficeId, group: PERMIT_GROUP_PTC, active: true } });
    if (!region) redirectWithToast(returnTo, "error", "Regional office was not found.");
    const count = await prisma.provincialOffice.count({ where: { regionalOfficeId } });
    await prisma.provincialOffice.upsert({
      where: { regionalOfficeId_name: { regionalOfficeId, name } },
      update: { active: true },
      create: { regionalOfficeId, name, sortOrder: count + 1 }
    });
  } catch {
    redirectWithToast(returnTo, "error", "Could not add the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Provincial office added.");
}

export async function updateProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=general");
  const id = String(formData.get("id") || "");
  const regionalOfficeId = String(formData.get("regionalOfficeId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !regionalOfficeId || !name) redirectWithToast(returnTo, "error", "Regional office and provincial office name are required.");

  try {
    await prisma.provincialOffice.update({ where: { id }, data: { regionalOfficeId, name, active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not update the provincial office. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Provincial office updated.");
}

export async function deleteProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=general");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Provincial office id is required.");

  try {
    await prisma.provincialOffice.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not delete the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Provincial office deleted.");
}


export async function restoreRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Regional office id is required.");

  try {
    await prisma.regionalOffice.update({ where: { id }, data: { active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not restore the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Regional office restored.");
}

export async function hardDeleteRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Regional office id is required.");

  try {
    const office = await prisma.regionalOffice.findUnique({ where: { id } });
    if (!office) redirectWithToast(returnTo, "error", "Regional office was not found.");
    if (office.active) redirectWithToast(returnTo, "error", "Deactivate the regional office before permanently deleting it.");
    await prisma.$transaction(async (tx) => {
      await tx.provincialOffice.deleteMany({ where: { regionalOfficeId: id } });
      await tx.regionalOffice.delete({ where: { id } });
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Regional office permanently deleted.");
}

export async function restoreProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Provincial office id is required.");

  try {
    const office = await prisma.provincialOffice.findUnique({ where: { id }, include: { regionalOffice: true } });
    if (!office) redirectWithToast(returnTo, "error", "Provincial office was not found.");
    if (!office.regionalOffice.active) redirectWithToast(returnTo, "error", "Restore the regional office before restoring this provincial office.");
    await prisma.provincialOffice.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not restore the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Provincial office restored.");
}

export async function hardDeleteProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Provincial office id is required.");

  try {
    const office = await prisma.provincialOffice.findUnique({ where: { id } });
    if (!office) redirectWithToast(returnTo, "error", "Provincial office was not found.");
    if (office.active) redirectWithToast(returnTo, "error", "Deactivate the provincial office before permanently deleting it.");
    await prisma.provincialOffice.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "Provincial office permanently deleted.");
}
