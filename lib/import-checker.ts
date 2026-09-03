import * as XLSX from "xlsx";
import { parsePtcRecordsWorkbook, parsePttRecordsWorkbook, PTC_IMPORT_COLUMNS, PTT_IMPORT_COLUMNS } from "@/lib/excel";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

export type ImportGroup = "PTC" | "PTT";
export type ImportIssueSeverity = "Error" | "Warning";

export type ImportPreviewIssue = {
  row: number;
  field: string;
  severity: ImportIssueSeverity;
  message: string;
  value: string;
};

export type ImportPreviewResult = {
  group: ImportGroup;
  rowsChecked: number;
  readyRows: number;
  errorCount: number;
  warningCount: number;
  issues: ImportPreviewIssue[];
};

export type OfficeImportChoice = {
  name: string;
  provincialOffices: Array<{ name: string }>;
};

export type PtcImportCheckContext = {
  versionId: string | null;
  applicationTypeNames: string[];
  existingPtcNumbers: string[];
  officeChoices: OfficeImportChoice[];
};

export type PttImportCheckContext = {
  versionId: string | null;
  transportTypes: string[];
  existingPttNumbers: string[];
  officeChoices: OfficeImportChoice[];
};

type RawWorkbook = {
  headers: string[];
  rows: unknown[][];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function readRawWorkbook(buffer: Buffer): RawWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a first sheet.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (rows.length === 0) throw new Error("The first sheet is empty.");
  return { headers: rows[0].map(text), rows: rows.slice(1) };
}

function nonBlankRows(rows: unknown[][]) {
  return rows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((cell) => text(cell)));
}

