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

export async function createPttApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createPttRecordSchema.safeParse({
    transporterName: formData.get("transporterName") || undefined,
    versionId: formData.get("versionId") || undefined,
    remarks: formData.get("remarks") || undefined
  });
  if (!parsed.success) redirectWithToast("/ptt/applications/new", "error", "Could not read the PTT application form.");

  const versionId = nullableVersionId(formData.get("versionId"));
  let recordId = "";

  try {
    const version = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT, active: true } }) : null;
    if (versionId && !version) redirectWithToast("/ptt/applications/new", "error", "Selected PTT Version was not found.");

    const pttData = pttRecordData(formData);
    const checkResult = await buildPttChecks(formData, user, versionId);
    if (checkResult.error) redirectWithToast("/ptt/applications/new", "error", checkResult.error);

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.pttApplicationRecord.create({
        data: {
          group: PERMIT_GROUP_PTT,
          versionId,
          ...pttData,
          ...checkResult.data,
          createdById: user.id
        }
      });
      await persistPttChecks(tx, created.id, user.id, checkResult.checks ?? []);
      await tx.activityLog.create({
        data: { userId: user.id, action: "CREATE_PTT_RECORD", targetType: "ptt_application_record", targetId: created.id, metadata: { versionId } }
      });
      return created;
    });
    recordId = record.id;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/ptt/applications/new", "error", "Could not create the PTT application record.");
  }

  revalidatePttApplications();
  redirectWithToast(`/ptt/applications/${recordId}`, "success", "PTT application created.");
}

export async function updatePttApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/ptt/applications");
  const parsed = updatePttRecordSchema.safeParse({
    id: formData.get("id"),
    transporterName: formData.get("transporterName") || undefined,
    versionId: formData.get("versionId") || undefined,
    remarks: formData.get("remarks") || undefined,
    returnTo
  });
  if (!parsed.success) redirectWithToast(returnTo, "error", "Could not read the PTT application form.");

  const input = parsed.data;
  const versionId = nullableVersionId(formData.get("versionId"));
  const current = await prisma.pttApplicationRecord.findUnique({ where: { id: input.id } });
  if (!current) redirectWithToast("/ptt/applications", "error", "PTT application record was not found.");

  try {
    const version = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT, active: true } }) : null;
    if (versionId && !version) redirectWithToast(returnTo, "error", "Selected PTT Version was not found.");

    const pttData = pttRecordData(formData);
    const checkResult = await buildPttChecks(formData, user, versionId);
    if (checkResult.error) redirectWithToast(returnTo, "error", checkResult.error);

    await prisma.$transaction(async (tx) => {
      await tx.pttApplicationRecord.update({
        where: { id: input.id },
        data: {
          versionId,
          ...pttData,
          ...checkResult.data,
          editedById: user.id
        }
      });
      await persistPttChecks(tx, input.id, user.id, checkResult.checks ?? []);
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_PTT_RECORD",
          targetType: "ptt_application_record",
          targetId: input.id,
          metadata: { versionChanged: current.versionId !== versionId }
        }
      });
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not update the PTT application record.");
  }

  revalidatePttApplications();
  revalidatePath(`/ptt/applications/${input.id}`);
  redirectWithToast(returnTo, "success", "PTT application updated.");
}

export async function deletePttApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/ptt/applications", "error", "PTT application record id is required.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pttApplicationRecord.delete({ where: { id } });
      await tx.activityLog.create({
        data: { userId: user.id, action: "DELETE_PTT_RECORD", targetType: "ptt_application_record", targetId: id }
      });
    });
  } catch {
    redirectWithToast("/ptt/applications", "error", "Could not delete the PTT application record.");
  }

  revalidatePttApplications();
  redirectWithToast("/ptt/applications", "success", "PTT application deleted.");
}
