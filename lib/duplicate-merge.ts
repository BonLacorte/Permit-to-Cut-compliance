import { z } from "zod";
import { normalizePermitNumber, type PermitGroup } from "@/lib/duplicate-numbers";
import { calculatePtcFee, calculatePtcValidity, feeFinding, mergeRemarks, validityFinding, type PtcCalculationConfig } from "@/lib/ptc-checks";
import { calculatePttFee, calculatePttValidity, checkPttVehicleCapacity, pttFeeFinding, pttValidityFinding, type PttValidityRuleConfig } from "@/lib/ptt-checks";
import { ptcSignatureFinding, pttSignatureFinding, type PtcSignatureSource, type PttSignatureSource } from "@/lib/signatures";
import { pttRequiredDateFinding, type PttRequiredDateSource } from "@/lib/ptt-required-fields";

export type MergeField = { key: string; label: string };
const fields = (items: Array<[string, string]>): MergeField[] => items.map(([key, label]) => ({ key, label }));
const location = fields([["regionalOffice", "Regional Office"], ["provincialOffice", "Provincial Office"]]);
export const ptcMergeFields = fields([
  ["applicantName", "Name"], ["dateIssued", "Date Issued"], ["municipality", "Municipality"], ["barangay", "Barangay"],
  ["treesApplied", "Trees Applied"], ["treesApproved", "Trees Approved"], ["seedlingsReplacement", "Seedlings Replacement"],
  ["recordedFee", "Recorded Fee"], ["recordedValidityDays", "Recorded Validity"], ["officialReceiptNumber", "Official Receipt Number"],
  ["replantedSeedlings", "Replanted Seedlings"], ["locExemption", "LOC Exemption"], ["agriculturist", "Agriculturist"],
  ["recommendingApproval", "Recommending Approval"], ["recommendingApprovalSignatureStatus", "Recommending Approval Signature"],
  ["recommendingApprovalSignatureForName", "Recommending Approval For Name"], ["approved", "Approved"],
  ["approvedSignatureStatus", "Approved Signature"], ["approvedSignatureForName", "Approved For Name"], ["remarks", "Manual Remarks (append)"]
]).concat(location);
export const pttMergeFields = fields([
  ["transporterName", "Name"], ["dateIssued", "Date Issued"], ["transporterAddress", "Transporter Address"], ["ptcNumber", "Linked PTC Number"],
  ["pcaRegistrationCertificateNumber", "PCA Registration Certificate Number"], ["pcaRegistrationCertificateDate", "PCA Registration Certificate Date"],
  ["businessAddress", "Business Address"], ["boardFeetGranted", "Board Feet Granted"], ["certificateOfQuantityVolumeAttached", "Certificate of Quantity/Volume Attached"],
  ["volumeBoardFeet", "Volume"], ["originOfLumber", "Origin"], ["destination", "Destination"], ["consigneeName", "Consignee"],
  ["consigneePcaRegistration", "Consignee PCA Registration"], ["transportType", "Recorded Transport Type"], ["vehiclePlateNumber", "Plate/Container/Vessel Number"],
  ["authorizedDriverName", "Authorized Driver Name"], ["amountPaid", "Recorded Fee"], ["officialReceiptNumber", "Official Receipt Number"],
  ["recordedValidityDays", "Recorded Validity"], ["validityBasis", "Validity Basis"], ["dateValidatedInspected", "Date Validated/Inspected"],
  ["validatedInspectedBy", "Validated/Inspected By"], ["validatedInspectedBySignatureStatus", "Validated/Inspected By Signature"],
  ["validatedInspectedBySignatureForName", "Validated/Inspected By For Name"], ["issuedByDate", "Issued By Date"], ["issuedBy", "Issued By"],
  ["issuedBySignatureStatus", "Issued By Signature"], ["issuedBySignatureForName", "Issued By For Name"], ["remarks", "Manual Remarks (append)"]
]).concat(location);

