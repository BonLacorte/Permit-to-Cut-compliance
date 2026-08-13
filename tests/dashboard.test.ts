import { describe, expect, it } from "vitest";
import { buildDashboardData, dashboardRegionOptions, filterDashboardAuditsByRegion, topApplicationSummary, topApplicationSummaryByRegion, topMissingDocumentsByRegion } from "@/lib/dashboard";
import { auditRecord, type RecordRef, type RequiredDocumentRef } from "@/lib/reporting";

const versionId = "version-2023-2024";

const requiredDocuments: RequiredDocumentRef[] = [
  { id: "doc-a", name: "Document A", versionId, applicationTypeId: "type-a", applicationTypeName: "Type A" },
  { id: "doc-b", name: "Document B", versionId, applicationTypeId: "type-a", applicationTypeName: "Type A" },
  { id: "doc-c", name: "Document C", versionId, applicationTypeId: "type-b", applicationTypeName: "Type B" }
];

const records: RecordRef[] = [
  {
    id: "r1",
    versionId,
    versionName: "2023 and 2024",
    applicantName: "Applicant 1",
    applicationTypeId: "type-a",
    applicationTypeName: "Type A",
    regionalOffice: "Region IV-A",
    selectedDocumentIds: ["doc-a", "doc-b"],
    actualFee: "100",
    recordedFee: "100",
    replantedSeedlings: true,
    ptcNumberDuplicate: false
  },
  {
    id: "r2",
    versionId,
    versionName: "2023 and 2024",
    applicantName: "Applicant 2",
    applicationTypeId: "type-a",
    applicationTypeName: "Type A",
    regionalOffice: "Region VIII",
    selectedDocumentIds: ["doc-a"],
    actualFee: "100",
    recordedFee: "75",
    replantedSeedlings: false,
    ptcNumberDuplicate: true
  },
  {
    id: "r3",
    versionId,
    versionName: "2023 and 2024",
    applicantName: "CANCELLED",
    applicationTypeId: "type-b",
    applicationTypeName: "Type B",
    regionalOffice: "Region VIII",
    selectedDocumentIds: [],
    actualFee: null,
    recordedFee: "",
    replantedSeedlings: null,
    ptcNumberDuplicate: false
  },
  {
    id: "r4",
    versionId: null,
    versionName: "Uncategorized",
    applicantName: "Applicant 4",
    applicationTypeId: null,
    applicationTypeName: "Pending",
    regionalOffice: null,
    selectedDocumentIds: [],
    actualFee: "25",
    recordedFee: "0",
    replantedSeedlings: undefined,
    ptcNumberDuplicate: false
  }
];

const audits = records.map((record) => auditRecord(record, requiredDocuments));

