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
import { mergeRemarks, replaceGeneratedRemarks } from "@/lib/ptc-checks";

import { createRecordSchema, updateRecordSchema, progressSchema, createPttRecordSchema, updatePttRecordSchema, passwordSchema, isNextRedirectError, optionalString, nullableString, nullableInt, nullableDecimal, nullableBoolean, nullableLocExemption, nullablePttValidityBasis, nullablePttVehicleCapacityCategory, documentRequirementMode, nullableDate, nullableVersionId, ptcRecordData, buildPtcChecks, persistPtcChecks, calculationRuleData, pttRecordData, buildPttChecks, persistPttChecks, pttTransportCapacityData, pttValidityRuleData, safeReturnTo, masterDataReturnTo, withVersionParam, withToast, redirectWithToast, revalidateReports, revalidatePttApplications, calculationConfigFromFormData } from "./_shared";

export async function createRecordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createRecordSchema.safeParse({
    applicantName: formData.get("applicantName") || undefined,
    versionId: formData.get("versionId") || undefined,
    applicationTypeId: formData.get("applicationTypeId") || undefined,
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });
  if (!parsed.success) redirectWithToast("/ptc/applications/new", "error", "Could not read the application form.");
  const input = parsed.data;
  const versionId = nullableVersionId(formData.get("versionId"));
  const applicationTypeId = versionId ? input.applicationTypeId || null : null;

  if (!versionId && (input.applicationTypeId || input.documentIds.length > 0)) {
    redirectWithToast("/ptc/applications/new", "error", "Assign a Version before choosing a type of application or documents.");
  }
  if (!applicationTypeId && input.documentIds.length > 0) {
    redirectWithToast("/ptc/applications/new", "error", "Choose a type of application before selecting documents.");
  }

  let recordId = "";
  try {
    const version = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC, active: true } }) : null;
    if (versionId && !version) redirectWithToast("/ptc/applications/new", "error", "Selected Version was not found.");

    const applicationType = applicationTypeId
      ? await prisma.applicationType.findFirst({ where: { id: applicationTypeId, group: PERMIT_GROUP_PTC, versionId: versionId!, active: true } })
      : null;
    if (applicationTypeId && !applicationType) redirectWithToast("/ptc/applications/new", "error", "Selected type of application does not belong to the selected Version.");

    const allowedDocuments = applicationTypeId
      ? await prisma.requiredDocument.findMany({
          where: { applicationTypeId, id: { in: input.documentIds }, active: true, applicationType: { group: PERMIT_GROUP_PTC, versionId: versionId! } }
        })
      : [];
    const allowedDocumentIds = new Set(allowedDocuments.map((document) => document.id));
    const invalidDocumentIds = input.documentIds.filter((documentId) => !allowedDocumentIds.has(documentId));
    if (invalidDocumentIds.length > 0) redirectWithToast("/ptc/applications/new", "error", "One or more submitted files do not belong to the selected Version.");
  const checkResult = await buildPtcChecks(formData, user, versionId, applicationTypeId);
  if ("error" in checkResult) redirectWithToast("/ptc/applications/new", "error", checkResult.error || "Could not calculate the requested PTC check.");
  const remarks = mergeRemarks(input.remarks, checkResult.checks.map((check) => check.findingMessage));

  const record = await prisma.$transaction(async (tx) => {
      const created = await tx.applicationRecord.create({
        data: {
          group: PERMIT_GROUP_PTC,
          versionId,
          applicantName: input.applicantName || null,
          applicationTypeId,
          remarks: remarks || null,
          ...ptcRecordData(formData),
          ...checkResult.data,
          createdById: user.id
        }
      });

      if (allowedDocuments.length > 0 || input.remarks) {
        const entry = await tx.progressEntry.create({
          data: { applicationRecordId: created.id, userId: user.id, remarks: input.remarks }
        });
        if (allowedDocuments.length > 0) {
          await tx.progressDocument.createMany({
            data: allowedDocuments.map((doc) => ({
              progressEntryId: entry.id,
              applicationRecordId: created.id,
              requiredDocumentId: doc.id
            })),
            skipDuplicates: true
          });
        }
      }

      await tx.activityLog.create({
        data: { userId: user.id, action: "CREATE_RECORD", targetType: "application_record", targetId: created.id, metadata: { versionId, appliedChecks: checkResult.checks.map((check) => check.checkType) } }
      });

      await persistPtcChecks(tx, created.id, user.id, checkResult.checks);

      return created;
    });
    recordId = record.id;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/ptc/applications/new", "error", "Could not create the application record.");
  }

  revalidateReports();
  const nextApplicationPath = versionId ? `/ptc/applications/new?version=${encodeURIComponent(versionId)}` : "/ptc/applications/new";
  redirectWithToast(nextApplicationPath, "success", "Application created. Ready for a new record.");
}