function dateTextIsValid(value: string) {
  const slashDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    const year = Number(slashDate[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function dateIsValid(value: unknown) {
  if (!text(value)) return true;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return Boolean(XLSX.SSF.parse_date_code(value));
  return dateTextIsValid(text(value));
}

function numberIsValid(value: unknown) {
  if (!text(value)) return true;
  const parsed = Number(text(value).replace(/,/g, ""));
  return Number.isFinite(parsed);
}

function booleanIsValid(value: unknown) {
  if (!text(value)) return true;
  return ["yes", "true", "1", "y", "no", "false", "0", "n"].includes(normalized(value));
}

function locExemptionIsValid(value: unknown) {
  if (!text(value)) return true;
  return ["owner", "others"].includes(normalized(value));
}

function pttValidityBasisIsValid(value: unknown) {
  if (!text(value)) return true;
  return [
    "within the municipality",
    "within municipality",
    "municipality",
    "withinmunicipality",
    "within the province",
    "within province",
    "province",
    "withinprovince",
    "within the region",
    "within region",
    "region",
    "withinregion",
    "outside the region / inter-island",
    "outside the region",
    "outside region",
    "inter-island",
    "inter island",
    "outsideregioninterisland"
  ].includes(normalized(value));
}

function issue(row: number, field: string, severity: ImportIssueSeverity, message: string, value: unknown): ImportPreviewIssue {
  return { row, field, severity, message, value: text(value) };
}

function validateHeaders(headers: string[], expected: readonly string[]) {
  const issues: ImportPreviewIssue[] = [];
  expected.forEach((column, index) => {
    if (normalized(headers[index]) !== normalized(column)) {
      issues.push(issue(1, column, "Error", `Expected "${column}" at column ${index + 1}.`, headers[index] || "Blank"));
    }
  });
  headers.slice(expected.length).forEach((column, index) => {
    if (text(column)) {
      issues.push(issue(1, column, "Warning", "This extra column will be ignored by the import.", column));
    }
  });
  return issues;
}

function officeIssues(rowNumber: number, regionalOffice: unknown, provincialOffice: unknown, choices: OfficeImportChoice[]) {
  const issues: ImportPreviewIssue[] = [];
  const region = text(regionalOffice);
  const province = text(provincialOffice);
  const regionChoice = choices.find((choice) => normalized(choice.name) === normalized(region));
  const allProvinceChoices = choices.flatMap((choice) => choice.provincialOffices.map((office) => ({ ...office, regionName: choice.name })));
  const provinceChoice = allProvinceChoices.find((office) => normalized(office.name) === normalized(province));

  if (region && !regionChoice) {
    issues.push(issue(rowNumber, "Regional Office", "Warning", "Regional Office is not in active master data.", regionalOffice));
  }
  if (province && !provinceChoice) {
    issues.push(issue(rowNumber, "Provincial Office", "Warning", "Provincial Office is not in active master data.", provincialOffice));
  }
  if (regionChoice && province && !regionChoice.provincialOffices.some((office) => normalized(office.name) === normalized(province))) {
    issues.push(issue(rowNumber, "Provincial Office", "Warning", "Provincial Office does not belong to the selected Regional Office.", provincialOffice));
  }
  return issues;
}

function duplicateIssues(rowNumber: number, field: string, value: unknown, existing: Set<string>, seen: Map<string, number>) {
  const number = normalized(value);
  if (!number) return [];
  const issues: ImportPreviewIssue[] = [];
  if (existing.has(number)) {
    issues.push(issue(rowNumber, field, "Warning", `${field} already exists in the database and will be flagged as duplicate.`, value));
  }
  const firstRow = seen.get(number);
  if (firstRow) {
    issues.push(issue(rowNumber, field, "Warning", `${field} is duplicated inside this workbook. First seen on row ${firstRow}.`, value));
  } else {
    seen.set(number, rowNumber);
  }
  return issues;
}

function finish(group: ImportGroup, rowsChecked: number, issues: ImportPreviewIssue[]): ImportPreviewResult {
  const rowErrors = new Set(issues.filter((item) => item.severity === "Error" && item.row > 1).map((item) => item.row));
  const headerHasError = issues.some((item) => item.severity === "Error" && item.row === 1);
  const errorCount = issues.filter((item) => item.severity === "Error").length;
  const warningCount = issues.filter((item) => item.severity === "Warning").length;
  return {
    group,
    rowsChecked,
    readyRows: headerHasError ? 0 : Math.max(0, rowsChecked - rowErrors.size),
    errorCount,
    warningCount,
    issues
  };
}

export function checkPtcImportWorkbook(buffer: Buffer, context: PtcImportCheckContext): ImportPreviewResult {
  const raw = readRawWorkbook(buffer);
  const rows = nonBlankRows(raw.rows);
  const parsed = parsePtcRecordsWorkbook(buffer);
  const issues = validateHeaders(raw.headers, PTC_IMPORT_COLUMNS);
  const existing = new Set(context.existingPtcNumbers.map(normalized).filter(Boolean));
  const seen = new Map<string, number>();
  const typeNames = new Set(context.applicationTypeNames.map(normalized).filter(Boolean));

  rows.forEach(({ row, rowNumber }, index) => {
    if (!dateIsValid(row[3])) issues.push(issue(rowNumber, "Date Issued", "Error", "Invalid date value.", row[3]));
    [7, 8, 9].forEach((columnIndex) => {
      if (!numberIsValid(row[columnIndex])) issues.push(issue(rowNumber, PTC_IMPORT_COLUMNS[columnIndex], "Error", "Invalid numeric value.", row[columnIndex]));
    });
    if (!locExemptionIsValid(row[11])) issues.push(issue(rowNumber, "LOC Exemption", "Error", "Use Owner, Others, or leave it blank.", row[11]));

    issues.push(...duplicateIssues(rowNumber, "PTC Number", row[2], existing, seen));
    issues.push(...officeIssues(rowNumber, row[0], row[1], context.officeChoices));

    const typeName = parsed[index]?.applicationTypeName || text(row[10]);
    if (typeName && context.versionId && context.versionId !== UNCATEGORIZED_VERSION && !typeNames.has(normalized(typeName))) {
      issues.push(issue(rowNumber, "Type of Application", "Warning", "Type of Application was not found in the selected Version; the imported row will have no matched type.", typeName));
    }
    if (typeName && !context.versionId) {
      issues.push(issue(rowNumber, "Type of Application", "Warning", "Type of Application cannot be matched while importing into Uncategorized.", typeName));
    }
  });

  return finish("PTC", rows.length, issues);
}

export function checkPttImportWorkbook(buffer: Buffer, context: PttImportCheckContext): ImportPreviewResult {
  const raw = readRawWorkbook(buffer);
  const rows = nonBlankRows(raw.rows);
  const parsed = parsePttRecordsWorkbook(buffer);
  const issues = validateHeaders(raw.headers, PTT_IMPORT_COLUMNS);
  const existing = new Set(context.existingPttNumbers.map(normalized).filter(Boolean));
  const seen = new Map<string, number>();
  const transportTypes = new Set(context.transportTypes.map(normalized).filter(Boolean));

  if (!context.versionId) {
    issues.push(issue(1, "Import PTT Version", "Error", "Choose a PTT Version before checking or importing PTT records.", "Blank"));
  }

  rows.forEach(({ row, rowNumber }, index) => {
    [3, 8, 27, 29].forEach((columnIndex) => {
      if (!dateIsValid(row[columnIndex])) issues.push(issue(rowNumber, PTT_IMPORT_COLUMNS[columnIndex], "Error", "Invalid date value.", row[columnIndex]));
    });
    [10, 12, 21, 22].forEach((columnIndex) => {
      if (!numberIsValid(row[columnIndex])) issues.push(issue(rowNumber, PTT_IMPORT_COLUMNS[columnIndex], "Error", "Invalid numeric value.", row[columnIndex]));
    });
    [25, 26].forEach((columnIndex) => {
      if (!numberIsValid(row[columnIndex])) issues.push(issue(rowNumber, PTT_IMPORT_COLUMNS[columnIndex], "Error", "Invalid whole-day number.", row[columnIndex]));
    });
    if (!booleanIsValid(row[11])) issues.push(issue(rowNumber, "Certificate of Quantity/Volume Attached", "Error", "Use Yes, No, True, False, or leave it blank.", row[11]));
    if (!pttValidityBasisIsValid(row[24])) issues.push(issue(rowNumber, "Validity Basis", "Error", "Use a supported PTT validity basis or leave it blank.", row[24]));

    issues.push(...duplicateIssues(rowNumber, "PTT Number", row[2], existing, seen));
    issues.push(...officeIssues(rowNumber, row[0], row[1], context.officeChoices));

    const transportType = parsed[index]?.transportType || text(row[17]);
    if (transportType && context.versionId && !transportTypes.has(normalized(transportType))) {
      issues.push(issue(rowNumber, "Type of Transport Used", "Warning", "Transport type is not in active master data for the selected PTT Version, but it can still be saved as text.", transportType));
    }
  });

  return finish("PTT", rows.length, issues);
}
