import * as XLSX from "xlsx";
import { applicationSummary, completionSummary, documentCombinations, documentSummary, type RecordAudit, type RequiredDocumentRef } from "@/lib/reporting";

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

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      audits.map((audit) => ({
        Name: audit.applicantName,
        "Type of application": audit.applicationTypeName,
        "Selected Documents": audit.selectedDocuments.map((doc) => doc.name).join(", "),
        "Missing Count": audit.missingCount,
        "Missing Documents": audit.missingDocuments.map((doc) => doc.name).join(", "),
        Status: audit.status
      }))
    ),
    "Applications"
  );

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