export function duplicateMergeFields(group: PermitGroup) { return group === "PTC" ? ptcMergeFields : pttMergeFields; }
export const mergeSelectionSchema = z.object({
  group: z.enum(["PTC", "PTT"]), keeperId: z.string().min(1), deleteIds: z.array(z.string().min(1)).min(1),
  transfers: z.array(z.object({ field: z.string(), sourceId: z.string().min(1) })),
  outsideRegionDays: z.number().int().positive().nullable().optional()
}).strict();
export type MergeSelection = z.infer<typeof mergeSelectionSchema>;
export type MergeRecord = Record<string, unknown> & { id: string };

export function selectMergedRecord(records: MergeRecord[], selection: MergeSelection) {
  const keeper = records.find((record) => record.id === selection.keeperId);
  if (!keeper) throw new Error("The retained record no longer exists.");
  const numberField = selection.group === "PTC" ? "ptcNumber" : "pttNumber";
  const number = normalizePermitNumber(keeper[numberField]);
  const deleted = new Set(selection.deleteIds);
  if (!number || deleted.has(keeper.id) || deleted.size !== selection.deleteIds.length) throw new Error("Choose distinct records to delete and a different record to keep.");
  for (const id of deleted) {
    const source = records.find((record) => record.id === id);
    if (!source || source.group !== selection.group || normalizePermitNumber(source[numberField]) !== number) throw new Error("All selected records must belong to the same duplicate permit group.");
  }
  if (keeper.group !== selection.group) throw new Error("The retained record belongs to another permit group.");
  const allowed = new Set(duplicateMergeFields(selection.group).map((field) => field.key));
  const seen = new Set<string>();
  const data: Record<string, unknown> = {};
  for (const transfer of selection.transfers) {
    if (!allowed.has(transfer.field) || seen.has(transfer.field)) throw new Error("Each transferable field can have only one source. Protected fields cannot be transferred.");
    if (!deleted.has(transfer.sourceId)) throw new Error("Transfer sources must be selected for deletion.");
    seen.add(transfer.field);
    const donor = records.find((record) => record.id === transfer.sourceId)!;
    data[transfer.field] = transfer.field === "remarks" ? mergeRemarks(String(keeper.remarks || ""), [String(donor.remarks || "")]) : donor[transfer.field] ?? null;
  }
  return { keeper, data, merged: { ...keeper, ...data } as MergeRecord };
}

export type MergeCheck = {
  type: "Fee" | "Validity" | "Vehicle" | "Signature" | "RequiredFields";
  state: "matched" | "issue" | "not-checked";
  message: string;
  input: Record<string, unknown>;
  rule: unknown;
  output: unknown;
};
export type MergeRuleContext = { ptcConfig?: PtcCalculationConfig; pttConfig: PttValidityRuleConfig; maxBoardFeet: unknown };

