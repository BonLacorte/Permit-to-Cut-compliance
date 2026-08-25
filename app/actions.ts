"use server";

import { ApplicationCheckType, DocumentRequirementMode, FeatureKey, LocExemption, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, requireAdmin, requireSuperadmin, requireUser, setSession, userHasFeature } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { parseGroundsWorkbook, parsePtcRecordsWorkbook, parsePttRecordsWorkbook } from "@/lib/excel";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import { prisma } from "@/lib/prisma";
import { calculatePtcFee, calculatePtcValidity, feeFinding, normalizePtcCalculationConfig, validityFinding } from "@/lib/ptc-checks";
import { defaultRuleData, resolvedPtcCalculationRule } from "@/lib/ptc-calculation-rules";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

const createRecordSchema = z.object({
  applicantName: z.string().trim().optional(),
  versionId: z.string().trim().optional(),
  applicationTypeId: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

const updateRecordSchema = z.object({
  id: z.string().min(1),
  applicantName: z.string().trim().optional(),
  versionId: z.string().trim().optional(),
  applicationTypeId: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([]),
  returnTo: z.string().optional()
});

const progressSchema = z.object({
  applicationRecordId: z.string().min(1),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

const createPttRecordSchema = z.object({
  transporterName: z.string().trim().optional(),
  versionId: z.string().trim().optional(),
  remarks: z.string().trim().optional()
});

const updatePttRecordSchema = createPttRecordSchema.extend({
  id: z.string().min(1),
  returnTo: z.string().optional()
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
  returnTo: z.string().optional()
});


function isNextRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}
function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || undefined;
}

function nullableString(value: FormDataEntryValue | null) {
  return optionalString(value) || null;
}

function nullableInt(value: FormDataEntryValue | null) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nullableDecimal(value: FormDataEntryValue | null) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? text : null;
}

function nullableBoolean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
}
function nullableLocExemption(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "Owner") return LocExemption.Owner;
  if (text === "Others") return LocExemption.Others;
  return null;
}

function documentRequirementMode(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "Optional") return DocumentRequirementMode.Optional;
  if (text === "LocConditional") return DocumentRequirementMode.LocConditional;
  return DocumentRequirementMode.Required;
}

