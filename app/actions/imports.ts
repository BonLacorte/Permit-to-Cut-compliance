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

export async function importPtcRecordsAction(formData: FormData) {
  const user = await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=imports");
  const file = formData.get("file");
  const selectedVersionId = nullableVersionId(formData.get("versionId"));
  if (!(file instanceof File)) redirectWithToast(returnTo, "error", "Upload a PTC Excel file.");

  const selectedVersion = selectedVersionId
    ? await prisma.ptcVersion.findFirst({ where: { id: selectedVersionId, group: PERMIT_GROUP_PTC, active: true } })
    : null;
  if (selectedVersionId && !selectedVersion) redirectWithToast(returnTo, "error", "Selected import Version was not found or is archived.");

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = checkPtcImportWorkbook(buffer, await ptcImportCheckContext(selectedVersionId));
    if (preview.errorCount > 0) {
      redirectWithToast(returnTo, "error", `Import checker found ${preview.errorCount} blocking error${preview.errorCount === 1 ? "" : "s"}. Fix the Excel file and check it again.`);
    }
    parsed = parsePtcRecordsWorkbook(buffer);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not read the PTC Excel file.");
  }

  if (parsed.length === 0) redirectWithToast(returnTo, "error", "No PTC rows were found to import.");

  const typeMap = new Map<string, string>();
  if (selectedVersionId) {
    const types = await prisma.applicationType.findMany({
      where: { group: PERMIT_GROUP_PTC, versionId: selectedVersionId, active: true },
      select: { id: true, name: true }
    });
    for (const type of types) typeMap.set(type.name.trim().toLowerCase(), type.id);
  }

  let unmatchedTypeCount = 0;
  const data = parsed.map((record) => {
    const rawTypeName = String(record.applicationTypeName || "").trim();
    const matchedApplicationTypeId = selectedVersionId && rawTypeName ? typeMap.get(rawTypeName.toLowerCase()) || null : null;
    if (selectedVersionId && rawTypeName && !matchedApplicationTypeId) unmatchedTypeCount += 1;

    return {
      group: PERMIT_GROUP_PTC,
      versionId: selectedVersionId,
      createdById: user.id,
      applicantName: record.applicantName || null,
      applicationTypeId: matchedApplicationTypeId,
      regionalOffice: record.regionalOffice || null,
      provincialOffice: record.provincialOffice || null,
      ptcNumber: record.ptcNumber || null,
      dateIssued: record.dateIssued || null,
      barangay: record.barangay || null,
      municipality: record.municipality || null,
      treesApplied: record.treesApplied ?? null,
      treesApproved: record.treesApproved ?? null,
      seedlingsReplacement: record.seedlingsReplacement ?? null,
      locExemption: record.locExemption ?? null
    };
  });

  try {
    await prisma.applicationRecord.createMany({ data });
  } catch {
    redirectWithToast(returnTo, "error", "Could not import the PTC records.");
  }

  revalidateReports();
  const assignedCount = selectedVersionId ? parsed.length : 0;
  const uncategorizedCount = selectedVersionId ? 0 : parsed.length;
  redirectWithToast(
    withVersionParam(returnTo, selectedVersionId || UNCATEGORIZED_VERSION),
    "success",
    `Imported ${parsed.length} PTC record${parsed.length === 1 ? "" : "s"}. Assigned: ${assignedCount}. Unmatched types: ${unmatchedTypeCount}. Uncategorized: ${uncategorizedCount}.`
  );
}

