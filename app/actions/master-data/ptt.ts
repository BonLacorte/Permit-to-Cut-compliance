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

export async function createPttVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!name) redirectWithToast(returnTo, "error", "PTT Version name is required.");

  try {
    const count = await prisma.ptcVersion.count({ where: { group: PERMIT_GROUP_PTT } });
    const version = await prisma.ptcVersion.upsert({
      where: { group_name: { group: PERMIT_GROUP_PTT, name } },
      update: { active: true, description },
      create: { group: PERMIT_GROUP_PTT, name, description, sortOrder: count + 1 }
    });
    await prisma.pttValidityRule.upsert({
      where: { versionId: version.id },
      update: {},
      create: { versionId: version.id, ...defaultPttValidityRuleData() }
    });
  } catch {
    redirectWithToast(returnTo, "error", "Could not create the PTT Version. The name may already exist.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT Version created.");
}
export async function updatePttVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!id || !name) redirectWithToast(returnTo, "error", "PTT Version name is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast(returnTo, "error", "PTT Version was not found.");
    await prisma.ptcVersion.update({ where: { id }, data: { name, description } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not update the PTT Version. The name may already exist.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT Version updated.");
}

export async function deletePttVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "PTT Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast(returnTo, "error", "PTT Version was not found.");
    await prisma.ptcVersion.update({ where: { id }, data: { active: false } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not deactivate the PTT Version.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT Version deactivated.");
}

export async function createPttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const versionId = String(formData.get("versionId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!versionId || !name) redirectWithToast(returnTo, "error", "PTT Version and transport type are required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT, active: true } });
    if (!version) redirectWithToast(returnTo, "error", "Selected PTT Version was not found.");
    const count = await prisma.pttTransportType.count({ where: { versionId } });
    await prisma.pttTransportType.upsert({
      where: { versionId_name: { versionId, name } },
      update: { active: true, ...pttTransportCapacityData(formData) },
      create: { group: PERMIT_GROUP_PTT, versionId, name, sortOrder: count + 1, ...pttTransportCapacityData(formData) }
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not add the PTT transport type. It may already exist in this Version.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT transport type added.");
}

export async function updatePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const id = String(formData.get("id") || "");
  const versionId = String(formData.get("versionId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !versionId || !name) redirectWithToast(returnTo, "error", "PTT Version and transport type are required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast(returnTo, "error", "Selected PTT Version was not found.");
    await prisma.pttTransportType.update({ where: { id }, data: { versionId, name, active: true, ...pttTransportCapacityData(formData) } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not update the PTT transport type. It may already exist in this Version.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT transport type updated.");
}

export async function deletePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "PTT transport type id is required.");

  try {
    await prisma.pttTransportType.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not delete the PTT transport type.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT transport type deleted.");
}

export async function savePttValidityRuleAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptt");
  const versionId = String(formData.get("versionId") || "");
  if (!versionId) redirectWithToast(returnTo, "error", "PTT Version is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast(returnTo, "error", "Selected PTT Version was not found.");
    await prisma.pttValidityRule.upsert({
      where: { versionId },
      update: pttValidityRuleData(formData),
      create: { versionId, ...pttValidityRuleData(formData) }
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", error instanceof Error ? error.message : "Could not save PTT validity rules.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(returnTo, "success", "PTT validity rules saved.");
}


export async function restorePttVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "PTT Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast(returnTo, "error", "PTT Version was not found.");
    await prisma.ptcVersion.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not restore the PTT Version.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT Version restored.");
}

export async function hardDeletePttVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "PTT Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({
      where: { id, group: PERMIT_GROUP_PTT },
      include: { pttRecords: true }
    });
    if (!version) redirectWithToast(returnTo, "error", "PTT Version was not found.");
    if (version.active) redirectWithToast(returnTo, "error", "Deactivate the PTT Version before permanently deleting it.");
    if (version.pttRecords.length > 0) redirectWithToast(returnTo, "error", "Cannot permanently delete a PTT Version assigned to application records.");
    await prisma.ptcVersion.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the PTT Version.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT Version permanently deleted.");
}

export async function restorePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "PTT transport type id is required.");

  try {
    const type = await prisma.pttTransportType.findUnique({ where: { id }, include: { version: true } });
    if (!type) redirectWithToast(returnTo, "error", "PTT transport type was not found.");
    if (!type.version.active) redirectWithToast(returnTo, "error", "Restore the PTT Version before restoring this transport type.");
    await prisma.pttTransportType.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not restore the PTT transport type.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT transport type restored.");
}

export async function hardDeletePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "PTT transport type id is required.");

  try {
    const type = await prisma.pttTransportType.findUnique({ where: { id } });
    if (!type) redirectWithToast(returnTo, "error", "PTT transport type was not found.");
    if (type.active) redirectWithToast(returnTo, "error", "Deactivate the PTT transport type before permanently deleting it.");
    const usedCount = await prisma.pttApplicationRecord.count({
      where: { versionId: type.versionId, transportType: type.name }
    });
    if (usedCount > 0) redirectWithToast(returnTo, "error", "Cannot permanently delete a PTT transport type used by application records.");
    await prisma.pttTransportType.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the PTT transport type.");
  }

  revalidatePttApplications();
  redirectWithToast(returnTo, "success", "PTT transport type permanently deleted.");
}

