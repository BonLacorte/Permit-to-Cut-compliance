import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { filterDashboardAuditsByProvincialOffice, filterDashboardAuditsByRegion } from "@/lib/dashboard";
import { feesMatchDisplay, formatSignedFeeDifference } from "@/lib/ptc";
import { buildReportWorkbook } from "@/lib/excel";
import {
  auditRecord,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentSummary,
  documentCoverage,
  documentCoverageExportRows,
  applicationExportRows,
  type RecordRef,
  type RequiredDocumentRef
} from "@/lib/reporting";

const versionId = "version-2023-2024";

const requiredDocuments: RequiredDocumentRef[] = [
  { id: "a1", name: "Document A1", versionId, applicationTypeId: "appA", applicationTypeName: "Type A" },
  { id: "a2", name: "Document A2", versionId, applicationTypeId: "appA", applicationTypeName: "Type A" },
  { id: "b1", name: "Document B1", versionId, applicationTypeId: "appB", applicationTypeName: "Type B" }
];

const records: RecordRef[] = [
  {
    id: "r1",
    versionId,
    versionName: "2023 and 2024",
    applicantName: "Person A",
    applicationTypeId: "appA",
    applicationTypeName: "Type A",
    selectedDocumentIds: ["a1"]
  },
  {
    id: "r2",
    versionId,
    versionName: "2023 and 2024",
    applicantName: "Person B",
    applicationTypeId: "appA",
    applicationTypeName: "Type A",
    selectedDocumentIds: ["a1", "a2"]
  },
  {
    id: "r3",
    versionId,
    versionName: "2023 and 2024",
    applicantName: "Person C",
    applicationTypeId: "appB",
    applicationTypeName: "Type B",
    selectedDocumentIds: []
  },
  {
    id: "r4",
    versionId: null,
    versionName: "Uncategorized",
    applicantName: "Person D",
    applicationTypeId: null,
    applicationTypeName: "Pending",
    selectedDocumentIds: []
  }
];

