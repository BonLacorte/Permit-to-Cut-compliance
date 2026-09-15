import * as XLSX from "xlsx";
import {
  applicationExportRows,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentCoverageExportRows,
  documentSummary,
  type RecordAudit,
  type RequiredDocumentRef
} from "@/lib/reporting";

export function buildReportWorkbook(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]) {
  const workbook = XLSX.utils.book_new();
  const completion = completionSummary(audits);
  const appSummary = applicationSummary(audits, requiredDocuments);
  const docSummary = documentSummary(audits, requiredDocuments);
  const combos = documentCombinations(audits);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Metric: "Total Records", Value: completion.total },
    { Metric: "Complete Records", Value: completion.complete },
    { Metric: "Incomplete Records", Value: completion.incomplete },
    { Metric: "Pending Records", Value: completion.pending },
    { Metric: "Completion Rate", Value: completion.completionRate }
  ]), "Dashboard");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(applicationExportRows(audits)), "Applications");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(docSummary), "Document Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(documentCoverageExportRows(audits, requiredDocuments)), "Document Coverage");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(appSummary), "Application Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(audits.filter((audit) => audit.missingCount > 0)), "Missing Documents");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(combos), "Document Combinations");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