function nullableDate(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nullableVersionId(value: FormDataEntryValue | null): string | null {
  const text = optionalString(value);
  if (!text || text === UNCATEGORIZED_VERSION) return null;
  return text;
}

function ptcRecordData(formData: FormData) {
  return {
    ptcNumber: nullableString(formData.get("ptcNumber")),
    dateIssued: nullableDate(formData.get("dateIssued")),
    regionalOffice: nullableString(formData.get("regionalOffice")),
    provincialOffice: nullableString(formData.get("provincialOffice")),
    municipality: nullableString(formData.get("municipality")),
    barangay: nullableString(formData.get("barangay")),
    treesApplied: nullableInt(formData.get("treesApplied")),
    treesApproved: nullableInt(formData.get("treesApproved")),
    seedlingsReplacement: nullableInt(formData.get("seedlingsReplacement")),
    recordedValidityDays: nullableInt(formData.get("recordedValidityDays")),
    actualValidityDays: nullableInt(formData.get("actualValidityDays")),
    actualFee: nullableDecimal(formData.get("actualFee")),
    recordedFee: nullableDecimal(formData.get("recordedFee")),
    officialReceiptNumber: nullableString(formData.get("officialReceiptNumber")),
    replantedSeedlings: nullableBoolean(formData.get("replantedSeedlings")),
    locExemption: nullableLocExemption(formData.get("locExemption")),
    agriculturist: nullableString(formData.get("agriculturist")),
    recommendingApproval: nullableString(formData.get("recommendingApproval")),
    approved: nullableString(formData.get("approved"))
  };
}

type PendingPtcCheck = {
  checkType: ApplicationCheckType;
  inputSnapshot: Prisma.InputJsonObject;
  ruleSnapshot: Prisma.InputJsonObject;
  outputSnapshot: Prisma.InputJsonObject;
  comparisonSnapshot: Prisma.InputJsonObject;
  findingMessage: string | null;
};

async function buildPtcChecks(formData: FormData, user: { id: string; role: Role }, versionId: string | null, applicationTypeId: string | null) {
  const applyFee = String(formData.get("applyFeeCheck") || "") === "true";
  const applyValidity = String(formData.get("applyValidityCheck") || "") === "true";
  if (!applyFee && !applyValidity) return { checks: [] as PendingPtcCheck[], data: {} };
  if (!versionId || !applicationTypeId) return { error: "Choose a Version and Type of Application before using a checker." };
  if (applyFee && !(await userHasFeature(user, FeatureKey.PTC_FEES_CHECKER))) return { error: "You do not have access to the PTC Fees Checker." };
  if (applyValidity && !(await userHasFeature(user, FeatureKey.PTC_VALIDITY_CHECKER))) return { error: "You do not have access to the PTC Validity Checker." };

  try {
    const { rule, config, usingApplicationTypeOverride } = await resolvedPtcCalculationRule(versionId, applicationTypeId);
    const ruleSnapshot = { id: rule.id, versionId, applicationTypeId, usingApplicationTypeOverride, config };
    const checks: PendingPtcCheck[] = [];
    const data: { actualFee?: number; actualValidityDays?: number } = {};
    const treesApproved = nullableInt(formData.get("treesApproved"));

    if (applyFee) {
      const replantedSeedlings = nullableBoolean(formData.get("replantedSeedlings"));
      const result = calculatePtcFee({ treesApproved, replantedSeedlings, config });
      const recordedFee = nullableDecimal(formData.get("recordedFee"));
      const findingMessage = feeFinding(recordedFee === null ? null : Number(recordedFee), result.actualFee);
      data.actualFee = result.actualFee;
      checks.push({
        checkType: ApplicationCheckType.Fee,
        inputSnapshot: { treesApproved, replantedSeedlings, recordedFee },
        ruleSnapshot,
        outputSnapshot: result,
        comparisonSnapshot: { recordedFee: recordedFee === null ? null : Number(recordedFee), actualFee: result.actualFee, matches: !findingMessage },
        findingMessage
      });
    }

    if (applyValidity) {
      const result = calculatePtcValidity({ treesApproved, config });
      const recordedValidityDays = nullableInt(formData.get("recordedValidityDays"));
      const findingMessage = validityFinding(recordedValidityDays, result);
      data.actualValidityDays = result.actualValidityDays;
      checks.push({
        checkType: ApplicationCheckType.Validity,
        inputSnapshot: { treesApproved, recordedValidityDays },
        ruleSnapshot,
        outputSnapshot: result,
        comparisonSnapshot: {
          recordedValidityDays,
          actualValidityDays: result.actualValidityDays,
          matches: recordedValidityDays === result.actualValidityDays,
          exceedsSinglePtcLimit: result.exceedsSinglePtcLimit
        },
        findingMessage
      });
    }

    return { checks, data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not calculate the requested PTC check." };
  }
}

async function persistPtcChecks(tx: Prisma.TransactionClient, applicationRecordId: string, userId: string, checks: PendingPtcCheck[]) {
  for (const check of checks) {
    await tx.applicationCheckRun.create({
      data: {
        applicationRecordId,
        checkType: check.checkType,
        appliedById: userId,
        inputSnapshot: check.inputSnapshot,
        ruleSnapshot: check.ruleSnapshot,
        outputSnapshot: check.outputSnapshot,
        comparisonSnapshot: check.comparisonSnapshot
      }
    });
    await tx.applicationCheckFinding.upsert({
      where: { applicationRecordId_checkType: { applicationRecordId, checkType: check.checkType } },
      update: {
        message: check.findingMessage || "Values match.",
        active: Boolean(check.findingMessage),
        comparisonSnapshot: check.comparisonSnapshot,
        resolvedAt: check.findingMessage ? null : new Date()
      },
      create: {
        applicationRecordId,
        checkType: check.checkType,
        message: check.findingMessage || "Values match.",
        active: Boolean(check.findingMessage),
        comparisonSnapshot: check.comparisonSnapshot,
        resolvedAt: check.findingMessage ? null : new Date()
      }
    });
  }
}

function calculationRuleData(rule: {
  processingTiers: Prisma.JsonValue;
  additionalProcessingStep: number;
  additionalProcessingFee: unknown;
  applicationFeePerTree: unknown;
  replantingFeePerTree: unknown;
  maxTreesPerPtc: number;
  validityBrackets: Prisma.JsonValue;
}): Omit<Prisma.PtcCalculationRuleUncheckedCreateInput, "id" | "versionId" | "applicationTypeId" | "createdAt" | "updatedAt"> {
  return {
    processingTiers: rule.processingTiers === null ? Prisma.JsonNull : rule.processingTiers as Prisma.InputJsonValue,
    additionalProcessingStep: rule.additionalProcessingStep,
    additionalProcessingFee: Number(rule.additionalProcessingFee),
    applicationFeePerTree: Number(rule.applicationFeePerTree),
    replantingFeePerTree: Number(rule.replantingFeePerTree),
    maxTreesPerPtc: rule.maxTreesPerPtc,
    validityBrackets: rule.validityBrackets === null ? Prisma.JsonNull : rule.validityBrackets as Prisma.InputJsonValue
  };
}

function pttRecordData(formData: FormData) {
  return {
    pttNumber: nullableString(formData.get("pttNumber")),
    dateIssued: nullableDate(formData.get("dateIssued")),
    regionalOffice: nullableString(formData.get("regionalOffice")),
    provincialOffice: nullableString(formData.get("provincialOffice")),
    transporterName: nullableString(formData.get("transporterName")),
    transporterAddress: nullableString(formData.get("transporterAddress")),
    ptcNumber: nullableString(formData.get("ptcNumber")),
    pcaRegistrationCertificateNumber: nullableString(formData.get("pcaRegistrationCertificateNumber")),
    pcaRegistrationCertificateDate: nullableDate(formData.get("pcaRegistrationCertificateDate")),
    businessAddress: nullableString(formData.get("businessAddress")),
    boardFeetGranted: nullableDecimal(formData.get("boardFeetGranted")),
    certificateOfQuantityVolumeAttached: nullableBoolean(formData.get("certificateOfQuantityVolumeAttached")),
    volumeBoardFeet: nullableDecimal(formData.get("volumeBoardFeet")),
    originOfLumber: nullableString(formData.get("originOfLumber")),
    destination: nullableString(formData.get("destination")),
    consigneeName: nullableString(formData.get("consigneeName")),
    consigneePcaRegistration: nullableString(formData.get("consigneePcaRegistration")),
    transportType: nullableString(formData.get("transportType")),
    vehiclePlateNumber: nullableString(formData.get("vehiclePlateNumber")),
    authorizedDriverName: nullableString(formData.get("authorizedDriverName")),
    authorizedDriverContact: nullableString(formData.get("authorizedDriverContact")),
    amountPaid: nullableDecimal(formData.get("amountPaid")),
    officialReceiptNumber: nullableString(formData.get("officialReceiptNumber")),
    recordedValidityDays: nullableInt(formData.get("recordedValidityDays")),
    actualValidityDays: nullableInt(formData.get("actualValidityDays")),
    dateValidatedInspected: nullableDate(formData.get("dateValidatedInspected")),
    validatedInspectedBy: nullableString(formData.get("validatedInspectedBy")),
    issuedByDate: nullableDate(formData.get("issuedByDate")),
    issuedBy: nullableString(formData.get("issuedBy")),
    remarks: nullableString(formData.get("remarks"))
  };
}

function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || fallback);
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function withToast(path: string, type: "success" | "error", message: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("toast", type);
  params.set("message", message);
  return `${base}?${params.toString()}`;
}

function redirectWithToast(path: string, type: "success" | "error", message: string): never {
  redirect(withToast(path, type, message));
}

function revalidateReports() {
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/reports/missing-documents");
  revalidatePath("/reports/document-summary");
  revalidatePath("/reports/application-summary");
  revalidatePath("/reports/completion-summary");
  revalidatePath("/reports/document-combinations");
}

function revalidatePttApplications() {
  revalidatePath("/ptt/applications");
  revalidatePath("/ptt/applications/new");
  revalidatePath("/admin/master-data");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirectWithToast("/login", "error", "Invalid email or password.");
  }

  await setSession(user.id);
  redirectWithToast("/dashboard", "success", "Signed in successfully.");
}