export function evaluateMergedRecord(group: PermitGroup, record: MergeRecord, rules: MergeRuleContext, outsideRegionDays?: number | null) {
  const checks: MergeCheck[] = [];
  const calculated: Record<string, unknown> = { actualFee: null, actualValidityDays: null, ...(group === "PTT" ? { actualTransportCategory: null } : {}) };
  function calculatedCheck(type: MergeCheck["type"], input: Record<string, unknown>, rule: unknown, run: () => { output: unknown; finding: string | null }) {
    try {
      const result = run();
      checks.push({ type, state: result.finding ? "issue" : "matched", message: result.finding || "Values match.", input, rule, output: result.output });
    } catch (error) {
      checks.push({ type, state: "not-checked", message: `Auto Check not run: ${group} ${type}. ${error instanceof Error ? error.message : "Missing calculation inputs."}`, input, rule, output: null });
    }
  }
  if (group === "PTC") {
    const requiredConfig = () => {
      if (!record.versionId || !record.applicationTypeId || !rules.ptcConfig) throw new Error("A Version, compatible Type, and configured calculation rule are required.");
      return rules.ptcConfig;
    };
    calculatedCheck("Fee", { treesApproved: record.treesApproved, replantedSeedlings: record.replantedSeedlings, recordedFee: record.recordedFee }, rules.ptcConfig || null, () => {
      const result = calculatePtcFee({ treesApproved: record.treesApproved as number | null, replantedSeedlings: record.replantedSeedlings as boolean | null, config: requiredConfig() });
      calculated.actualFee = result.actualFee;
      return { output: result, finding: feeFinding(record.recordedFee == null ? null : Number(record.recordedFee), result.actualFee) };
    });
    calculatedCheck("Validity", { treesApproved: record.treesApproved, recordedValidityDays: record.recordedValidityDays }, rules.ptcConfig || null, () => {
      const result = calculatePtcValidity({ treesApproved: record.treesApproved as number | null, config: requiredConfig() });
      calculated.actualValidityDays = result.actualValidityDays;
      return { output: result, finding: validityFinding(record.recordedValidityDays as number | null, result) };
    });
    const finding = ptcSignatureFinding(record as PtcSignatureSource);
    checks.push({ type: "Signature", state: finding ? "issue" : "matched", message: finding || "Signatures are signed.", input: { recommendingApproval: record.recommendingApproval, recommendingApprovalSignatureStatus: record.recommendingApprovalSignatureStatus, recommendingApprovalSignatureForName: record.recommendingApprovalSignatureForName, approved: record.approved, approvedSignatureStatus: record.approvedSignatureStatus, approvedSignatureForName: record.approvedSignatureForName }, rule: { source: "signature-status-controls" }, output: finding });
  } else {
    const requireVersion = () => { if (!record.versionId) throw new Error("A PTT Version is required."); };
    calculatedCheck("Fee", { volumeBoardFeet: record.volumeBoardFeet, recordedFee: record.amountPaid }, { ratePerBoardFoot: 0.3 }, () => {
      requireVersion(); const result = calculatePttFee({ volumeBoardFeet: record.volumeBoardFeet });
      calculated.actualFee = result.actualFee;
      return { output: result, finding: pttFeeFinding(record.amountPaid, result.actualFee) };
    });
    calculatedCheck("Validity", { validityBasis: record.validityBasis, outsideRegionValidityDays: outsideRegionDays ?? null, recordedValidityDays: record.recordedValidityDays }, rules.pttConfig, () => {
      requireVersion(); const result = calculatePttValidity({ validityBasis: record.validityBasis as string | null, outsideRegionValidityDays: outsideRegionDays, config: rules.pttConfig });
      calculated.actualValidityDays = result.actualValidityDays;
      return { output: result, finding: pttValidityFinding(record.recordedValidityDays, result) };
    });
    calculatedCheck("Vehicle", { volumeBoardFeet: record.volumeBoardFeet, transportType: record.transportType }, { maxBoardFeet: rules.maxBoardFeet }, () => {
      requireVersion(); const result = checkPttVehicleCapacity({ volumeBoardFeet: record.volumeBoardFeet, transportType: record.transportType as string | null, maxBoardFeet: rules.maxBoardFeet });
      calculated.actualTransportCategory = result.actualTransportCategory;
      return { output: result, finding: result.finding };
    });
    const signature = pttSignatureFinding(record as PttSignatureSource);
    checks.push({ type: "Signature", state: signature ? "issue" : "matched", message: signature || "Signatures are signed.", input: { validatedInspectedBy: record.validatedInspectedBy, validatedInspectedBySignatureStatus: record.validatedInspectedBySignatureStatus, validatedInspectedBySignatureForName: record.validatedInspectedBySignatureForName, issuedBy: record.issuedBy, issuedBySignatureStatus: record.issuedBySignatureStatus, issuedBySignatureForName: record.issuedBySignatureForName }, rule: { source: "signature-status-controls" }, output: signature });
    const dates = pttRequiredDateFinding(record as PttRequiredDateSource);
    checks.push({ type: "RequiredFields", state: dates ? "issue" : "matched", message: dates || "Required dates are filled.", input: { dateIssued: record.dateIssued, dateValidatedInspected: record.dateValidatedInspected }, rule: { requiredFields: ["dateIssued", "dateValidatedInspected"] }, output: dates });
  }
  return { calculated, checks, remarks: mergeRemarks(String(record.remarks || ""), checks.filter((check) => check.state !== "matched").map((check) => check.message)) };
}
