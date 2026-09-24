import { ApplicationCheckType, DocumentRequirementMode, FeatureKey, LocExemption, Prisma, PttCheckType, PttValidityBasis, PttVehicleCapacityCategory, Role, SignatureStatus } from "@prisma/client";
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
import { ptcSignatureFinding, pttSignatureFinding } from "@/lib/signatures";
import { pttRequiredDateFinding } from "@/lib/ptt-required-fields";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

export const createRecordSchema = z.object({
  applicantName: z.string().trim().optional(),
  versionId: z.string().trim().optional(),
  applicationTypeId: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

export const updateRecordSchema = z.object({
  id: z.string().min(1),
  applicantName: z.string().trim().optional(),
  versionId: z.string().trim().optional(),
  applicationTypeId: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([]),
  returnTo: z.string().optional()
});

export const progressSchema = z.object({
  applicationRecordId: z.string().min(1),
  remarks: z.string().trim().optional(),
  documentIds: z.array(z.string()).default([])
});

export const createPttRecordSchema = z.object({
  transporterName: z.string().trim().optional(),
  versionId: z.string().trim().optional(),
  remarks: z.string().trim().optional()
});

export const updatePttRecordSchema = createPttRecordSchema.extend({
  id: z.string().min(1),
  returnTo: z.string().optional()
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
  returnTo: z.string().optional()
});


export function isNextRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}
export function optionalString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || undefined;
}
export function nullableString(value: FormDataEntryValue | null) {
  return optionalString(value) || null;
}

export function nullableInt(value: FormDataEntryValue | null) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function nullableDecimal(value: FormDataEntryValue | null) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? text : null;
}

export function nullableBoolean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
}
export function nullableLocExemption(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "Owner") return LocExemption.Owner;
  if (text === "Others") return LocExemption.Others;
  return null;
}

export function nullablePttValidityBasis(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "WithinMunicipality") return PttValidityBasis.WithinMunicipality;
  if (text === "WithinProvince") return PttValidityBasis.WithinProvince;
  if (text === "WithinRegion") return PttValidityBasis.WithinRegion;
  if (text === "OutsideRegionInterIsland") return PttValidityBasis.OutsideRegionInterIsland;
  return null;
}

export function nullablePttVehicleCapacityCategory(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "SmallerThanJeep") return PttVehicleCapacityCategory.SmallerThanJeep;
  if (text === "Jeep") return PttVehicleCapacityCategory.Jeep;
  if (text === "ElfOrSixWheelerTruck") return PttVehicleCapacityCategory.ElfOrSixWheelerTruck;
  if (text === "ForwardTruck") return PttVehicleCapacityCategory.ForwardTruck;
  if (text === "TenWheelerTruck") return PttVehicleCapacityCategory.TenWheelerTruck;
  if (text === "TwelveWheelerAndAbove") return PttVehicleCapacityCategory.TwelveWheelerAndAbove;
  return null;
}

export function nullableSignatureStatus(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "Blank") return SignatureStatus.Blank;
  if (text === "For") return SignatureStatus.For;
  if (text === "Signed") return SignatureStatus.Signed;
  return null;
}

export function documentRequirementMode(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (text === "Optional") return DocumentRequirementMode.Optional;
  if (text === "LocConditional") return DocumentRequirementMode.LocConditional;
  return DocumentRequirementMode.Required;
}

export function nullableDate(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function nullableVersionId(value: FormDataEntryValue | null): string | null {
  const text = optionalString(value);
  if (!text || text === UNCATEGORIZED_VERSION) return null;
  return text;
}

export function ptcRecordData(formData: FormData) {
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
    recommendingApprovalSignatureStatus: nullableSignatureStatus(formData.get("recommendingApprovalSignatureStatus")),
    recommendingApprovalSignatureForName: nullableString(formData.get("recommendingApprovalSignatureForName")),
    approved: nullableString(formData.get("approved")),
    approvedSignatureStatus: nullableSignatureStatus(formData.get("approvedSignatureStatus")),
    approvedSignatureForName: nullableString(formData.get("approvedSignatureForName"))
  };
}

export type PendingPtcCheck = {
  checkType: ApplicationCheckType;
  inputSnapshot: Prisma.InputJsonObject;
  ruleSnapshot: Prisma.InputJsonObject;
  outputSnapshot: Prisma.InputJsonObject;
  comparisonSnapshot: Prisma.InputJsonObject;
  findingMessage: string | null;
};