export async function logoutAction() {
  clearSession();
  redirectWithToast("/login", "success", "Signed out successfully.");
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/dashboard");
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

export async function createRecordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createRecordSchema.safeParse({
    applicantName: formData.get("applicantName") || undefined,
    versionId: formData.get("versionId") || undefined,
    applicationTypeId: formData.get("applicationTypeId") || undefined,
    remarks: formData.get("remarks") || undefined,
    documentIds: formData.getAll("documentIds").map(String)
  });
  if (!parsed.success) redirectWithToast("/applications/new", "error", "Could not read the application form.");
  const input = parsed.data;
  const versionId = nullableVersionId(formData.get("versionId"));
  const applicationTypeId = versionId ? input.applicationTypeId || null : null;

  if (!versionId && (input.applicationTypeId || input.documentIds.length > 0)) {
    redirectWithToast("/applications/new", "error", "Assign a Version before choosing a type of application or documents.");
  }
  if (!applicationTypeId && input.documentIds.length > 0) {
    redirectWithToast("/applications/new", "error", "Choose a type of application before selecting documents.");
  }

  let recordId = "";
  try {
    const version = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC, active: true } }) : null;
    if (versionId && !version) redirectWithToast("/applications/new", "error", "Selected Version was not found.");

    const applicationType = applicationTypeId
      ? await prisma.applicationType.findFirst({ where: { id: applicationTypeId, group: PERMIT_GROUP_PTC, versionId: versionId!, active: true } })
      : null;
    if (applicationTypeId && !applicationType) redirectWithToast("/applications/new", "error", "Selected type of application does not belong to the selected Version.");

    const allowedDocuments = applicationTypeId
      ? await prisma.requiredDocument.findMany({
          where: { applicationTypeId, id: { in: input.documentIds }, active: true, applicationType: { group: PERMIT_GROUP_PTC, versionId: versionId! } }
        })
      : [];
    const allowedDocumentIds = new Set(allowedDocuments.map((document) => document.id));
    const invalidDocumentIds = input.documentIds.filter((documentId) => !allowedDocumentIds.has(documentId));
    if (invalidDocumentIds.length > 0) redirectWithToast("/applications/new", "error", "One or more submitted files do not belong to the selected Version.");
    const checkResult = await buildPtcChecks(formData, user, versionId, applicationTypeId);
    if ("error" in checkResult) redirectWithToast("/applications/new", "error", checkResult.error || "Could not calculate the requested PTC check.");

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.applicationRecord.create({
        data: {
          group: PERMIT_GROUP_PTC,
          versionId,
          applicantName: input.applicantName || null,
          applicationTypeId,
          remarks: input.remarks || null,
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
    redirectWithToast("/applications/new", "error", "Could not create the application record.");
  }

  revalidateReports();
  const nextApplicationPath = versionId ? `/applications/new?version=${encodeURIComponent(versionId)}` : "/applications/new";
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
  if (!record) redirectWithToast("/applications", "error", "Application record was not found.");
  if (!record.versionId) redirectWithToast(`/applications/${input.applicationRecordId}`, "error", "Assign a Version before adding progress documents.");
  if (!record.applicationTypeId) redirectWithToast(`/applications/${input.applicationRecordId}`, "error", "Choose a type of application before adding progress documents.");

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
  revalidatePath(`/applications/${input.applicationRecordId}`);
  redirectWithToast(`/applications/${input.applicationRecordId}`, "success", "Progress saved.");
}

export async function updateApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/applications");
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

  const current = await prisma.applicationRecord.findUnique({ where: { id: input.id } });
  if (!current) redirectWithToast("/applications", "error", "Application record was not found.");
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.progressEntry.deleteMany({ where: { applicationRecordId: input.id } });

      await tx.applicationRecord.update({
        where: { id: input.id },
        data: {
          versionId,
          applicantName: input.applicantName || null,
          applicationTypeId,
          remarks: input.remarks || null,
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
  revalidatePath(`/applications/${input.id}`);
  redirectWithToast(returnTo, "success", "Application updated.");
}
export async function deleteApplicationRecordAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/applications", "error", "Application record id is required.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicationRecord.delete({ where: { id } });
      await tx.activityLog.create({
        data: { userId: user.id, action: "DELETE_RECORD", targetType: "application_record", targetId: id }
      });
    });
  } catch {
    redirectWithToast("/applications", "error", "Could not delete the application record.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", "Application deleted.");
}

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

    const record = await prisma.pttApplicationRecord.create({
      data: {
        group: PERMIT_GROUP_PTT,
        versionId,
        ...pttRecordData(formData),
        createdById: user.id
      }
    });
    recordId = record.id;

    await prisma.activityLog.create({
      data: { userId: user.id, action: "CREATE_PTT_RECORD", targetType: "ptt_application_record", targetId: record.id, metadata: { versionId } }
    });
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

    await prisma.pttApplicationRecord.update({
      where: { id: input.id },
      data: {
        versionId,
        ...pttRecordData(formData),
        editedById: user.id
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_PTT_RECORD",
        targetType: "ptt_application_record",
        targetId: input.id,
        metadata: { versionChanged: current.versionId !== versionId }
      }
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

export async function bulkDeleteApplicationRecordsAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = [...new Set(formData.getAll("applicationRecordIds").map(String).filter(Boolean))];
  if (ids.length === 0) redirectWithToast("/applications", "error", "Select at least one application to delete.");

  const records = await prisma.applicationRecord.findMany({
    where: { id: { in: ids }, group: PERMIT_GROUP_PTC },
    select: { id: true }
  });
  if (records.length !== ids.length) {
    redirectWithToast("/applications", "error", "Some selected applications were already deleted or are not PTC records.");
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
    redirectWithToast("/applications", "error", "Could not delete the selected applications.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", `Deleted ${recordIds.length} application${recordIds.length === 1 ? "" : "s"}.`);
}

export async function bulkAssignApplicationVersionAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = [...new Set(formData.getAll("applicationRecordIds").map(String).filter(Boolean))];
  const targetVersionId = nullableVersionId(formData.get("versionId"));
  const confirmReset = formData.get("confirmReset") === "on";
  if (ids.length === 0) redirectWithToast("/applications", "error", "Select at least one application to assign a Version.");

  const targetVersion = targetVersionId
    ? await prisma.ptcVersion.findFirst({ where: { id: targetVersionId, group: PERMIT_GROUP_PTC, active: true } })
    : null;
  if (targetVersionId && !targetVersion) redirectWithToast("/applications", "error", "Selected Version was not found or is archived.");

  const records = await prisma.applicationRecord.findMany({
    where: { id: { in: ids }, group: PERMIT_GROUP_PTC },
    include: { applicationType: { include: { documents: { where: { active: true } } } }, progressDocuments: true }
  });
  if (records.length !== ids.length) {
    redirectWithToast("/applications", "error", "Some selected applications were already deleted or are not PTC records.");
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
    redirectWithToast("/applications", "error", `Confirm the reset warning before assigning Version. ${resetCount} selected record${resetCount === 1 ? "" : "s"} will reset Type/Documents.`);
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
    redirectWithToast("/applications", "error", "Could not assign the selected Version.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", `Assigned Version to ${records.length} application${records.length === 1 ? "" : "s"}. Reset ${resetCount} incompatible record${resetCount === 1 ? "" : "s"}.`);
}
export async function deleteAllApplicationRecordsAction(formData: FormData) {
  const admin = await requireAdmin();
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (confirmation !== "DELETE ALL PTC") {
    redirectWithToast("/applications", "error", "Type DELETE ALL PTC to confirm deleting all applications.");
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
    redirectWithToast("/applications", "error", "Could not delete all applications.");
  }

  revalidateReports();
  redirectWithToast("/applications", "success", `Deleted all PTC applications (${deletedCount} record${deletedCount === 1 ? "" : "s"}).`);
}

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
  if (target.role !== Role.ADMIN) redirectWithToast("/admin/users", "error", "Feature access can only be assigned to Admin accounts.");
  const features = [
    ...(formData.get("ptcFeesChecker") === "on" ? [FeatureKey.PTC_FEES_CHECKER] : []),
    ...(formData.get("ptcValidityChecker") === "on" ? [FeatureKey.PTC_VALIDITY_CHECKER] : [])
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

function calculationConfigFromFormData(formData: FormData) {
  const tierUps = formData.getAll("tierUpTo").map((value) => nullableInt(value));
  const tierFees = formData.getAll("tierFee").map((value) => nullableDecimal(value));
  const validityUps = formData.getAll("validityUpTo").map((value) => nullableInt(value));
  const validityDays = formData.getAll("validityDays").map((value) => nullableInt(value));
  const processingTiers = tierUps.map((upTo, index) => ({ upTo, fee: tierFees[index] === null ? null : Number(tierFees[index]) }));
  const validityBrackets = validityUps.map((upTo, index) => ({ upTo, days: validityDays[index] }));
  if (processingTiers.some((tier) => !tier.upTo || tier.fee === null) || validityBrackets.some((bracket) => !bracket.upTo || !bracket.days)) {
    throw new Error("Complete every processing-fee and validity bracket.");
  }
  if (processingTiers.some((tier, index) => index > 0 && tier.upTo! <= processingTiers[index - 1].upTo!) || validityBrackets.some((bracket, index) => index > 0 && bracket.upTo! <= validityBrackets[index - 1].upTo!)) {
    throw new Error("Bracket limits must increase from top to bottom.");
  }
  return normalizePtcCalculationConfig({
    processingTiers: processingTiers.map((tier) => ({ upTo: tier.upTo!, fee: tier.fee! })),
    additionalProcessingStep: nullableInt(formData.get("additionalProcessingStep")) ?? 0,
    additionalProcessingFee: Number(nullableDecimal(formData.get("additionalProcessingFee")) ?? 0),
    applicationFeePerTree: Number(nullableDecimal(formData.get("applicationFeePerTree")) ?? 0),
    replantingFeePerTree: Number(nullableDecimal(formData.get("replantingFeePerTree")) ?? 0),
    maxTreesPerPtc: nullableInt(formData.get("maxTreesPerPtc")) ?? 0,
    validityBrackets: validityBrackets.map((bracket) => ({ upTo: bracket.upTo!, days: bracket.days! }))
  });
}

export async function savePtcCalculationRuleAction(formData: FormData) {
  const superadmin = await requireSuperadmin();
  const versionId = String(formData.get("versionId") || "");
  const applicationTypeId = nullableString(formData.get("applicationTypeId"));
  if (!versionId) redirectWithToast("/admin/master-data", "error", "Choose a PTC Version before saving calculation rules.");
  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC } });
    if (!version) redirectWithToast("/admin/master-data", "error", "PTC Version was not found.");
    if (applicationTypeId) {
      const applicationType = await prisma.applicationType.findFirst({ where: { id: applicationTypeId, versionId, group: PERMIT_GROUP_PTC } });
      if (!applicationType) redirectWithToast("/admin/master-data", "error", "The selected Type of Application does not belong to this Version.");
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
    redirectWithToast("/admin/master-data", "error", error instanceof Error ? error.message : "Could not save PTC calculation rules.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast(`/admin/master-data?version=${versionId}`, "success", applicationTypeId ? "Type of Application calculation override saved." : "Version calculation rules saved.");
}

export async function resetPtcApplicationTypeRuleAction(formData: FormData) {
  const superadmin = await requireSuperadmin();
  const versionId = String(formData.get("versionId") || "");
  const applicationTypeId = String(formData.get("applicationTypeId") || "");
  if (!versionId || !applicationTypeId) redirectWithToast("/admin/master-data", "error", "Version and Type of Application are required.");
  await prisma.ptcCalculationRule.deleteMany({ where: { versionId, applicationTypeId } });
  await prisma.activityLog.create({
    data: { userId: superadmin.id, action: "RESET_PTC_CALCULATION_RULE_OVERRIDE", targetType: "ptc_calculation_rule", metadata: { versionId, applicationTypeId } }
  });
  revalidatePath("/admin/master-data");
  redirectWithToast(`/admin/master-data?version=${versionId}`, "success", "Type of Application now inherits the Version calculation rules.");
}

export async function createPtcVersionAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!name) redirectWithToast("/admin/master-data", "error", "Version name is required.");

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
    redirectWithToast("/admin/master-data", "error", "Could not create the Version. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Version created.");
}
export async function clonePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const sourceVersionId = String(formData.get("sourceVersionId") || "");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!sourceVersionId || !name) redirectWithToast("/admin/master-data", "error", "Source Version and new Version name are required.");

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
    if (!source) redirectWithToast("/admin/master-data", "error", "Source Version was not found.");
    const existing = await prisma.ptcVersion.findUnique({ where: { group_name: { group: PERMIT_GROUP_PTC, name } } });
    if (existing) redirectWithToast("/admin/master-data", "error", "A Version with that name already exists.");
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
    redirectWithToast("/admin/master-data", "error", "Could not clone the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(`/admin/master-data?version=${createdVersionId}`, "success", `Version cloned as ${name}.`);
}

