import * as XLSX from "xlsx";
import { pttDocumentSummaryRows, pttExportRows, type PttDisplayRecord } from "@/lib/ptt";

export function buildPttApplicationsWorkbook(records: PttDisplayRecord[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pttExportRows(records)), "PTT Applications");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pttDocumentSummaryRows(records)), "Document Summary");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