describe("reporting logic", () => {
  it("computes required, submitted, missing, and incomplete state for a record", () => {
    const audit = auditRecord(records[0], requiredDocuments);
    expect(audit.requiredCount).toBe(2);
    expect(audit.submittedCount).toBe(1);
    expect(audit.missingCount).toBe(1);
    expect(audit.status).toBe("Incomplete");
    expect(audit.missingDocuments.map((doc) => doc.id)).toEqual(["a2"]);
  });

  it("marks a record complete when all required documents are selected", () => {
    const audit = auditRecord(records[1], requiredDocuments);
    expect(audit.status).toBe("Complete");
    expect(audit.missingDocuments).toHaveLength(0);
  });

  it("does not count deactivated documents as required or missing", () => {
    const activeDocuments = requiredDocuments.filter((doc) => doc.id !== "a2");
    const audit = auditRecord({
      id: "r5",
      versionId,
      applicantName: "Person E",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1"]
    }, activeDocuments);

    expect(audit.requiredCount).toBe(1);
    expect(audit.submittedCount).toBe(1);
    expect(audit.missingCount).toBe(0);
    expect(audit.status).toBe("Complete");
  });

  it("keeps optional documents selectable but excludes them from required counts", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Optional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "Optional" }
    ];
    const audit = auditRecord({
      id: "r6",
      versionId,
      applicantName: "Person F",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1", "a3"]
    }, documents);

    expect(audit.requiredCount).toBe(2);
    expect(audit.submittedCount).toBe(1);
    expect(audit.missingCount).toBe(1);
    expect(audit.selectedDocuments.map((doc) => doc.id)).toEqual(["a1", "a3"]);
    expect(audit.missingDocuments.map((doc) => doc.id)).toEqual(["a2"]);
  });

  it("marks records complete without selected optional documents", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Optional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "Optional" }
    ];
    const audit = auditRecord({
      id: "r7",
      versionId,
      applicantName: "Person G",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1", "a2"]
    }, documents);

    expect(audit.requiredCount).toBe(2);
    expect(audit.submittedCount).toBe(2);
    expect(audit.missingCount).toBe(0);
    expect(audit.status).toBe("Complete");
    expect(documentSummary([audit], documents).some((doc) => doc.requiredDocumentId === "a3")).toBe(false);
  });

  it("treats blank LOC Exemption as optional for conditional documents", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Conditional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "LocConditional" }
    ];
    const audit = auditRecord({
      id: "r11",
      versionId,
      applicantName: "Person K",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      locExemption: null,
      selectedDocumentIds: ["a1", "a2"]
    }, documents);

    expect(audit.status).toBe("Complete");
    expect(audit.requiredCount).toBe(2);
    expect(audit.missingDocuments.map((doc) => doc.id)).toEqual([]);
  });

  it("treats Owner LOC Exemption as optional for conditional documents", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Conditional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "LocConditional" }
    ];
    const audit = auditRecord({
      id: "r12",
      versionId,
      applicantName: "Person L",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      locExemption: "Owner",
      selectedDocumentIds: ["a1", "a2"]
    }, documents);

    expect(audit.status).toBe("Complete");
    expect(audit.requiredCount).toBe(2);
    expect(audit.missingDocuments.map((doc) => doc.id)).toEqual([]);
  });

  it("requires conditional documents when LOC Exemption is Others", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Conditional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "LocConditional" }
    ];
    const audit = auditRecord({
      id: "r13",
      versionId,
      applicantName: "Person M",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      locExemption: "Others",
      selectedDocumentIds: ["a1", "a2"]
    }, documents);

    expect(audit.status).toBe("Incomplete");
    expect(audit.requiredCount).toBe(3);
    expect(audit.missingDocuments.map((doc) => doc.id)).toEqual(["a3"]);
  });

  it("marks Others complete when conditional documents are selected", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Conditional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "LocConditional" }
    ];
    const audit = auditRecord({
      id: "r14",
      versionId,
      applicantName: "Person N",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      locExemption: "Others",
      selectedDocumentIds: ["a1", "a2", "a3"]
    }, documents);

    expect(audit.status).toBe("Complete");
    expect(audit.requiredCount).toBe(3);
    expect(audit.submittedCount).toBe(3);
  });

  it("counts conditional document summary records only when LOC Exemption is Others", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Conditional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "LocConditional" }
    ];
    const audits = [
      auditRecord({ id: "r15", versionId, applicantName: "Person O", applicationTypeId: "appA", applicationTypeName: "Type A", locExemption: null, selectedDocumentIds: ["a1", "a2"] }, documents),
      auditRecord({ id: "r16", versionId, applicantName: "Person P", applicationTypeId: "appA", applicationTypeName: "Type A", locExemption: "Owner", selectedDocumentIds: ["a1", "a2"] }, documents),
      auditRecord({ id: "r17", versionId, applicantName: "Person Q", applicationTypeId: "appA", applicationTypeName: "Type A", locExemption: "Others", selectedDocumentIds: ["a1", "a2"] }, documents),
      auditRecord({ id: "r18", versionId, applicantName: "Person R", applicationTypeId: "appA", applicationTypeName: "Type A", locExemption: "Others", selectedDocumentIds: ["a1", "a2", "a3"] }, documents)
    ];

    expect(documentSummary(audits, documents).find((doc) => doc.requiredDocumentId === "a3")).toMatchObject({
      applicationRecords: 2,
      submittedCount: 1,
      missingCount: 1
    });
  });

  it("summarizes factual document coverage separately from required missing counts", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Optional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "Optional" }
    ];
    const audits = [
      auditRecord({ id: "r20", versionId, applicantName: "Person T", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1", "a2"] }, documents),
      auditRecord({ id: "r21", versionId, applicantName: "Person U", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1", "a2", "a3"] }, documents)
    ];

    expect(documentCoverage(audits, documents).find((doc) => doc.requiredDocumentId === "a3")).toMatchObject({
      totalRecords: 2,
      withDocumentCount: 1,
      withoutDocumentCount: 1,
      coverageRate: 0.5,
      requirementMode: "Optional"
    });
    expect(documentSummary(audits, documents).some((doc) => doc.requiredDocumentId === "a3")).toBe(false);
  });

  it("supports document coverage after region and provincial office filtering", () => {
    const audits = [
      auditRecord({ id: "r22", versionId, applicantName: "Person V", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1"], regionalOffice: "Region IV-A", provincialOffice: "Quezon I" }, requiredDocuments),
      auditRecord({ id: "r23", versionId, applicantName: "Person W", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: [], regionalOffice: "Region IV-A", provincialOffice: "Quezon II" }, requiredDocuments),
      auditRecord({ id: "r24", versionId, applicantName: "Person X", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1"], regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte" }, requiredDocuments)
    ];

    const filtered = filterDashboardAuditsByProvincialOffice(filterDashboardAuditsByRegion(audits, "Region IV-A"), "Quezon I");
    expect(documentCoverage(filtered, requiredDocuments).find((doc) => doc.requiredDocumentId === "a1")).toMatchObject({
      totalRecords: 1,
      withDocumentCount: 1,
      withoutDocumentCount: 0
    });
  });

  it("exports document coverage rows by version, region, provincial office, type, and document", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Optional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "Optional" }
    ];
    const audits = [
      auditRecord({ id: "r25", versionId, versionName: "New Forms", applicantName: "Person Y", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1", "a3"], regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte", ptcNumber: "PTC-1" }, documents),
      auditRecord({ id: "r26", versionId, versionName: "New Forms", applicantName: "Person Z", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1"], regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte", ptcNumber: "PTC-2" }, documents),
      auditRecord({ id: "r27", versionId, versionName: "New Forms", applicantName: "Person AA", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: [], regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte", ptcNumber: "" }, documents),
      auditRecord({ id: "r28", versionId, versionName: "New Forms", applicantName: "Person AB", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1"], regionalOffice: "Region IV-A", provincialOffice: "Quezon I", ptcNumber: "PTC-4" }, documents)
    ];

    const filtered = filterDashboardAuditsByProvincialOffice(filterDashboardAuditsByRegion(audits, "Region XIII"), "Agusan del Norte");
    const coverageRows = documentCoverageExportRows(filtered, documents);
    expect(coverageRows.find((row) => row.Document === "Document A1")).toMatchObject({
      Version: "New Forms",
      "Regional Office": "Region XIII",
      "Provincial Office": "Agusan del Norte",
      "Type of Application": "Type A",
      Requirement: "Required",
      "Total PTCs": 3,
      "With Document": 2,
      "PTC Numbers With Document": "PTC-1, PTC-2",
      "Without Document": 1,
      "PTC Numbers Without Document": "Blank",
      "Coverage Rate": 2 / 3
    });
    expect(coverageRows.find((row) => row.Document === "Optional A3")).toMatchObject({
      Requirement: "Optional",
      "Total PTCs": 3,
      "With Document": 1,
      "Without Document": 2
    });
  });

  it("adds a Document Coverage sheet to the PTC export workbook", () => {
    const documents: RequiredDocumentRef[] = [
      ...requiredDocuments,
      { id: "a3", name: "Optional A3", versionId, applicationTypeId: "appA", applicationTypeName: "Type A", requirementMode: "Optional" }
    ];
    const audits = [
      auditRecord({ id: "r29", versionId, versionName: "New Forms", applicantName: "Person AC", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: ["a1", "a3"], regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte", ptcNumber: "PTC-5" }, documents),
      auditRecord({ id: "r30", versionId, versionName: "New Forms", applicantName: "Person AD", applicationTypeId: "appA", applicationTypeName: "Type A", selectedDocumentIds: [], regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte", ptcNumber: "PTC-6" }, documents)
    ];

    const workbook = XLSX.read(buildReportWorkbook(audits, documents), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Dashboard", "Applications", "Document Summary", "Document Coverage", "Application Summary", "Missing Documents", "Document Combinations"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Document Coverage"]);
    expect(Object.keys(rows[0])).toEqual([
      "Version",
      "Regional Office",
      "Provincial Office",
      "Type of Application",
      "Document",
      "Requirement",
      "Total PTCs",
      "With Document",
      "PTC Numbers With Document",
      "Without Document",
      "PTC Numbers Without Document",
      "Coverage Rate"
    ]);
    expect(rows.find((row) => row.Document === "Optional A3")).toMatchObject({
      "PTC Numbers With Document": "PTC-5",
      "PTC Numbers Without Document": "PTC-6"
    });
  });
  it("marks a record pending when no Version is assigned", () => {
    const audit = auditRecord({
      id: "r8",
      versionId: null,
      applicantName: "Person H",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1", "a2"]
    }, requiredDocuments);
    expect(audit.status).toBe("Pending");
    expect(audit.requiredCount).toBe(0);
    expect(audit.missingCount).toBe(0);
  });

  it("marks a record pending when no type of application is selected", () => {
    const audit = auditRecord(records[3], requiredDocuments);
    expect(audit.status).toBe("Pending");
    expect(audit.requiredCount).toBe(0);
    expect(audit.missingCount).toBe(0);
  });

  it("summarizes completion counts", () => {
    const audits = records.map((record) => auditRecord(record, requiredDocuments));
    expect(completionSummary(audits)).toMatchObject({ complete: 1, incomplete: 2, pending: 1, total: 4 });
  });

  it("summarizes applications and document counts", () => {
    const audits = records.map((record) => auditRecord(record, requiredDocuments));
    const apps = applicationSummary(audits, requiredDocuments);
    const docs = documentSummary(audits, requiredDocuments);
    expect(apps.find((app) => app.applicationTypeId === "appA")).toMatchObject({
      totalRecords: 2,
      completeRecords: 1,
      missingDocumentInstances: 1
    });
    expect(apps.find((app) => app.applicationTypeId === "")).toMatchObject({
      applicationTypeName: "Pending",
      pendingRecords: 1
    });
    expect(docs.find((doc) => doc.requiredDocumentId === "a2")).toMatchObject({
      applicationRecords: 2,
      submittedCount: 1,
      missingCount: 1
    });
  });

  it("groups document combinations by application type", () => {
    const audits = records.map((record) => auditRecord(record, requiredDocuments));
    const combos = documentCombinations(audits);
    expect(combos).toContainEqual(expect.objectContaining({
      applicationTypeName: "Type A",
      combination: "Document A1",
      size: 1,
      count: 1
    }));
    expect(combos).toContainEqual(expect.objectContaining({
      applicationTypeName: "Type B",
      combination: "No documents selected",
      size: 0,
      count: 1
    }));
  });


  it("flags records whose type belongs to a different Version", () => {
    const audit = auditRecord({
      id: "r9",
      versionId,
      applicantName: "Person I",
      applicationTypeId: "appA",
      applicationTypeVersionId: "version-2025",
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1"]
    }, requiredDocuments);

    expect(audit.status).toBe("Pending");
    expect(audit.needsVersionReview).toBe(true);
    expect(audit.versionReviewMessages).toContain("Type of Application belongs to a different Version.");
  });

  it("flags submitted documents that do not belong to the assigned Version and Type", () => {
    const audit = auditRecord({
      id: "r10",
      versionId,
      applicantName: "Person J",
      applicationTypeId: "appA",
      applicationTypeVersionId: versionId,
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1", "foreign-doc"]
    }, requiredDocuments);

    expect(audit.needsVersionReview).toBe(true);
    expect(audit.versionReviewMessages).toContain("1 submitted document do not belong to the assigned Version and Type of Application.");
  });

  it("exports nullable validity days without treating blanks as zero", () => {
    const auditWithValidity = auditRecord({
      id: "r19",
      versionId,
      versionName: "2023 and 2024",
      applicantName: "Person S",
      applicationTypeId: "appA",
      applicationTypeName: "Type A",
      selectedDocumentIds: ["a1", "a2"],
      recordedValidityDays: 10,
      actualValidityDays: null,
      officialReceiptNumber: "OR-123",
      treesApplied: 25,
      treesApproved: 20,
      seedlingsReplacement: 10,
      agriculturist: "A. Agriculturist"
    }, requiredDocuments);

    expect(applicationExportRows([auditWithValidity])[0]).toMatchObject({
      "Recorded Validity": "10",
      "Actual Validity": "",
      "Official Receipt No.": "OR-123",
      "Trees Applied": 25,
      "Trees Approved": 20,
      "Seedlings Replacement": 10,
      Agriculturist: "A. Agriculturist"
    });
  });
  it("treats blank fees as zero when comparing fees", () => {
    expect(feesMatchDisplay({ actualFee: null, recordedFee: "" })).toBe("0");
    expect(feesMatchDisplay({ actualFee: "150.50", recordedFee: "150.5" })).toBe("150.50");
    expect(feesMatchDisplay({ actualFee: "100", recordedFee: "75" })).toBe("Actual: 100 / Recorded: 75");
  });

  it("formats fee difference as recorded fee minus actual fee", () => {
    expect(formatSignedFeeDifference({ actualFee: "1000", recordedFee: "1300" })).toBe("+300");
    expect(formatSignedFeeDifference({ actualFee: "1000", recordedFee: "700" })).toBe("-300");
    expect(formatSignedFeeDifference({ actualFee: null, recordedFee: "" })).toBe("0");
  });
});