export async function appendProgressAction(formData: FormData) {
  const user = await requireUser();
  const input = progressSchema.parse({
    applicationRecordId: formData.get("applicationRecordId"),
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });

  const record = await prisma.applicationRecord.findUnique({
    where: { id: input.applicationRecordId },
    include: { progressDocuments: true }
  });
  if (!record) redirectWithToast("/ptc/applications", "error", "Application record was not found.");
  if (!record.versionId) redirectWithToast(`/ptc/applications/${input.applicationRecordId}`, "error", "Assign a Version before adding progress documents.");
  if (!record.applicationTypeId) redirectWithToast(`/ptc/applications/${input.applicationRecordId}`, "error", "Choose a type of application before adding progress documents.");

  const existing = new Set(record.progressDocuments.map((doc) => doc.requiredDocumentId));
  const allowedDocuments = await prisma.requiredDocument.findMany({
    where: {
      applicationTypeId: record.applicationTypeId,
      id: { in: input.documentIds },
      active: true,
      applicationType: { versionId: record.versionId!, group: PERMIT_GROUP_PTC }
    }
  });
  const newDocumentIds = allowedDocuments.map((doc) => doc.id).filter((id) => !existing.has(id));

  await prisma.$transaction(async (tx) => {
    const entry = await tx.progressEntry.create({
      data: {
        applicationRecordId: input.applicationRecordId,
        userId: user.id,
        remarks: input.remarks
      }
    });

    if (newDocumentIds.length > 0) {
      await tx.progressDocument.createMany({
        data: newDocumentIds.map((requiredDocumentId) => ({
          progressEntryId: entry.id,
          applicationRecordId: input.applicationRecordId,
          requiredDocumentId
        })),
        skipDuplicates: true
      });
    }

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "APPEND_PROGRESS",
        targetType: "application_record",
        targetId: input.applicationRecordId,
        metadata: { documentCount: newDocumentIds.length, ignoredDuplicateCount: input.documentIds.length - newDocumentIds.length }
      }
    });
  });

  revalidateReports();
  revalidatePath(`/ptc/applications/${input.applicationRecordId}`);
  redirectWithToast(`/ptc/applications/${input.applicationRecordId}`, "success", "Progress saved.");
}

