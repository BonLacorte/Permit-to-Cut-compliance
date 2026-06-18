import * as XLSX from "xlsx";
import { applicationSummary, completionSummary, documentCombinations, documentSummary, applicationExportRows, type RecordAudit, type RequiredDocumentRef } from "@/lib/reporting";

export type ParsedPtcRecord = {
  regionalOffice?: string;
  provincialOffice?: string;
  ptcNumber?: string;
  dateIssued?: Date;
  applicantName?: string;
  barangay?: string;
  municipality?: string;
  treesApplied?: number;
  treesApproved?: number;
  seedlingsReplacement?: number;
};

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
    const list = map.get(application)!;
    if (!list.includes(document)) list.push(document);
  }

  return Array.from(map.entries()).map(([name, documents], index) => ({
    name,
    sortOrder: index + 1,
    documents: documents.map((document, docIndex) => ({ name: document, sortOrder: docIndex + 1 }))
  }));
}

function cellText(value: unknown) {
  return String(value ?? "").trim();
}

function parseNumberCell(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function parseDateCell(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const text = String(value).trim();
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parsePtcRecordsWorkbook(buffer: Buffer): ParsedPtcRecord[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  return rows.slice(1).map((row) => ({
    regionalOffice: cellText(row[0]) || undefined,
    provincialOffice: cellText(row[1]) || undefined,
    ptcNumber: cellText(row[2]) || undefined,
    dateIssued: parseDateCell(row[3]),
    applicantName: cellText(row[4]) || undefined,
    barangay: cellText(row[5]) || undefined,
    municipality: cellText(row[6]) || undefined,
    treesApplied: parseNumberCell(row[7]),
    treesApproved: parseNumberCell(row[8]),
    seedlingsReplacement: parseNumberCell(row[9])
  }));
}

export function buildReportWorkbook(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]) {
  const workbook = XLSX.utils.book_new();
  const completion = completionSummary(audits);
  const appSummary = applicationSummary(audits, requiredDocuments);
  const docSummary = documentSummary(audits, requiredDocuments);
  const combos = documentCombinations(audits);

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      { Metric: "Total Records", Value: completion.total },
      { Metric: "Complete Records", Value: completion.complete },
      { Metric: "Incomplete Records", Value: completion.incomplete },
      { Metric: "Completion Rate", Value: completion.completionRate }
    ]),
    "Dashboard"
  );

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(applicationExportRows(audits)), "Applications");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(docSummary), "Document Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(appSummary), "Application Summary");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(audits.filter((audit) => audit.missingCount > 0)),
    "Missing Documents"
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(combos), "Document Combinations");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}