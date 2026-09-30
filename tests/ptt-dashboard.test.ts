import { describe, expect, it } from "vitest";
import { buildPttDashboardData, filterPttRecordsByDashboardMetric, pttDashboardApplicationsHref, pttOfficeBreakdown, resolvePttDashboardMetric, type PttDashboardRecord } from "@/lib/ptt-dashboard";

const complete: PttDashboardRecord = {
  id: "complete",
  pttNumber: "100",
  dateIssued: new Date("2026-09-01T00:00:00.000Z"),
  regionalOffice: "Region IV-A",
  provincialOffice: "Quezon I",
  transporterName: "Transporter A",
  ptcNumber: "PTC-100",
  volumeBoardFeet: "1000",
  originOfLumber: "Origin",
  destination: "Destination",
  transportType: "Ten Wheeler",
  vehiclePlateNumber: "ABC-123",
  amountPaid: "300",
  actualFee: "300",
  officialReceiptNumber: "OR-1",
  recordedValidityDays: 3,
  issuedBy: "Issuer"
};

const records: PttDashboardRecord[] = [
  complete,
  { ...complete, id: "pending", pttNumber: "", dateIssued: null, regionalOffice: null, provincialOffice: null, transporterName: "", ptcNumber: "", volumeBoardFeet: null, originOfLumber: "", destination: "", transportType: "", vehiclePlateNumber: "", amountPaid: null, actualFee: null, officialReceiptNumber: "", recordedValidityDays: null, issuedBy: "" },
  { ...complete, id: "incomplete", pttNumber: "200", transporterName: "Started", regionalOffice: "Region VIII", provincialOffice: "Leyte", amountPaid: "" },
  { ...complete, id: "duplicate", pttNumber: "100", pttNumberDuplicate: true, regionalOffice: "Region VIII", provincialOffice: "Leyte" },
  { ...complete, id: "fee", pttNumber: "300", pttNumberDuplicate: true, amountPaid: "100", actualFee: "130", checkFindings: [{ checkType: "Fee", active: true }] },
  { ...complete, id: "validity", pttNumber: "400", regionalOffice: "Region VIII", provincialOffice: "Leyte", checkFindings: [{ checkType: "Validity", active: true }] },
  { ...complete, id: "vehicle", pttNumber: "500", regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte", checkFindings: [{ checkType: "Vehicle", active: true }] },
  { ...complete, id: "resolved-fee", pttNumber: "600", checkFindings: [{ checkType: "Fee", active: false }] }
];

describe("PTT dashboard", () => {
  it("filters every dashboard view from status, duplicate, and active checker findings", () => {
    expect(filterPttRecordsByDashboardMetric(records, "total").map((record) => record.id)).toEqual(records.map((record) => record.id));
    expect(filterPttRecordsByDashboardMetric(records, "complete").map((record) => record.id)).toEqual(["complete", "duplicate", "fee", "validity", "vehicle", "resolved-fee"]);
    expect(filterPttRecordsByDashboardMetric(records, "pending").map((record) => record.id)).toEqual(["pending"]);
    expect(filterPttRecordsByDashboardMetric(records, "duplicate-ptt").map((record) => record.id)).toEqual(["duplicate", "fee"]);
    expect(filterPttRecordsByDashboardMetric(records, "fee-mismatches").map((record) => record.id)).toEqual(["fee"]);
    expect(filterPttRecordsByDashboardMetric(records, "validity-mismatches").map((record) => record.id)).toEqual(["validity"]);
    expect(filterPttRecordsByDashboardMetric(records, "vehicle-capacity-issues").map((record) => record.id)).toEqual(["vehicle"]);
  });

  it("reports absolute Fee Variance only for active Fee findings", () => {
    const dashboard = buildPttDashboardData(records);
    const variance = dashboard.metricRows[1].metrics.find((metric) => metric.id === "fee-variance-amount")!;

    expect(variance).toMatchObject({ total: 30, valueType: "currency", share: 1 });
    expect(variance.regions).toContainEqual({ region: "Region IV-A", count: 30, share: 1 });
  });

  it("builds Region and Provincial Office breakdowns including blank offices", () => {
    const offices = pttOfficeBreakdown(records);

    expect(offices.find((region) => region.region === "Region VIII")).toMatchObject({
      count: 3,
      provincialOffices: [{ provincialOffice: "Leyte", count: 3 }]
    });
    expect(offices.find((region) => region.region === "No Region")).toMatchObject({
      count: 1,
      provincialOffices: [{ provincialOffice: "No Provincial Office", count: 1 }]
    });
  });

  it("validates metric parameters and preserves Version, Region, Provincial Office, and metric in Applications links", () => {
    expect(resolvePttDashboardMetric()).toBe("total");
    expect(resolvePttDashboardMetric("not-a-metric")).toBe("total");
    expect(resolvePttDashboardMetric(["vehicle-capacity-issues", "pending"])).toBe("vehicle-capacity-issues");
    expect(pttDashboardApplicationsHref({ version: "PTT 2026", region: "Region VIII", provincialOffice: "Leyte", metric: "vehicle-capacity-issues" }))
      .toBe("/ptt/applications?version=PTT+2026&region=Region+VIII&provincialOffice=Leyte&metric=vehicle-capacity-issues");
    expect(pttDashboardApplicationsHref({ version: "PTT-2026", region: "All", metric: "total" }))
      .toBe("/ptt/applications?version=PTT-2026");
  });
});