export async function updatePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!id || !name) redirectWithToast("/admin/master-data", "error", "Version name is required.");

  try {
    await prisma.ptcVersion.update({ where: { id }, data: { name, description, active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not update the Version. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(`/admin/master-data?version=${id}`, "success", "Version updated.");
}

export async function deletePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTC } });
    if (!version) redirectWithToast("/admin/master-data", "error", "Version was not found.");

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
    redirectWithToast("/admin/master-data", "error", "Could not deactivate the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Version deactivated.");
}

export async function createPttVersionAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!name) redirectWithToast("/admin/master-data", "error", "PTT Version name is required.");

  try {
    const count = await prisma.ptcVersion.count({ where: { group: PERMIT_GROUP_PTT } });
    await prisma.ptcVersion.upsert({
      where: { group_name: { group: PERMIT_GROUP_PTT, name } },
      update: { active: true, description },
      create: { group: PERMIT_GROUP_PTT, name, description, sortOrder: count + 1 }
    });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not create the PTT Version. The name may already exist.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT Version created.");
}

export async function updatePttVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = nullableString(formData.get("description"));
  if (!id || !name) redirectWithToast("/admin/master-data", "error", "PTT Version name is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast("/admin/master-data", "error", "PTT Version was not found.");
    await prisma.ptcVersion.update({ where: { id }, data: { name, description } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not update the PTT Version. The name may already exist.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT Version updated.");
}

export async function deletePttVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "PTT Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast("/admin/master-data", "error", "PTT Version was not found.");
    await prisma.ptcVersion.update({ where: { id }, data: { active: false } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not deactivate the PTT Version.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT Version deactivated.");
}

export async function createPttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const versionId = String(formData.get("versionId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!versionId || !name) redirectWithToast("/admin/master-data", "error", "PTT Version and transport type are required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT, active: true } });
    if (!version) redirectWithToast("/admin/master-data", "error", "Selected PTT Version was not found.");
    const count = await prisma.pttTransportType.count({ where: { versionId } });
    await prisma.pttTransportType.upsert({
      where: { versionId_name: { versionId, name } },
      update: { active: true },
      create: { group: PERMIT_GROUP_PTT, versionId, name, sortOrder: count + 1 }
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not add the PTT transport type. It may already exist in this Version.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT transport type added.");
}

export async function updatePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const versionId = String(formData.get("versionId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !versionId || !name) redirectWithToast("/admin/master-data", "error", "PTT Version and transport type are required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast("/admin/master-data", "error", "Selected PTT Version was not found.");
    await prisma.pttTransportType.update({ where: { id }, data: { versionId, name, active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not update the PTT transport type. It may already exist in this Version.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT transport type updated.");
}

export async function deletePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "PTT transport type id is required.");

  try {
    await prisma.pttTransportType.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not delete the PTT transport type.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT transport type deleted.");
}
export async function createApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const versionId = String(formData.get("versionId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!versionId || !name) redirectWithToast("/admin/master-data", "error", "Version and application type name are required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTC, active: true } });
    if (!version) redirectWithToast("/admin/master-data", "error", "Selected Version was not found.");
    const count = await prisma.applicationType.count({ where: { group: PERMIT_GROUP_PTC, versionId } });
    await prisma.applicationType.upsert({
      where: { versionId_name: { versionId, name } },
      update: { active: true },
      create: { group: PERMIT_GROUP_PTC, versionId, name, sortOrder: count + 1 }
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not add the application type. It may already exist in this Version.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast(`/admin/master-data?version=${versionId}`, "success", "Application type added.");
}
export async function createRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const applicationTypeId = String(formData.get("applicationTypeId") || "");
  const name = String(formData.get("name") || "").trim();
  const requirementMode = documentRequirementMode(formData.get("requirementMode"));
  if (!applicationTypeId || !name) redirectWithToast("/admin/master-data", "error", "Application type and document name are required.");

  try {
    const applicationType = await prisma.applicationType.findFirst({ where: { id: applicationTypeId, group: PERMIT_GROUP_PTC } });
    if (!applicationType) redirectWithToast("/admin/master-data", "error", "Application type was not found.");
    const count = await prisma.requiredDocument.count({ where: { applicationTypeId } });
    await prisma.requiredDocument.upsert({ where: { applicationTypeId_name: { applicationTypeId, name } }, update: { active: true, requirementMode }, create: { applicationTypeId, name, requirementMode, sortOrder: count + 1 } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not add the required document. It may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Required document added.");
}


export async function updateApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) redirectWithToast("/admin/master-data", "error", "Application type name is required.");

  try {
    await prisma.applicationType.update({ where: { id }, data: { name, active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not update the application type. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Application type updated.");
}

export async function deleteApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Application type id is required.");

  try {
    await prisma.applicationType.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not delete the application type.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Application type deleted.");
}

export async function updateRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const requirementMode = documentRequirementMode(formData.get("requirementMode"));
  if (!id || !name) redirectWithToast("/admin/master-data", "error", "Document name is required.");

  try {
    await prisma.requiredDocument.update({ where: { id }, data: { name, requirementMode, active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not update the required document. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Required document updated.");
}

export async function deleteRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Document id is required.");

  try {
    await prisma.requiredDocument.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not delete the required document.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Required document deleted.");
}

export async function createRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirectWithToast("/admin/master-data", "error", "Regional office name is required.");

  try {
    const count = await prisma.regionalOffice.count({ where: { group: PERMIT_GROUP_PTC } });
    await prisma.regionalOffice.upsert({
      where: { group_name: { group: PERMIT_GROUP_PTC, name } },
      update: { active: true },
      create: { group: PERMIT_GROUP_PTC, name, sortOrder: count + 1 }
    });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not add the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Regional office added.");
}

export async function updateRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) redirectWithToast("/admin/master-data", "error", "Regional office name is required.");

  try {
    await prisma.regionalOffice.update({ where: { id }, data: { name, active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not update the regional office. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Regional office updated.");
}

export async function deleteRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Regional office id is required.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.provincialOffice.updateMany({ where: { regionalOfficeId: id }, data: { active: false } });
      await tx.regionalOffice.update({ where: { id }, data: { active: false } });
    });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not delete the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Regional office deleted.");
}

export async function createProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const regionalOfficeId = String(formData.get("regionalOfficeId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!regionalOfficeId || !name) redirectWithToast("/admin/master-data", "error", "Regional office and provincial office name are required.");

  try {
    const region = await prisma.regionalOffice.findFirst({ where: { id: regionalOfficeId, group: PERMIT_GROUP_PTC, active: true } });
    if (!region) redirectWithToast("/admin/master-data", "error", "Regional office was not found.");
    const count = await prisma.provincialOffice.count({ where: { regionalOfficeId } });
    await prisma.provincialOffice.upsert({
      where: { regionalOfficeId_name: { regionalOfficeId, name } },
      update: { active: true },
      create: { regionalOfficeId, name, sortOrder: count + 1 }
    });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not add the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Provincial office added.");
}

export async function updateProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const regionalOfficeId = String(formData.get("regionalOfficeId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !regionalOfficeId || !name) redirectWithToast("/admin/master-data", "error", "Regional office and provincial office name are required.");

  try {
    await prisma.provincialOffice.update({ where: { id }, data: { regionalOfficeId, name, active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not update the provincial office. The name may already exist.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Provincial office updated.");
}

export async function deleteProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Provincial office id is required.");

  try {
    await prisma.provincialOffice.update({ where: { id }, data: { active: false } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not delete the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Provincial office deleted.");
}

export async function restorePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Version id is required.");

  try {
    await prisma.ptcVersion.update({ where: { id }, data: { active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not restore the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast(`/admin/master-data?version=${id}`, "success", "Version restored.");
}

export async function hardDeletePtcVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Version id is required.");

  try {
    const version = await prisma.ptcVersion.findUnique({
      where: { id },
      include: {
        records: true,
        applicationTypes: { include: { documents: { include: { progressDocuments: true } }, records: true } }
      }
    });
    if (!version) redirectWithToast("/admin/master-data", "error", "Version was not found.");
    if (version.active) redirectWithToast("/admin/master-data", "error", "Deactivate the Version before permanently deleting it.");
    if (version.records.length > 0) redirectWithToast("/admin/master-data", "error", "Cannot permanently delete a Version assigned to application records.");
    if (version.applicationTypes.some((type) => type.records.length > 0 || type.documents.some((doc) => doc.progressDocuments.length > 0))) {
      redirectWithToast("/admin/master-data", "error", "Cannot permanently delete a Version whose application types or documents have history.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.requiredDocument.deleteMany({ where: { applicationType: { versionId: id } } });
      await tx.applicationType.deleteMany({ where: { versionId: id } });
      await tx.ptcVersion.delete({ where: { id } });
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the Version.");
  }

  revalidatePath("/admin/master-data");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Version and unused copied master data permanently deleted.");
}

export async function restorePttVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "PTT Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({ where: { id, group: PERMIT_GROUP_PTT } });
    if (!version) redirectWithToast("/admin/master-data", "error", "PTT Version was not found.");
    await prisma.ptcVersion.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not restore the PTT Version.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT Version restored.");
}

export async function hardDeletePttVersionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "PTT Version id is required.");

  try {
    const version = await prisma.ptcVersion.findFirst({
      where: { id, group: PERMIT_GROUP_PTT },
      include: { pttRecords: true }
    });
    if (!version) redirectWithToast("/admin/master-data", "error", "PTT Version was not found.");
    if (version.active) redirectWithToast("/admin/master-data", "error", "Deactivate the PTT Version before permanently deleting it.");
    if (version.pttRecords.length > 0) redirectWithToast("/admin/master-data", "error", "Cannot permanently delete a PTT Version assigned to application records.");
    await prisma.ptcVersion.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the PTT Version.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT Version permanently deleted.");
}

export async function restorePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "PTT transport type id is required.");

  try {
    const type = await prisma.pttTransportType.findUnique({ where: { id }, include: { version: true } });
    if (!type) redirectWithToast("/admin/master-data", "error", "PTT transport type was not found.");
    if (!type.version.active) redirectWithToast("/admin/master-data", "error", "Restore the PTT Version before restoring this transport type.");
    await prisma.pttTransportType.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not restore the PTT transport type.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT transport type restored.");
}

export async function hardDeletePttTransportTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "PTT transport type id is required.");

  try {
    const type = await prisma.pttTransportType.findUnique({ where: { id } });
    if (!type) redirectWithToast("/admin/master-data", "error", "PTT transport type was not found.");
    if (type.active) redirectWithToast("/admin/master-data", "error", "Deactivate the PTT transport type before permanently deleting it.");
    const usedCount = await prisma.pttApplicationRecord.count({
      where: { versionId: type.versionId, transportType: type.name }
    });
    if (usedCount > 0) redirectWithToast("/admin/master-data", "error", "Cannot permanently delete a PTT transport type used by application records.");
    await prisma.pttTransportType.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the PTT transport type.");
  }

  revalidatePttApplications();
  redirectWithToast("/admin/master-data", "success", "PTT transport type permanently deleted.");
}
export async function restoreApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Application type id is required.");

  try {
    await prisma.applicationType.update({ where: { id }, data: { active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not restore the application type.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Application type restored.");
}

export async function hardDeleteApplicationTypeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Application type id is required.");

  try {
    const applicationType = await prisma.applicationType.findUnique({
      where: { id },
      include: { documents: { include: { progressDocuments: true } }, records: true }
    });
    if (!applicationType) redirectWithToast("/admin/master-data", "error", "Application type was not found.");
    if (applicationType.active) redirectWithToast("/admin/master-data", "error", "Deactivate the application type before permanently deleting it.");
    if (applicationType.records.length > 0) redirectWithToast("/admin/master-data", "error", "Cannot permanently delete an application type that is used by application records.");
    if (applicationType.documents.some((doc) => doc.progressDocuments.length > 0)) {
      redirectWithToast("/admin/master-data", "error", "Cannot permanently delete an application type with document history.");
    }
    await prisma.applicationType.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the application type.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Application type permanently deleted.");
}

export async function restoreRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Document id is required.");

  try {
    const document = await prisma.requiredDocument.findUnique({ where: { id }, include: { applicationType: true } });
    if (!document) redirectWithToast("/admin/master-data", "error", "Required document was not found.");
    if (!document.applicationType.active) redirectWithToast("/admin/master-data", "error", "Restore the application type before restoring this document.");
    await prisma.requiredDocument.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not restore the required document.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Required document restored.");
}

export async function hardDeleteRequiredDocumentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Document id is required.");

  try {
    const document = await prisma.requiredDocument.findUnique({ where: { id }, include: { progressDocuments: true } });
    if (!document) redirectWithToast("/admin/master-data", "error", "Required document was not found.");
    if (document.active) redirectWithToast("/admin/master-data", "error", "Deactivate the required document before permanently deleting it.");
    if (document.progressDocuments.length > 0) redirectWithToast("/admin/master-data", "error", "Cannot permanently delete a required document with application history.");
    await prisma.requiredDocument.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the required document.");
  }

  revalidatePath("/admin/master-data");
  revalidatePath("/applications/new");
  revalidateReports();
  redirectWithToast("/admin/master-data", "success", "Required document permanently deleted.");
}

export async function restoreRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Regional office id is required.");

  try {
    await prisma.regionalOffice.update({ where: { id }, data: { active: true } });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not restore the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Regional office restored.");
}

export async function hardDeleteRegionalOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Regional office id is required.");

  try {
    const office = await prisma.regionalOffice.findUnique({ where: { id } });
    if (!office) redirectWithToast("/admin/master-data", "error", "Regional office was not found.");
    if (office.active) redirectWithToast("/admin/master-data", "error", "Deactivate the regional office before permanently deleting it.");
    await prisma.$transaction(async (tx) => {
      await tx.provincialOffice.deleteMany({ where: { regionalOfficeId: id } });
      await tx.regionalOffice.delete({ where: { id } });
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the regional office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Regional office permanently deleted.");
}

export async function restoreProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Provincial office id is required.");

  try {
    const office = await prisma.provincialOffice.findUnique({ where: { id }, include: { regionalOffice: true } });
    if (!office) redirectWithToast("/admin/master-data", "error", "Provincial office was not found.");
    if (!office.regionalOffice.active) redirectWithToast("/admin/master-data", "error", "Restore the regional office before restoring this provincial office.");
    await prisma.provincialOffice.update({ where: { id }, data: { active: true } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not restore the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Provincial office restored.");
}

export async function hardDeleteProvincialOfficeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) redirectWithToast("/admin/master-data", "error", "Provincial office id is required.");

  try {
    const office = await prisma.provincialOffice.findUnique({ where: { id } });
    if (!office) redirectWithToast("/admin/master-data", "error", "Provincial office was not found.");
    if (office.active) redirectWithToast("/admin/master-data", "error", "Deactivate the provincial office before permanently deleting it.");
    await prisma.provincialOffice.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirectWithToast("/admin/master-data", "error", "Could not permanently delete the provincial office.");
  }

  revalidatePath("/admin/master-data");
  redirectWithToast("/admin/master-data", "success", "Provincial office permanently deleted.");
}
export async function importPtcRecordsAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const selectedVersionId = nullableVersionId(formData.get("versionId"));
  if (!(file instanceof File)) redirectWithToast("/admin/master-data", "error", "Upload a PTC Excel file.");

  const selectedVersion = selectedVersionId
    ? await prisma.ptcVersion.findFirst({ where: { id: selectedVersionId, group: PERMIT_GROUP_PTC, active: true } })
    : null;
  if (selectedVersionId && !selectedVersion) redirectWithToast("/admin/master-data", "error", "Selected import Version was not found or is archived.");

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parsePtcRecordsWorkbook(buffer);
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not read the PTC Excel file.");
  }

  if (parsed.length === 0) redirectWithToast("/admin/master-data", "error", "No PTC rows were found to import.");

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
    redirectWithToast("/admin/master-data", "error", "Could not import the PTC records.");
  }

  revalidateReports();
  const assignedCount = selectedVersionId ? parsed.length : 0;
  const uncategorizedCount = selectedVersionId ? 0 : parsed.length;
  redirectWithToast(
    `/admin/master-data?version=${selectedVersionId || UNCATEGORIZED_VERSION}`,
    "success",
    `Imported ${parsed.length} PTC record${parsed.length === 1 ? "" : "s"}. Assigned: ${assignedCount}. Unmatched types: ${unmatchedTypeCount}. Uncategorized: ${uncategorizedCount}.`
  );
}

export async function importPttRecordsAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const selectedVersionId = nullableVersionId(formData.get("versionId"));
  if (!(file instanceof File)) redirectWithToast("/admin/master-data", "error", "Upload a PTT Excel file.");
  if (!selectedVersionId) redirectWithToast("/admin/master-data", "error", "Choose a PTT Version before importing PTT records.");

  const selectedVersion = await prisma.ptcVersion.findFirst({
    where: { id: selectedVersionId, group: PERMIT_GROUP_PTT, active: true }
  });
  if (!selectedVersion) redirectWithToast("/admin/master-data", "error", "Selected PTT Version was not found or is archived.");

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parsePttRecordsWorkbook(buffer);
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not read the PTT Excel file.");
  }

  if (parsed.length === 0) redirectWithToast("/admin/master-data", "error", "No PTT rows were found to import.");

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
    officialReceiptNumber: record.officialReceiptNumber || null,
    recordedValidityDays: record.recordedValidityDays ?? null,
    actualValidityDays: record.actualValidityDays ?? null,
    dateValidatedInspected: record.dateValidatedInspected || null,
    validatedInspectedBy: record.validatedInspectedBy || null,
    issuedByDate: record.issuedByDate || null,
    issuedBy: record.issuedBy || null,
    remarks: record.remarks || null
  }));

  try {
    await prisma.pttApplicationRecord.createMany({ data });
  } catch {
    redirectWithToast("/admin/master-data", "error", "Could not import the PTT records.");
  }

  revalidatePttApplications();
  redirectWithToast(
    "/admin/master-data",
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
  revalidatePath("/applications/new");
}








