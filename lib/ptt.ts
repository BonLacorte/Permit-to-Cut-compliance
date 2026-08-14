import { formatDate, formatFee } from "@/lib/ptc";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

export const PERMIT_GROUP_PTT = "PTT";
export const DEFAULT_PTT_VERSION_ID = "ptt-version-default";
export const DEFAULT_PTT_VERSION_NAME = "Default PTT";

export type PttStatus = "Complete" | "Incomplete" | "Pending";

export type PttDisplayRecord = {
  versionId?: string | null;
  versionName?: string | null;
  pttNumber?: string | null;
  dateIssued?: Date | string | null;
  regionalOffice?: string | null;
  provincialOffice?: string | null;
  transporterName?: string | null;
  transporterAddress?: string | null;
  ptcNumber?: string | null;
  pcaRegistrationCertificateNumber?: string | null;
  pcaRegistrationCertificateDate?: Date | string | null;
  businessAddress?: string | null;
  boardFeetGranted?: unknown;
  certificateOfQuantityVolumeAttached?: boolean | null;
  volumeBoardFeet?: unknown;
  originOfLumber?: string | null;
  destination?: string | null;
  consigneeName?: string | null;
  consigneePcaRegistration?: string | null;
  transportType?: string | null;
  vehiclePlateNumber?: string | null;
  authorizedDriverName?: string | null;
  authorizedDriverContact?: string | null;
  amountPaid?: unknown;
  officialReceiptNumber?: string | null;
  validUntil?: Date | string | null;
  dateValidatedInspected?: Date | string | null;
  validatedInspectedBy?: string | null;
  issuedBy?: string | null;
  remarks?: string | null;
  editedByName?: string | null;
  pttNumberDuplicate?: boolean;
};

const requiredTextFields: Array<keyof PttDisplayRecord> = [
  "pttNumber",
  "regionalOffice",
  "provincialOffice",
  "transporterName",
  "volumeBoardFeet",
  "originOfLumber",
  "destination",
  "transportType",
  "vehiclePlateNumber",
  "amountPaid",
  "officialReceiptNumber",
  "issuedBy"
];

const requiredDateFields: Array<keyof PttDisplayRecord> = ["dateIssued", "validUntil"];

const meaningfulFields: Array<keyof PttDisplayRecord> = [
  "pttNumber",
  "dateIssued",
  "regionalOffice",
  "provincialOffice",
  "transporterName",
  "transporterAddress",
  "ptcNumber",
  "pcaRegistrationCertificateNumber",
  "volumeBoardFeet",
  "originOfLumber",
  "destination",
  "consigneeName",
  "transportType",
  "vehiclePlateNumber",
  "amountPaid",
  "officialReceiptNumber",
  "validUntil",
  "issuedBy"
];

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return String(value).trim() !== "";
}

export function pttVersionQueryValue(versionId: string | null) {
  return versionId || UNCATEGORIZED_VERSION;
}

export function pttRegionName(record: Pick<PttDisplayRecord, "regionalOffice">) {
  return String(record.regionalOffice || "").trim() || "No Region";
}

export function filterPttRecordsByRegion<T extends Pick<PttDisplayRecord, "regionalOffice">>(records: T[], region: string) {
  if (!region || region === "All") return records;
  return records.filter((record) => pttRegionName(record) === region);
}

export function displayPttName(record: Pick<PttDisplayRecord, "transporterName">) {
  return String(record.transporterName || "").trim() || "Blank PTT Application";
}

export function displayPttText(value?: string | null, fallback = "") {
  return String(value || "").trim() || fallback;
}

export function formatPttNumber(value?: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(amount)) return "";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

export function formatPttBoolean(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

export function hasPttSourceReference(record: PttDisplayRecord) {
  return hasValue(record.ptcNumber) || hasValue(record.pcaRegistrationCertificateNumber);
}

export function isPttMeaningfullyStarted(record: PttDisplayRecord) {
  return meaningfulFields.some((field) => hasValue(record[field]));
}

export function missingPttCompletionFields(record: PttDisplayRecord) {
  const missing = [
    ...requiredTextFields.filter((field) => !hasValue(record[field])),
    ...requiredDateFields.filter((field) => !hasValue(record[field]))
  ];
  if (!hasPttSourceReference(record)) missing.push("ptcNumber");
  return missing;
}

export function pttStatus(record: PttDisplayRecord): PttStatus {
  if (!isPttMeaningfullyStarted(record)) return "Pending";
  return missingPttCompletionFields(record).length === 0 ? "Complete" : "Incomplete";
}

export function pttExportRows(records: PttDisplayRecord[]) {
  return records.map((record) => ({
    "Date Issued": formatDate(record.dateIssued),
    "PTT Number": record.pttNumber || "",
    "Duplicate PTT Number": record.pttNumberDuplicate ? "Yes" : "No",
    Name: record.transporterName || "",
    Version: record.versionName || "Uncategorized",
    "Regional Office": record.regionalOffice || "",
    "Provincial Office": record.provincialOffice || "",
    "Transporter Address": record.transporterAddress || "",
    "PTC Number": record.ptcNumber || "",
    "PCA Registration Certificate Number": record.pcaRegistrationCertificateNumber || "",
    "PCA Registration Certificate Date": formatDate(record.pcaRegistrationCertificateDate),
    "Business Address": record.businessAddress || "",
    "Board Feet Granted": formatPttNumber(record.boardFeetGranted),
    "Certificate of Quantity/Volume Attached": formatPttBoolean(record.certificateOfQuantityVolumeAttached),
    "Volume": formatPttNumber(record.volumeBoardFeet),
    Origin: record.originOfLumber || "",
    Destination: record.destination || "",
    "Consignee Name": record.consigneeName || "",
    "Consignee PCA Registration": record.consigneePcaRegistration || "",
    "Transport Type": record.transportType || "",
    "Plate/Container/Vessel Number": record.vehiclePlateNumber || "",
    "Authorized Driver Name": record.authorizedDriverName || "",
    "Authorized Driver Contact": record.authorizedDriverContact || "",
    "Amount Paid": formatFee(record.amountPaid),
    "OR Number": record.officialReceiptNumber || "",
    "Valid Until": formatDate(record.validUntil),
    "Date Validated/Inspected": formatDate(record.dateValidatedInspected),
    "Validated/Inspected By": record.validatedInspectedBy || "",
    "Issued By": record.issuedBy || "",
    Status: pttStatus(record),
    Remarks: record.remarks || "",
    "Edited By": record.editedByName || ""
  }));
}
