export const PERMIT_GROUP_PTC = "PTC";
export const DEFAULT_REGIONAL_OFFICES = ["Region IV-A"] as const;
export const DEFAULT_PROVINCIAL_OFFICES_BY_REGION: Record<string, string[]> = {
  "Region IV-A": ["Quezon I", "Quezon II", "Laguna and Rizal", "Batangas and Cavite"]
};

export type OfficeChoice = {
  id: string;
  name: string;
  provincialOffices: { id: string; name: string }[];
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
  actualFee?: unknown;
  recordedFee?: unknown;
  replantedSeedlings?: boolean | null;
  locExemption?: "Owner" | "Others" | null;
  recommendingApproval?: string | null;
  approved?: string | null;
};

export function isCancelledRecord(record: Pick<PtcDisplayRecord, "applicantName">) {
  return String(record.applicantName || "").trim().toUpperCase() === "CANCELLED";
}

export function numberOrZero(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function decimalOrZero(value?: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function formatFee(value?: unknown) {
  const amount = decimalOrZero(value);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

export function feesMatch(record: Pick<PtcDisplayRecord, "actualFee" | "recordedFee">) {
  return decimalOrZero(record.actualFee) === decimalOrZero(record.recordedFee);
}

export function feeDifference(record: Pick<PtcDisplayRecord, "actualFee" | "recordedFee">) {
  return decimalOrZero(record.recordedFee) - decimalOrZero(record.actualFee);
}

export function formatSignedFeeDifference(record: Pick<PtcDisplayRecord, "actualFee" | "recordedFee">) {
  const difference = feeDifference(record);
  if (difference === 0) return "0";
  return `${difference > 0 ? "+" : "-"}${formatFee(Math.abs(difference))}`;
}

export function feesMatchDisplay(record: Pick<PtcDisplayRecord, "actualFee" | "recordedFee">) {
  if (feesMatch(record)) return formatFee(record.actualFee);
  return `Actual: ${formatFee(record.actualFee)} / Recorded: ${formatFee(record.recordedFee)}`;
}

export function displayReplantedSeedlings(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

export function displayLocExemption(value?: "Owner" | "Others" | null) {
  return value || "";
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
  if (key === "actualFee" || key === "recordedFee") return formatFee(value);
  if (key === "replantedSeedlings") return displayReplantedSeedlings(value as boolean | null | undefined);
  if (key === "locExemption") return displayLocExemption(value as "Owner" | "Others" | null | undefined);
  return blankDisplay(value as string | null | undefined);
}