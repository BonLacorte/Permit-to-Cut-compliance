import { describe, expect, it } from "vitest";
import {
  auditRecord,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentSummary,
  type RecordRef,
  type RequiredDocumentRef
} from "@/lib/reporting";

const requiredDocuments: RequiredDocumentRef[] = [
  { id: "a1", name: "Document A1", applicationTypeId: "appA", applicationTypeName: "Type A" },
  { id: "a2", name: "Document A2", applicationTypeId: "appA", applicationTypeName: "Type A" },
  { id: "b1", name: "Document B1", applicationTypeId: "appB", applicationTypeName: "Type B" }
];

const records: RecordRef[] = [
  {
    id: "r1",
    applicantName: "Person A",
    applicationTypeId: "appA",
    applicationTypeName: "Type A",
    selectedDocumentIds: ["a1"]
  },
  {
    id: "r2",
    applicantName: "Person B",
    applicationTypeId: "appA",
    applicationTypeName: "Type A",
    selectedDocumentIds: ["a1", "a2"]
  },
  {
    id: "r3",
    applicantName: "Person C",
    applicationTypeId: "appB",
    applicationTypeName: "Type B",
    selectedDocumentIds: []
  }
];

describe("reporting logic", () => {
  it("computes required, submitted, missing, and completion state for a record", () => {
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

  it("summarizes completion counts", () => {
    const audits = records.map((record) => auditRecord(record, requiredDocuments));
    expect(completionSummary(audits)).toMatchObject({ complete: 1, incomplete: 2, total: 3 });
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
});