export async function updateApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/ptc/applications");
  const parsed = updateRecordSchema.safeParse({
    id: formData.get("id"),
    applicantName: formData.get("applicantName") || undefined,
    versionId: formData.get("versionId") || undefined,
    applicationTypeId: formData.get("applicationTypeId") || undefined,
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String),
    returnTo
  });
  if (!parsed.success) redirectWithToast(returnTo, "error", "Could not read the application form.");
  const input = parsed.data;
  const versionId = nullableVersionId(formData.get("versionId"));
  const applicationTypeId = versionId ? input.applicationTypeId || null : null;

  const current = await prisma.applicationRecord.findUnique({
    where: { id: input.id },
    include: { checkFindings: { where: { active: true }, select: { message: true } } }
  });
  if (!current) redirectWithToast("/ptc/applications", "error", "Application record was not found.");
  if (!versionId && (input.applicationTypeId || input.documentIds.length > 0)) {
    redirectWithToast(returnTo, "error", "Assign a Version before choosing a type of application or submitted documents.");
  }
  if (!applicationTypeId && input.documentIds.length > 0) {
    redirectWithToast(returnTo, "error", "Choose a type of application before selecting documents.");
  }

  const requestedDocumentIds = [...new Set(input.documentIds)];
  const version = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC, active: true } }) : null;
  if (versionId && !version) redirectWithToast(returnTo, "error", "Selected Version was not found.");
  const applicationType = applicationTypeId
    ? await prisma.applicationType.findFirst({ where: { id: applicationTypeId, group: PERMIT_GROUP_PTC, versionId: versionId!, active: true } })
    : null;
  if (applicationTypeId && !applicationType) redirectWithToast(returnTo, "error", "Selected type of application does not belong to the selected Version.");

  const allowedDocuments = applicationTypeId
    ? await prisma.requiredDocument.findMany({
        where: {
          applicationTypeId,
          id: { in: requestedDocumentIds },
          active: true,
          applicationType: { group: PERMIT_GROUP_PTC, versionId: versionId! }
        },
        orderBy: { sortOrder: "asc" }
      })
    : [];
  const allowedDocumentIds = new Set(allowedDocuments.map((document) => document.id));
  const invalidDocumentIds = requestedDocumentIds.filter((documentId) => !allowedDocumentIds.has(documentId));
  if (invalidDocumentIds.length > 0) {
    redirectWithToast(returnTo, "error", "One or more submitted files do not belong to the selected Version.");
  }
  const checkResult = await buildPtcChecks(formData, user, versionId, applicationTypeId);
  if ("error" in checkResult) redirectWithToast(returnTo, "error", checkResult.error || "Could not calculate the requested PTC check.");
  const remarks = replaceGeneratedRemarks(
    input.remarks,
    current.checkFindings.map((finding) => finding.message),
    checkResult.checks.map((check) => check.findingMessage)
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.progressEntry.deleteMany({ where: { applicationRecordId: input.id } });

      await tx.applicationRecord.update({
        where: { id: input.id },
        data: {
          versionId,
          applicantName: input.applicantName || null,
          applicationTypeId,
          remarks: remarks || null,
          ...ptcRecordData(formData),
          ...checkResult.data,
          editedById: user.id
        }
      });

      const entry = await tx.progressEntry.create({
        data: {
          applicationRecordId: input.id,
          userId: user.id,
          remarks: "Submitted files replaced from edit modal"
        }
      });

      if (allowedDocuments.length > 0) {
        await tx.progressDocument.createMany({
          data: allowedDocuments.map((document) => ({
            progressEntryId: entry.id,
            applicationRecordId: input.id,
            requiredDocumentId: document.id
          }))
        });
      }

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_RECORD",
          targetType: "application_record",
          targetId: input.id,
          metadata: {
            versionChanged: current.versionId !== versionId,
            applicationTypeChanged: current.applicationTypeId !== applicationTypeId,
            submittedDocumentCount: allowedDocuments.length,
            appliedChecks: checkResult.checks.map((check) => check.checkType),
            source: "EDIT_MODAL"
          }
        }
      });

      await persistPtcChecks(tx, input.id, user.id, checkResult.checks);
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not update the application record.");
  }

  revalidateReports();
  revalidatePath(`/ptc/applications/${input.id}`);
  redirectWithToast(returnTo, "success", "Application updated.");
}

export async function deleteApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/ptc/applications", "error", "Application record id is required.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.delete({ where: { id } });
      await tx.activityLog.create({
        data: { userId: user.id, action: "DELETE_RECORD", targetType: "application_record", targetId: id }
      });
    });
  } catch {
    redirectWithToast("/ptc/applications", "error", "Could not delete the application record.");
  }

  revalidateReports();
  redirectWithToast("/ptc/applications", "success", "Application deleted.");
}

export async function bulkDeleteApplicationRecordsAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = [...new Set(formData.getAll("applicationRecordIds").map(String).filter(Boolean))];
  if (ids.length === 0) redirectWithToast("/ptc/applications", "error", "Select at least one application to delete.");

  const records = await prisma.applicationRecord.findMany({
    where: { id: { in: ids }, group: PERMIT_GROUP_PTC },
    select: { id: true }
  });
  if (records.length !== ids.length) {
    redirectWithToast("/ptc/applications", "error", "Some selected applications were already deleted or are not PTC records.");
  }

  const recordIds = records.map((record) => record.id);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.deleteMany({ where: { id: { in: recordIds }, group: PERMIT_GROUP_PTC } });
      await tx.activityLog.create({
        data: {
          userId: admin.id,
          action: "BULK_DELETE_RECORDS",
          targetType: "application_record",
          metadata: { deletedCount: recordIds.length, recordIds }
        }
      });
    });
  } catch {
    redirectWithToast("/ptc/applications", "error", "Could not delete the selected applications.");
  }

  revalidateReports();
  redirectWithToast("/ptc/applications", "success", `Deleted ${recordIds.length} application${recordIds.length === 1 ? "" : "s"}.`);
}

export async function bulkAssignApplicationVersionAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = [...new Set(formData.getAll("applicationRecordIds").map(String).filter(Boolean))];
  const targetVersionId = nullableVersionId(formData.get("versionId"));
  const confirmReset = formData.get("confirmReset") === "on";
  if (ids.length === 0) redirectWithToast("/ptc/applications", "error", "Select at least one application to assign a Version.");

  const targetVersion = targetVersionId
    ? await prisma.ptcVersion.findFirst({ where: { id: targetVersionId, group: PERMIT_GROUP_PTC, active: true } })
    : null;
  if (targetVersionId && !targetVersion) redirectWithToast("/ptc/applications", "error", "Selected Version was not found or is archived.");

  const records = await prisma.applicationRecord.findMany({
    where: { id: { in: ids }, group: PERMIT_GROUP_PTC },
    include: { applicationType: { include: { documents: { where: { active: true } } } }, progressDocuments: true }
  });
  if (records.length !== ids.length) {
    redirectWithToast("/ptc/applications", "error", "Some selected applications were already deleted or are not PTC records.");
  }

  const compatibleTypeIds = targetVersionId
    ? new Set((await prisma.applicationType.findMany({ where: { group: PERMIT_GROUP_PTC, versionId: targetVersionId, active: true }, select: { id: true } })).map((type) => type.id))
    : new Set<string>();

  const resetDecisions = records.map((record) => {
    const compatibleType = !!targetVersionId && !!record.applicationTypeId && compatibleTypeIds.has(record.applicationTypeId);
    const allowedDocumentIds = new Set(compatibleType ? record.applicationType?.documents.map((document) => document.id) || [] : []);
    const hasInvalidDocuments = record.progressDocuments.some((document) => !allowedDocumentIds.has(document.requiredDocumentId));
    return {
      record,
      compatible: compatibleType && !hasInvalidDocuments,
      shouldReset: !compatibleType || hasInvalidDocuments
    };
  });
  const resetCount = resetDecisions.filter((decision) => decision.shouldReset).length;
  if (resetCount > 0 && !confirmReset) {
    redirectWithToast("/ptc/applications", "error", `Confirm the reset warning before assigning Version. ${resetCount} selected record${resetCount === 1 ? "" : "s"} will reset Type/Documents.`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const decision of resetDecisions) {
        const { record, shouldReset } = decision;

        if (shouldReset) {
          await tx.progressEntry.deleteMany({ where: { applicationRecordId: record.id } });
        }

        await tx.applicationRecord.update({
          where: { id: record.id },
          data: {
            versionId: targetVersionId,
            applicationTypeId: shouldReset ? null : record.applicationTypeId,
            editedById: admin.id
          }
        });

        await tx.activityLog.create({
          data: {
            userId: admin.id,
            action: "ASSIGN_VERSION",
            targetType: "application_record",
            targetId: record.id,
            metadata: {
              previousVersionId: record.versionId,
              newVersionId: targetVersionId,
              resetTypeAndDocuments: shouldReset,
              clearedDocumentCount: shouldReset ? record.progressDocuments.length : 0
            }
          }
        });
      }
    });
  } catch {
    redirectWithToast("/ptc/applications", "error", "Could not assign the selected Version.");
  }

  revalidateReports();
  redirectWithToast("/ptc/applications", "success", `Assigned Version to ${records.length} application${records.length === 1 ? "" : "s"}. Reset ${resetCount} incompatible record${resetCount === 1 ? "" : "s"}.`);
}

export async function deleteAllApplicationRecordsAction(formData: FormData) {
  const admin = await requireAdmin();
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (confirmation !== "DELETE ALL PTC") {
    redirectWithToast("/ptc/applications", "error", "Type DELETE ALL PTC to confirm deleting all applications.");
  }

  let deletedCount = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.applicationRecord.deleteMany({ where: { group: PERMIT_GROUP_PTC } });
      deletedCount = result.count;
      await tx.activityLog.create({
        data: {
          userId: admin.id,
          action: "DELETE_ALL_RECORDS",
          targetType: "application_record",
          metadata: { deletedCount, group: PERMIT_GROUP_PTC }
        }
      });
    });
  } catch {
    redirectWithToast("/ptc/applications", "error", "Could not delete all applications.");
  }

  revalidateReports();
  redirectWithToast("/ptc/applications", "success", `Deleted all PTC applications (${deletedCount} record${deletedCount === 1 ? "" : "s"}).`);
}
