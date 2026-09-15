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

export async function savePtcCalculationRuleAction(formData: FormData) {
  const superadmin = await requireSuperadmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const versionId = String(formData.get("versionId") || "");
  const applicationTypeId = nullableString(formData.get("applicationTypeId"));
  if (!versionId) redirectWithToast(returnTo, "error", "Choose a PTC Version before saving calculation rules.");
  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC } });
    if (!version) redirectWithToast(returnTo, "error", "PTC Version was not found.");
    if (applicationTypeId) {
      const applicationType = await prisma.applicationType.findFirst({ where: { id: applicationTypeId, versionId, group: PERMIT_GROUP_PTC } });
      if (!applicationType) redirectWithToast(returnTo, "error", "The selected Type of Application does not belong to this Version.");
    }
    const config = calculationConfigFromFormData(formData);
    const data = { ...config };
    if (applicationTypeId) {
      await prisma.ptcCalculationRule.upsert({
        where: { versionId_applicationTypeId: { versionId, applicationTypeId } },
        update: data,
        create: { versionId, applicationTypeId, ...data }
      });
    } else {
      const existing = await prisma.ptcCalculationRule.findFirst({ where: { versionId, applicationTypeId: null } });
      if (existing) await prisma.ptcCalculationRule.update({ where: { id: existing.id }, data });
      else await prisma.ptcCalculationRule.create({ data: { versionId, ...data } });
    }
    await prisma.activityLog.create({
      data: { userId: superadmin.id, action: "SAVE_PTC_CALCULATION_RULE", targetType: "ptc_calculation_rule", metadata: { versionId, applicationTypeId: applicationTypeId || null } }
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", error instanceof Error ? error.message : "Could not save PTC calculation rules.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(withVersionParam(returnTo, versionId), "success", applicationTypeId ? "Type of Application calculation override saved." : "Version calculation rules saved.");
}
export async function resetPtcApplicationTypeRuleAction(formData: FormData) {
  const superadmin = await requireSuperadmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const versionId = String(formData.get("versionId") || "");
  const applicationTypeId = String(formData.get("applicationTypeId") || "");
  if (!versionId || !applicationTypeId) redirectWithToast(returnTo, "error", "Version and Type of Application are required.");
  await prisma.ptcCalculationRule.deleteMany({ where: { versionId, applicationTypeId } });
  await prisma.activityLog.create({
    data: { userId: superadmin.id, action: "RESET_PTC_CALCULATION_RULE_OVERRIDE", targetType: "ptc_calculation_rule", metadata: { versionId, applicationTypeId } }
  });
  revalidatePath("/admin/master-data");
  redirectWithToast(withVersionParam(returnTo, versionId), "success", "Type of Application now inherits the Version calculation rules.");
}

export async function createPtcVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!name) redirectWithToast(returnTo, "error", "Version name is required.");

  try {
    const count = await prisma.ptcVersion.count({ where: { group: PERMIT_GROUP_PTC } });
    const version = await prisma.ptcVersion.upsert({
      where: { group_name: { group: PERMIT_GROUP_PTC, name } },
      update: { active: true, description },
      create: { group: PERMIT_GROUP_PTC, name, description, sortOrder: count + 1 }
    });
    const existingRule = await prisma.ptcCalculationRule.findFirst({ where: { versionId: version.id, applicationTypeId: null } });
    if (!existingRule) await prisma.ptcCalculationRule.create({ data: { versionId: version.id, ...defaultRuleData() } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not create the Version. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Version created.");
}

export async function clonePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const sourceVersionId = String(formData.get("sourceVersionId") || "");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!sourceVersionId || !name) redirectWithToast(returnTo, "error", "Source Version and new Version name are required.");

  let createdVersionId = "";
  try {
    const source = await prisma.ptcVersion.findFirst({
      where: { id: sourceVersionId, group: PERMIT_GROUP_PTC },
      include: {
        calculationRules: true,
        applicationTypes: {
          where: { active: true },
          include: { documents: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      }
    });
    if (!source) redirectWithToast(returnTo, "error", "Source Version was not found.");
    const existing = await prisma.ptcVersion.findUnique({ where: { group_name: { group: PERMIT_GROUP_PTC, name } } });
    if (existing) redirectWithToast(returnTo, "error", "A Version with that name already exists.");
    const count = await prisma.ptcVersion.count({ where: { group: PERMIT_GROUP_PTC } });

    const created = await prisma.ptcVersion.create({
      data: { group: PERMIT_GROUP_PTC, name, description, active: true, sortOrder: count + 1 }
    });
    createdVersionId = created.id;
    const sourceDefaultRule = source.calculationRules.find((rule) => rule.applicationTypeId === null);
    await prisma.ptcCalculationRule.create({
      data: sourceDefaultRule
        ? { versionId: created.id, ...calculationRuleData(sourceDefaultRule) }
        : { versionId: created.id, ...defaultRuleData() }
    });

    for (const type of source.applicationTypes) {
      const clonedType = await prisma.applicationType.create({
        data: {
          group: PERMIT_GROUP_PTC,
          versionId: created.id,
          name: type.name,
          active: true,
          sortOrder: type.sortOrder
        }
      });

      const sourceOverride = source.calculationRules.find((rule) => rule.applicationTypeId === type.id);
      if (sourceOverride) {
        await prisma.ptcCalculationRule.create({
          data: { versionId: created.id, applicationTypeId: clonedType.id, ...calculationRuleData(sourceOverride) }
        });
      }

      if (type.documents.length > 0) {
        await prisma.requiredDocument.createMany({
          data: type.documents.map((document) => ({
            applicationTypeId: clonedType.id,
            name: document.name,
            active: true,
            requirementMode: document.requirementMode,
            sortOrder: document.sortOrder
          }))
        });
      }
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Clone PTC Version failed", error);
    if (createdVersionId) {
      try {
        await prisma.requiredDocument.deleteMany({ where: { applicationType: { versionId: createdVersionId } } });
        await prisma.applicationType.deleteMany({ where: { versionId: createdVersionId } });
        await prisma.ptcVersion.delete({ where: { id: createdVersionId } });
      } catch (cleanupError) {
        console.error("Clone PTC Version cleanup failed", cleanupError);
      }
    }
    redirectWithToast(returnTo, "error", "Could not clone the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(withVersionParam(returnTo, createdVersionId), "success", `Version cloned as ${name}.`);
}

export async function updatePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!id || !name) redirectWithToast(returnTo, "error", "Version name is required.");

  try {
    await prisma.ptcVersion.update({ where: { id }, data: { name, description, active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not update the Version. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(withVersionParam(returnTo, id), "success", "Version updated.");
}

export async function deletePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTC } });
    if (!version) redirectWithToast(returnTo, "error", "Version was not found.");

    await prisma.$transaction(async (tx) => {
      await tx.requiredDocument.updateMany({
        where: { applicationType: { is: { versionId: id, group: PERMIT_GROUP_PTC } } },
        data: { active: false }
      });
      await tx.applicationType.updateMany({ where: { versionId: id, group: PERMIT_GROUP_PTC }, data: { active: false } });
      await tx.ptcVersion.update({ where: { id }, data: { active: false } });
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not deactivate the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Version deactivated.");
}


export async function createApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const versionId = String(formData.get("versionId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!versionId || !name) redirectWithToast(returnTo, "error", "Version and application type name are required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC, active: true } });
    if (!version) redirectWithToast(returnTo, "error", "Selected Version was not found.");
    const count = await prisma.applicationType.count({ where: { group: PERMIT_GROUP_PTC, versionId } });
    await prisma.applicationType.upsert({
      where: { versionId_name: { versionId, name } },
      update: { active: true },
      create: { group: PERMIT_GROUP_PTC, versionId, name, sortOrder: count + 1 }
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not add the application type. It may already exist in this Version.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(withVersionParam(returnTo, versionId), "success", "Application type added.");
}

export async function createRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const applicationTypeId = String(formData.get("applicationTypeId") || "");
  const name = String(formData.get("name") || "").trim();
  const requirementMode = documentRequirementMode(formData.get("requirementMode"));
  if (!applicationTypeId || !name) redirectWithToast(returnTo, "error", "Application type and document name are required.");

  try {
    const applicationType = await prisma.applicationType.findFirst({ where: { id: applicationTypeId, group: PERMIT_GROUP_PTC } });
    if (!applicationType) redirectWithToast(returnTo, "error", "Application type was not found.");
    const count = await prisma.requiredDocument.count({ where: { applicationTypeId } });
    await prisma.requiredDocument.upsert({ where: { applicationTypeId_name: { applicationTypeId, name } }, update: { active: true, requirementMode }, create: { applicationTypeId, name, requirementMode, sortOrder: count + 1 } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not add the required document. It may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Required document added.");
}

export async function updateApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) redirectWithToast(returnTo, "error", "Application type name is required.");

  try {
    await prisma.applicationType.update({ where: { id }, data: { name, active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not update the application type. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Application type updated.");
}

export async function deleteApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Application type id is required.");

  try {
    await prisma.applicationType.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not delete the application type.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Application type deleted.");
}

export async function updateRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const requirementMode = documentRequirementMode(formData.get("requirementMode"));
  if (!id || !name) redirectWithToast(returnTo, "error", "Document name is required.");

  try {
    await prisma.requiredDocument.update({ where: { id }, data: { name, requirementMode, active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not update the required document. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Required document updated.");
}

export async function deleteRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=ptc");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Document id is required.");

  try {
    await prisma.requiredDocument.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not delete the required document.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Required document deleted.");
}


export async function restorePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Version id is required.");

  try {
    await prisma.ptcVersion.update({ where: { id }, data: { active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not restore the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(withVersionParam(returnTo, id), "success", "Version restored.");
}

export async function hardDeletePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Version id is required.");

  try {
    const version = await prisma.ptcVersion.findUnique({
      where: { id },
      include: {
        records: true,
        applicationTypes: { include: { documents: { include: { progressDocuments: true } }, records: true } }
      }
    });
    if (!version) redirectWithToast(returnTo, "error", "Version was not found.");
    if (version.active) redirectWithToast(returnTo, "error", "Deactivate the Version before permanently deleting it.");
    if (version.records.length > 0) redirectWithToast(returnTo, "error", "Cannot permanently delete a Version assigned to application records.");
    if (version.applicationTypes.some((type) => type.records.length > 0 || type.documents.some((doc) => doc.progressDocuments.length > 0))) {
      redirectWithToast(returnTo, "error", "Cannot permanently delete a Version whose application types or documents have history.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.requiredDocument.deleteMany({ where: { applicationType: { versionId: id } } });
      await tx.applicationType.deleteMany({ where: { versionId: id } });
      await tx.ptcVersion.delete({ where: { id } });
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Version and unused copied master data permanently deleted.");
}


export async function restoreApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Application type id is required.");

  try {
    await prisma.applicationType.update({ where: { id }, data: { active: true } });
  } catch {
    redirectWithToast(returnTo, "error", "Could not restore the application type.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Application type restored.");
}

export async function hardDeleteApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Application type id is required.");

  try {
    const applicationType = await prisma.applicationType.findUnique({
      where: { id },
      include: { documents: { include: { progressDocuments: true } }, records: true }
    });
    if (!applicationType) redirectWithToast(returnTo, "error", "Application type was not found.");
    if (applicationType.active) redirectWithToast(returnTo, "error", "Deactivate the application type before permanently deleting it.");
    if (applicationType.records.length > 0) redirectWithToast(returnTo, "error", "Cannot permanently delete an application type that is used by application records.");
    if (applicationType.documents.some((doc) => doc.progressDocuments.length > 0)) {
      redirectWithToast(returnTo, "error", "Cannot permanently delete an application type with document history.");
    }
    await prisma.applicationType.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the application type.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Application type permanently deleted.");
}

export async function restoreRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Document id is required.");

  try {
    const document = await prisma.requiredDocument.findUnique({ where: { id }, include: { applicationType: true } });
    if (!document) redirectWithToast(returnTo, "error", "Required document was not found.");
    if (!document.applicationType.active) redirectWithToast(returnTo, "error", "Restore the application type before restoring this document.");
    await prisma.requiredDocument.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not restore the required document.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Required document restored.");
}

export async function hardDeleteRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=deactivated");
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast(returnTo, "error", "Document id is required.");

  try {
    const document = await prisma.requiredDocument.findUnique({ where: { id }, include: { progressDocuments: true } });
    if (!document) redirectWithToast(returnTo, "error", "Required document was not found.");
    if (document.active) redirectWithToast(returnTo, "error", "Deactivate the required document before permanently deleting it.");
    if (document.progressDocuments.length > 0) redirectWithToast(returnTo, "error", "Cannot permanently delete a required document with application history.");
    await prisma.requiredDocument.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not permanently delete the required document.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
  revalidateReports();
  redirectWithToast(returnTo, "success", "Required document permanently deleted.");
}

