import * as XLSX from "xlsx";
import { PTC_IMPORT_COLUMNS, PTT_IMPORT_COLUMNS } from "@/lib/excel/constants";

function buildTemplate(columns: readonly string[], sheetName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[...columns]]), sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildPttImportTemplateWorkbook() {
  return buildTemplate(PTT_IMPORT_COLUMNS, "PTT Import");
}

export function buildPtcImportTemplateWorkbook() {
  return buildTemplate(PTC_IMPORT_COLUMNS, "PTC Import");
}