export async function buildPtcChecks(formData: FormData, user: { id: string; role: Role }, versionId: string | null, applicationTypeId: string | null) {
  const applyFee = String(formData.get("applyFeeCheck") || "") === "true";
  const applyValidity = String(formData.get("applyValidityCheck") || "") === "true";
  const checks: PendingPtcCheck[] = [];
  const data: { actualFee?: number; actualValidityDays?: number } = {};
  const signatureInput = {
    recommendingApproval: nullableString(formData.get("recommendingApproval")),
    recommendingApprovalSignatureStatus: nullableSignatureStatus(formData.get("recommendingApprovalSignatureStatus")),
    recommendingApprovalSignatureForName: nullableString(formData.get("recommendingApprovalSignatureForName")),
    approved: nullableString(formData.get("approved")),
    approvedSignatureStatus: nullableSignatureStatus(formData.get("approvedSignatureStatus")),
    approvedSignatureForName: nullableString(formData.get("approvedSignatureForName"))
  };
  const signatureFinding = ptcSignatureFinding(signatureInput);
  checks.push({
    checkType: ApplicationCheckType.Signature,
    inputSnapshot: signatureInput,
    ruleSnapshot: { source: "signature-status-controls" },
    outputSnapshot: { messages: signatureFinding ? signatureFinding.split("\n") : [] },
    comparisonSnapshot: { hasSignatureIssues: Boolean(signatureFinding) },
    findingMessage: signatureFinding
  });
  if (!applyFee && !applyValidity) return { checks, data };
  if (!versionId || !applicationTypeId) return { error: "Choose a Version and Type of Application before using a checker." };
  if (applyFee && !(await userHasFeature(user, FeatureKey.PTC_FEES_CHECKER))) return { error: "You do not have access to the PTC Fees Checker." };
  if (applyValidity && !(await userHasFeature(user, FeatureKey.PTC_VALIDITY_CHECKER))) return { error: "You do not have access to the PTC Validity Checker." };

  try {
    const { rule, config, usingApplicationTypeOverride } = await resolvedPtcCalculationRule(versionId, applicationTypeId);
    const ruleSnapshot = { id: rule.id, versionId, applicationTypeId, usingApplicationTypeOverride, config };
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

export async function persistPtcChecks(tx: Prisma.TransactionClient, applicationRecordId: string, userId: string, checks: PendingPtcCheck[]) {
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

export function calculationRuleData(rule: {
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

export function pttRecordData(formData: FormData) {
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
    actualTransportCategory: nullablePttVehicleCapacityCategory(formData.get("actualTransportCategory")),
    vehiclePlateNumber: nullableString(formData.get("vehiclePlateNumber")),
    authorizedDriverName: nullableString(formData.get("authorizedDriverName")),
    authorizedDriverContact: nullableString(formData.get("authorizedDriverContact")),
    amountPaid: nullableDecimal(formData.get("amountPaid")),
    actualFee: nullableDecimal(formData.get("actualFee")),
    officialReceiptNumber: nullableString(formData.get("officialReceiptNumber")),
    recordedValidityDays: nullableInt(formData.get("recordedValidityDays")),
    actualValidityDays: nullableInt(formData.get("actualValidityDays")),
    validityBasis: nullablePttValidityBasis(formData.get("validityBasis")),
    dateValidatedInspected: nullableDate(formData.get("dateValidatedInspected")),
    validatedInspectedBy: nullableString(formData.get("validatedInspectedBy")),
    validatedInspectedBySignatureStatus: nullableSignatureStatus(formData.get("validatedInspectedBySignatureStatus")),
    validatedInspectedBySignatureForName: nullableString(formData.get("validatedInspectedBySignatureForName")),
    issuedByDate: nullableDate(formData.get("issuedByDate")),
    issuedBy: nullableString(formData.get("issuedBy")),
    issuedBySignatureStatus: nullableSignatureStatus(formData.get("issuedBySignatureStatus")),
    issuedBySignatureForName: nullableString(formData.get("issuedBySignatureForName")),
    remarks: nullableString(formData.get("remarks"))
  };
}

export type PendingPttCheck = {
  checkType: PttCheckType;
  inputSnapshot: Prisma.InputJsonObject;
  ruleSnapshot: Prisma.InputJsonObject;
  outputSnapshot: Prisma.InputJsonObject;
  comparisonSnapshot: Prisma.InputJsonObject;
  findingMessage: string | null;
};

export async function buildPttChecks(formData: FormData, user: { id: string; role: Role }, versionId: string | null) {
  const applyFee = String(formData.get("applyPttFeeCheck") || "") === "true";
  const applyValidity = String(formData.get("applyPttValidityCheck") || "") === "true";
  const applyVehicle = String(formData.get("applyPttVehicleCheck") || "") === "true";
  const checks: PendingPttCheck[] = [];
  const data: { actualFee?: number; actualValidityDays?: number; actualTransportCategory?: PttVehicleCapacityCategory | null } = {};
  const requiredDateInput = {
    dateIssued: nullableDate(formData.get("dateIssued")),
    dateValidatedInspected: nullableDate(formData.get("dateValidatedInspected"))
  };
  const requiredDateFinding = pttRequiredDateFinding(requiredDateInput);
  checks.push({
    checkType: PttCheckType.RequiredFields,
    inputSnapshot: requiredDateInput,
    ruleSnapshot: { requiredFields: ["dateIssued", "dateValidatedInspected"] },
    outputSnapshot: { messages: requiredDateFinding ? requiredDateFinding.split("\n") : [] },
    comparisonSnapshot: { hasMissingRequiredDates: Boolean(requiredDateFinding) },
    findingMessage: requiredDateFinding
  });
  const signatureInput = {
    validatedInspectedBy: nullableString(formData.get("validatedInspectedBy")),
    validatedInspectedBySignatureStatus: nullableSignatureStatus(formData.get("validatedInspectedBySignatureStatus")),
    validatedInspectedBySignatureForName: nullableString(formData.get("validatedInspectedBySignatureForName")),
    issuedBy: nullableString(formData.get("issuedBy")),
    issuedBySignatureStatus: nullableSignatureStatus(formData.get("issuedBySignatureStatus")),
    issuedBySignatureForName: nullableString(formData.get("issuedBySignatureForName"))
  };
  const signatureFinding = pttSignatureFinding(signatureInput);
  checks.push({
    checkType: PttCheckType.Signature,
    inputSnapshot: signatureInput,
    ruleSnapshot: { source: "signature-status-controls" },
    outputSnapshot: { messages: signatureFinding ? signatureFinding.split("\n") : [] },
    comparisonSnapshot: { hasSignatureIssues: Boolean(signatureFinding) },
    findingMessage: signatureFinding
  });
  if (!applyFee && !applyValidity && !applyVehicle) return { checks, data };
  if (!versionId) return { error: "Choose a PTT Version before using a checker." };
  if (applyFee && !(await userHasFeature(user, FeatureKey.PTT_FEES_CHECKER))) return { error: "You do not have access to the PTT Fees Checker." };
  if (applyValidity && !(await userHasFeature(user, FeatureKey.PTT_VALIDITY_CHECKER))) return { error: "You do not have access to the PTT Validity Checker." };
  if (applyVehicle && !(await userHasFeature(user, FeatureKey.PTT_VEHICLE_CAPACITY_CHECKER))) return { error: "You do not have access to the PTT Vehicle Capacity Checker." };

  try {
    const volumeBoardFeet = nullableDecimal(formData.get("volumeBoardFeet"));
    const recordedFee = nullableDecimal(formData.get("amountPaid"));
    const recordedValidityDays = nullableInt(formData.get("recordedValidityDays"));
    const validityBasis = nullablePttValidityBasis(formData.get("validityBasis"));
    const outsideRegionValidityDays = nullableInt(formData.get("outsideRegionValidityDays"));
    const transportType = nullableString(formData.get("transportType"));
    const transport = transportType
      ? await prisma.pttTransportType.findFirst({ where: { versionId, name: transportType, group: PERMIT_GROUP_PTT } })
      : null;
    const maxBoardFeet = transport?.maxBoardFeet ?? pttCapacityMaxFromCategory(transport?.capacityCategory || null);
    const transportRuleSnapshot = transport
      ? { id: transport.id, name: transport.name, capacityCategory: transport.capacityCategory, maxBoardFeet: maxBoardFeet === null ? null : Number(maxBoardFeet) }
      : { id: null, name: transportType, capacityCategory: null, maxBoardFeet: null };

    if (applyFee) {
      const result = calculatePttFee({ volumeBoardFeet });
      const findingMessage = pttFeeFinding(recordedFee === null ? null : Number(recordedFee), result.actualFee);
      data.actualFee = result.actualFee;
      checks.push({
        checkType: PttCheckType.Fee,
        inputSnapshot: { volumeBoardFeet, recordedFee },
        ruleSnapshot: { ratePerBoardFoot: result.ratePerBoardFoot },
        outputSnapshot: result,
        comparisonSnapshot: { recordedFee: recordedFee === null ? null : Number(recordedFee), actualFee: result.actualFee, matches: !findingMessage },
        findingMessage
      });
    }

    if (applyValidity) {
      const validityRule = await resolvedPttValidityRule(versionId);
      const result = calculatePttValidity({ validityBasis, outsideRegionValidityDays, config: validityRule.config });
      const findingMessage = pttValidityFinding(recordedValidityDays, result);
      data.actualValidityDays = result.actualValidityDays;
      checks.push({
        checkType: PttCheckType.Validity,
        inputSnapshot: { validityBasis, outsideRegionValidityDays, recordedValidityDays },
        ruleSnapshot: { id: validityRule.rule?.id ?? null, versionId, ...validityRule.config },
        outputSnapshot: result,
        comparisonSnapshot: { recordedValidityDays, actualValidityDays: result.actualValidityDays, matches: !findingMessage },
        findingMessage
      });
    }

    if (applyVehicle) {
      const result = checkPttVehicleCapacity({ volumeBoardFeet, transportType, maxBoardFeet });
      data.actualTransportCategory = result.actualTransportCategory as PttVehicleCapacityCategory | null;
      checks.push({
        checkType: PttCheckType.Vehicle,
        inputSnapshot: { volumeBoardFeet, transportType },
        ruleSnapshot: transportRuleSnapshot,
        outputSnapshot: result,
        comparisonSnapshot: { volumeBoardFeet: result.volumeBoardFeet, maxBoardFeet: result.maxBoardFeet, withinCapacity: result.withinCapacity, warning: result.warning, actualTransportCategory: result.actualTransportCategory, actualTransportLabel: result.actualTransportLabel },
        findingMessage: result.finding
      });
    }

    return { checks, data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not calculate the requested PTT check." };
  }
}

export async function persistPttChecks(tx: Prisma.TransactionClient, pttApplicationRecordId: string, userId: string, checks: PendingPttCheck[]) {
  for (const check of checks) {
    await tx.pttApplicationCheckRun.create({
      data: {
        pttApplicationRecordId,
        checkType: check.checkType,
        appliedById: userId,
        inputSnapshot: check.inputSnapshot,
        ruleSnapshot: check.ruleSnapshot,
        outputSnapshot: check.outputSnapshot,
        comparisonSnapshot: check.comparisonSnapshot
      }
    });
    await tx.pttApplicationCheckFinding.upsert({
      where: { pttApplicationRecordId_checkType: { pttApplicationRecordId, checkType: check.checkType } },
      update: {
        message: check.findingMessage || "Values match.",
        active: Boolean(check.findingMessage),
        comparisonSnapshot: check.comparisonSnapshot,
        resolvedAt: check.findingMessage ? null : new Date()
      },
      create: {
        pttApplicationRecordId,
        checkType: check.checkType,
        message: check.findingMessage || "Values match.",
        active: Boolean(check.findingMessage),
        comparisonSnapshot: check.comparisonSnapshot,
        resolvedAt: check.findingMessage ? null : new Date()
      }
    });
  }
}

export function pttTransportCapacityData(formData: FormData) {
  const capacityCategory = nullablePttVehicleCapacityCategory(formData.get("capacityCategory"));
  const maxBoardFeet = nullableDecimal(formData.get("maxBoardFeet"));
  return { capacityCategory, maxBoardFeet };
}

export function pttValidityRuleData(formData: FormData) {
  const withinMunicipalityDays = nullableInt(formData.get("withinMunicipalityDays"));
  const withinProvinceDays = nullableInt(formData.get("withinProvinceDays"));
  const withinRegionDays = nullableInt(formData.get("withinRegionDays"));
  const outsideDays = formData.getAll("outsideRegionAllowedDays").map((value) => nullableInt(value)).filter((value): value is number => value !== null);
  const outsideRegionAllowedDays = Array.from(new Set(outsideDays)).sort((a, b) => a - b);
  if (!withinMunicipalityDays || !withinProvinceDays || !withinRegionDays || outsideRegionAllowedDays.length === 0) {
    throw new Error("Complete every PTT validity rule day value.");
  }
  return { withinMunicipalityDays, withinProvinceDays, withinRegionDays, outsideRegionAllowedDays };
}
export function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || fallback);
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export function masterDataReturnTo(formData: FormData, fallback: string) {
  const returnTo = safeReturnTo(formData.get("returnTo"), fallback);
  return returnTo.startsWith("/admin/master-data") ? returnTo : fallback;
}

export function withVersionParam(path: string, versionId: string | null | undefined) {
  if (!versionId) return path;
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("version", versionId);
  return `${base}?${params.toString()}`;
}
export function withToast(path: string, type: "success" | "error", message: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("toast", type);
  params.set("message", message);
  return `${base}?${params.toString()}`;
}

export function redirectWithToast(path: string, type: "success" | "error", message: string): never {
  redirect(withToast(path, type, message));
}

export function revalidateReports() {
  revalidatePath("/ptc/applications");
  revalidatePath("/ptc/dashboard");
  revalidatePath("/ptc-report/missing-documents");
  revalidatePath("/ptc-report/document-summary");
  revalidatePath("/ptc-report/document-coverage");
  revalidatePath("/ptc-report/application-summary");
  revalidatePath("/ptc-report/completion-summary");
  revalidatePath("/ptc-report/document-combinations");
}

export function revalidatePttApplications() {
  revalidatePath("/ptt/applications");
  revalidatePath("/ptt/applications/new");
  revalidatePath("/admin/master-data");
}


export function calculationConfigFromFormData(formData: FormData) {
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
