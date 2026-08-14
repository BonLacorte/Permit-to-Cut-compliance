import { describe, expect, it } from "vitest";
import { feesMatchDisplay, formatSignedFeeDifference } from "@/lib/ptc";
import {
  auditRecord,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentSummary,
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
      officialReceiptNumber: "OR-123"
    }, requiredDocuments);

    expect(applicationExportRows([auditWithValidity])[0]).toMatchObject({
      "Recorded Validity": "10",
      "Actual Validity": "",
      "Official Receipt No.": "OR-123"
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