export async function importPttRecordsAction(formData: FormData) {
  const user = await requireAdmin();
  const returnTo = masterDataReturnTo(formData, "/admin/master-data?tab=imports");
  const file = formData.get("file");
  const selectedVersionId = nullableVersionId(formData.get("versionId"));
  if (!(file instanceof File)) redirectWithToast(returnTo, "error", "Upload a PTT Excel file.");
  if (!selectedVersionId) redirectWithToast(returnTo, "error", "Choose a PTT Version before importing PTT records.");

  const selectedVersion = await prisma.ptcVersion.findFirst({
    where: { id: selectedVersionId, group: PERMIT_GROUP_PTT, active: true }
  });
  if (!selectedVersion) redirectWithToast(returnTo, "error", "Selected PTT Version was not found or is archived.");

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = checkPttImportWorkbook(buffer, await pttImportCheckContext(selectedVersionId));
    if (preview.errorCount > 0) {
      redirectWithToast(returnTo, "error", `Import checker found ${preview.errorCount} blocking error${preview.errorCount === 1 ? "" : "s"}. Fix the Excel file and check it again.`);
    }
    parsed = parsePttRecordsWorkbook(buffer);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast(returnTo, "error", "Could not read the PTT Excel file.");
  }

  if (parsed.length === 0) redirectWithToast(returnTo, "error", "No PTT rows were found to import.");

  const data = parsed.map((record) => ({
    group: PERMIT_GROUP_PTT,
    versionId: selectedVersionId,
    createdById: user.id,
    regionalOffice: record.regionalOffice || null,
    provincialOffice: record.provincialOffice || null,
    pttNumber: record.pttNumber || null,
    dateIssued: record.dateIssued || null,
    transporterName: record.transporterName || null,
    transporterAddress: record.transporterAddress || null,
    ptcNumber: record.ptcNumber || null,
    pcaRegistrationCertificateNumber: record.pcaRegistrationCertificateNumber || null,
    pcaRegistrationCertificateDate: record.pcaRegistrationCertificateDate || null,
    businessAddress: record.businessAddress || null,
    boardFeetGranted: record.boardFeetGranted ?? null,
    certificateOfQuantityVolumeAttached: record.certificateOfQuantityVolumeAttached ?? null,
    volumeBoardFeet: record.volumeBoardFeet ?? null,
    originOfLumber: record.originOfLumber || null,
    destination: record.destination || null,
    consigneeName: record.consigneeName || null,
    consigneePcaRegistration: record.consigneePcaRegistration || null,
    transportType: record.transportType || null,
    vehiclePlateNumber: record.vehiclePlateNumber || null,
    authorizedDriverName: record.authorizedDriverName || null,
    authorizedDriverContact: record.authorizedDriverContact || null,
    amountPaid: record.amountPaid ?? null,
    actualFee: record.actualFee ?? null,
    officialReceiptNumber: record.officialReceiptNumber || null,
    recordedValidityDays: record.recordedValidityDays ?? null,
    actualValidityDays: record.actualValidityDays ?? null,
    validityBasis: record.validityBasis ?? null,
    dateValidatedInspected: record.dateValidatedInspected || null,
    validatedInspectedBy: record.validatedInspectedBy || null,
    issuedByDate: record.issuedByDate || null,
    issuedBy: record.issuedBy || null,
    remarks: record.remarks || null
  }));

  try {
    await prisma.pttApplicationRecord.createMany({ data });
  } catch {
    redirectWithToast(returnTo, "error", "Could not import the PTT records.");
  }

  revalidatePttApplications();
  redirectWithToast(
    returnTo,
    "success",
    "Imported " + parsed.length + " PTT record" + (parsed.length === 1 ? "" : "s") + " into " + selectedVersion.name + ". Duplicate PTT Numbers are allowed and will be flagged in the PTT table."
  );
}

export async function importMasterDataAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Upload an Excel file.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseGroundsWorkbook(buffer);
  const selectedVersionId = nullableVersionId(formData.get("versionId"));
  const fallbackVersion = selectedVersionId ? null : await prisma.ptcVersion.findFirst({ where: { group: PERMIT_GROUP_PTC, active: true }, orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }] });
  const versionId = selectedVersionId || fallbackVersion?.id;
  if (!versionId) throw new Error("Create a Version before importing master data.");

  await prisma.$transaction(async (tx) => {
    for (const app of parsed) {
      const applicationType = await tx.applicationType.upsert({
        where: { versionId_name: { versionId, name: app.name } },
        update: { active: true, sortOrder: app.sortOrder },
        create: { group: PERMIT_GROUP_PTC, versionId, name: app.name, sortOrder: app.sortOrder }
      });

      for (const doc of app.documents) {
        await tx.requiredDocument.upsert({
          where: { applicationTypeId_name: { applicationTypeId: applicationType.id, name: doc.name } },
          update: { active: true, sortOrder: doc.sortOrder },
          create: { applicationTypeId: applicationType.id, name: doc.name, sortOrder: doc.sortOrder }
        });
      }
    }
  });

  revalidatePath("/admin/master-data");
  revalidatePath("/ptc/applications/new");
}
