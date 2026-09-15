import * as XLSX from "xlsx";
import type { ParsedPtcRecord, ParsedPttRecord } from "@/lib/excel/constants";

function cellText(value: unknown) {
  return String(value ?? "").trim();
}

function parseNumberCell(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function parseDecimalCell(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return undefined;
  return Number.isFinite(Number(text)) ? text : undefined;
}

function parseBooleanCell(value: unknown) {
  const text = cellText(value).toLowerCase();
  if (["yes", "true", "1", "y"].includes(text)) return true;
  if (["no", "false", "0", "n"].includes(text)) return false;
  return undefined;
}

function parsePttValidityBasisCell(value: unknown) {
  const text = cellText(value).toLowerCase();
  if (["within the municipality", "within municipality", "municipality", "withinmunicipality"].includes(text)) return "WithinMunicipality";
  if (["within the province", "within province", "province", "withinprovince"].includes(text)) return "WithinProvince";
  if (["within the region", "within region", "region", "withinregion"].includes(text)) return "WithinRegion";
  if (["outside the region / inter-island", "outside the region", "outside region", "inter-island", "inter island", "outsideregioninterisland"].includes(text)) return "OutsideRegionInterIsland";
  return undefined;
}

function parseLocExemptionCell(value: unknown) {
  const text = cellText(value).toLowerCase();
  if (text === "owner") return "Owner";
  if (text === "others") return "Others";
  return undefined;
}

function parseDateText(value: string) {
  const slashDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    const year = Number(slashDate[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseDateCell(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : undefined;
  }
  const valueText = String(value).trim();
  return valueText ? parseDateText(valueText) : undefined;
}

export function parseGroundsWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const application = String(row["Grounds for Cutting"] || row["Type of application"] || "").trim();
    const document = String(row["Additional Documents Needed"] || row["Type of document"] || "").trim();
    if (!application || !document) continue;
    if (!map.has(application)) map.set(application, []);
    const documents = map.get(application)!;
    if (!documents.includes(document)) documents.push(document);
  }
  return Array.from(map.entries()).map(([name, documents], index) => ({
    name,
    sortOrder: index + 1,
    documents: documents.map((document, documentIndex) => ({ name: document, sortOrder: documentIndex + 1 }))
  }));
}

export function parsePtcRecordsWorkbook(buffer: Buffer): ParsedPtcRecord[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  return rows.slice(1).filter((row) => row.some((cell) => cellText(cell))).map((row) => ({
    regionalOffice: cellText(row[0]) || undefined,
    provincialOffice: cellText(row[1]) || undefined,
    ptcNumber: cellText(row[2]) || undefined,
    dateIssued: parseDateCell(row[3]),
    applicantName: cellText(row[4]) || undefined,
    barangay: cellText(row[5]) || undefined,
    municipality: cellText(row[6]) || undefined,
    treesApplied: parseNumberCell(row[7]),
    treesApproved: parseNumberCell(row[8]),
    seedlingsReplacement: parseNumberCell(row[9]),
    applicationTypeName: cellText(row[10]) || undefined,
    locExemption: parseLocExemptionCell(row[11])
  }));
}

export function parsePttRecordsWorkbook(buffer: Buffer): ParsedPttRecord[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  return rows.slice(1).filter((row) => row.some((cell) => cellText(cell))).map((row) => ({
    regionalOffice: cellText(row[0]) || undefined,
    provincialOffice: cellText(row[1]) || undefined,
    pttNumber: cellText(row[2]) || undefined,
    dateIssued: parseDateCell(row[3]),
    transporterName: cellText(row[4]) || undefined,
    transporterAddress: cellText(row[5]) || undefined,
    ptcNumber: cellText(row[6]) || undefined,
    pcaRegistrationCertificateNumber: cellText(row[7]) || undefined,
    pcaRegistrationCertificateDate: parseDateCell(row[8]),
    businessAddress: cellText(row[9]) || undefined,
    boardFeetGranted: parseDecimalCell(row[10]),
    certificateOfQuantityVolumeAttached: parseBooleanCell(row[11]),
    volumeBoardFeet: parseDecimalCell(row[12]),
    originOfLumber: cellText(row[13]) || undefined,
    destination: cellText(row[14]) || undefined,
    consigneeName: cellText(row[15]) || undefined,
    consigneePcaRegistration: cellText(row[16]) || undefined,
    transportType: cellText(row[17]) || undefined,
    vehiclePlateNumber: cellText(row[18]) || undefined,
    authorizedDriverName: cellText(row[19]) || undefined,
    authorizedDriverContact: cellText(row[20]) || undefined,
    amountPaid: parseDecimalCell(row[21]),
    actualFee: parseDecimalCell(row[22]),
    officialReceiptNumber: cellText(row[23]) || undefined,
    validityBasis: parsePttValidityBasisCell(row[24]),
    recordedValidityDays: parseNumberCell(row[25]),
    actualValidityDays: parseNumberCell(row[26]),
    dateValidatedInspected: parseDateCell(row[27]),
    validatedInspectedBy: cellText(row[28]) || undefined,
    issuedByDate: parseDateCell(row[29]),
    issuedBy: cellText(row[30]) || undefined,
    remarks: cellText(row[31]) || undefined
  }));
}