describe("dashboard metrics", () => {
  it("builds regional breakdowns with share of the selected card total", () => {
    const data = buildDashboardData(audits, requiredDocuments);
    const total = data.metricRows[0].metrics.find((metric) => metric.id === "total")!;
    const complete = data.metricRows[0].metrics.find((metric) => metric.id === "complete")!;

    expect(total.total).toBe(4);
    expect(total.regions).toContainEqual({ region: "Region IV-A", count: 1, share: 0.25 });
    expect(total.regions).toContainEqual({ region: "Region VIII", count: 2, share: 0.5 });
    expect(total.regions).toContainEqual({ region: "No Region", count: 1, share: 0.25 });
    expect(complete.total).toBe(1);
    expect(complete.regions).toContainEqual({ region: "Region IV-A", count: 1, share: 1 });
    expect(complete.regions).toContainEqual({ region: "Region VIII", count: 0, share: 0 });
  });

  it("counts flags and replanted seedlings by region", () => {
    const data = buildDashboardData(audits, requiredDocuments);
    const flags = data.metricRows.find((row) => row.id === "flags")!.metrics;
    const replanted = data.metricRows.find((row) => row.id === "replanted")!.metrics;

    expect(flags.find((metric) => metric.id === "fee-mismatches")?.total).toBe(2);
    expect(flags.find((metric) => metric.id === "duplicate-ptc")?.total).toBe(1);
    expect(flags.find((metric) => metric.id === "cancelled")?.total).toBe(1);
    expect(replanted.find((metric) => metric.id === "replanted-yes")?.total).toBe(1);
    expect(replanted.find((metric) => metric.id === "replanted-no")?.total).toBe(1);
    expect(replanted.find((metric) => metric.id === "replanted-blank")).toBeUndefined();
  });

  it("totals fee variance amount in the flags row and breaks it down by region", () => {
    const data = buildDashboardData(audits, requiredDocuments);
    const flags = data.metricRows.find((row) => row.id === "flags")!.metrics;
    const feeVariance = flags.find((metric) => metric.id === "fee-variance-amount")!;

    expect(data.metricRows.find((row) => row.id === "fee-variance")).toBeUndefined();
    expect(feeVariance).toMatchObject({ id: "fee-variance-amount", label: "Fee Variance Amount", total: 50, valueType: "currency" });
    expect(feeVariance.regions).toContainEqual({ region: "Region IV-A", count: 0, share: 0 });
    expect(feeVariance.regions).toContainEqual({ region: "Region VIII", count: 25, share: 0.5 });
    expect(feeVariance.regions).toContainEqual({ region: "No Region", count: 25, share: 0.5 });
  });


  it("filters the whole dashboard by selected region", () => {
    const regionOptions = dashboardRegionOptions(audits);
    const scopedAudits = filterDashboardAuditsByRegion(audits, "Region VIII");
    const data = { ...buildDashboardData(scopedAudits, requiredDocuments), regionOptions };
    const total = data.metricRows[0].metrics.find((metric) => metric.id === "total")!;
    const complete = data.metricRows[0].metrics.find((metric) => metric.id === "complete")!;
    const missingRows = data.topMissingByRegion.All;
    const appRows = data.topApplicationsByRegion.All;

    expect(data.regionOptions).toEqual(["All", "Region IV-A", "Region VIII", "No Region"]);
    expect(total.total).toBe(2);
    expect(total.regions).toEqual([{ region: "Region VIII", count: 2, share: 1 }]);
    expect(complete.total).toBe(0);
    expect(missingRows).toEqual([
      { requiredDocumentId: "doc-b", requiredDocumentName: "Document B", missingCount: 1 },
      { requiredDocumentId: "doc-c", requiredDocumentName: "Document C", missingCount: 1 }
    ]);
    expect(appRows).toEqual([
      expect.objectContaining({ applicationTypeName: "Type A", totalRecords: 1, share: 0.5 }),
      expect.objectContaining({ applicationTypeName: "Type B", totalRecords: 1, share: 0.5 })
    ]);
  });

  it("filters the dashboard No Region bucket", () => {
    const scopedAudits = filterDashboardAuditsByRegion(audits, "No Region");
    const data = buildDashboardData(scopedAudits, requiredDocuments);
    const total = data.metricRows[0].metrics.find((metric) => metric.id === "total")!;

    expect(total.total).toBe(1);
    expect(total.regions).toEqual([{ region: "No Region", count: 1, share: 1 }]);
    expect(data.topApplicationsByRegion.All).toEqual([
      expect.objectContaining({ applicationTypeName: "Pending", totalRecords: 1, share: 1 })
    ]);
  });
  it("filters top missing documents by selected region", () => {
    const rows = topMissingDocumentsByRegion(audits, requiredDocuments);

    expect(rows.All).toEqual([
      { requiredDocumentId: "doc-b", requiredDocumentName: "Document B", missingCount: 1 },
      { requiredDocumentId: "doc-c", requiredDocumentName: "Document C", missingCount: 1 }
    ]);
    expect(rows["Region VIII"]).toEqual([
      { requiredDocumentId: "doc-b", requiredDocumentName: "Document B", missingCount: 1 },
      { requiredDocumentId: "doc-c", requiredDocumentName: "Document C", missingCount: 1 }
    ]);
    expect(rows["Region IV-A"]).toEqual([]);
  });

  it("ranks top application summary by record count", () => {
    const rows = topApplicationSummary(audits);

    expect(rows[0]).toMatchObject({ applicationTypeName: "Type A", totalRecords: 2, completeRecords: 1, incompleteRecords: 1 });
    expect(rows[1]).toMatchObject({ applicationTypeName: "Pending", totalRecords: 1, pendingRecords: 1 });
    expect(rows[2]).toMatchObject({ applicationTypeName: "Type B", totalRecords: 1, incompleteRecords: 1 });
  });

  it("filters top application summary by selected region", () => {
    const rows = topApplicationSummaryByRegion(audits);

    expect(rows.All[0]).toMatchObject({ applicationTypeName: "Type A", totalRecords: 2 });
    expect(rows["Region IV-A"]).toEqual([
      expect.objectContaining({ applicationTypeName: "Type A", totalRecords: 1, completeRecords: 1, share: 1 })
    ]);
    expect(rows["Region VIII"]).toEqual([
      expect.objectContaining({ applicationTypeName: "Type A", totalRecords: 1, incompleteRecords: 1, share: 0.5 }),
      expect.objectContaining({ applicationTypeName: "Type B", totalRecords: 1, incompleteRecords: 1, share: 0.5 })
    ]);
    expect(rows["No Region"]).toEqual([
      expect.objectContaining({ applicationTypeName: "Pending", totalRecords: 1, pendingRecords: 1, share: 1 })
    ]);
  });
});
