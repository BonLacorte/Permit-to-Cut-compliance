export const PERMIT_GROUP_PTC = "PTC";
export const REGIONAL_OFFICES = ["Region IV-A"] as const;
export const PROVINCIAL_OFFICES_BY_REGION: Record<string, string[]> = {
  "Region IV-A": ["Quezon I", "Quezon II", "Laguna and Rizal", "Batangas and Cavite"]
};

export type PtcDisplayRecord = {
  applicantName?: string | null;
  ptcNumber?: string | null;
  dateIssued?: Date | string | null;
  regionalOffice?: string | null;
  provincialOffice?: string | null;
  municipality?: string | null;
  barangay?: string | null;
  treesApplied?: number | null;
  treesApproved?: number | null;
  seedlingsReplacement?: number | null;
};

export function isCancelledRecord(record: Pick<PtcDisplayRecord, "applicantName">) {
  return String(record.applicantName || "").trim().toUpperCase() === "CANCELLED";
}

export function numberOrZero(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function blankDisplay(value?: string | null, fallback = "") {
  return String(value || "").trim() || fallback;
}

export function displayApplicantName(record: Pick<PtcDisplayRecord, "applicantName">) {
  return blankDisplay(record.applicantName, "Blank Application");
}

export function displayPtcField(record: PtcDisplayRecord, key: keyof PtcDisplayRecord) {
  if (key === "ptcNumber") return blankDisplay(record.ptcNumber);
  if (key === "dateIssued") return formatDate(record.dateIssued);
  if (isCancelledRecord(record)) return "CANCELLED";
  const value = record[key];
  if (key === "treesApplied" || key === "treesApproved" || key === "seedlingsReplacement") {
    return String(numberOrZero(value as number | null | undefined));
  }
  return blankDisplay(value as string | null | undefined);
}