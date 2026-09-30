import { decimalOrZero } from "@/lib/ptc";
import { pttProvincialOfficeName, pttRegionName, pttStatus, type PttDisplayRecord } from "@/lib/ptt";

export const PTT_DASHBOARD_METRIC_IDS = [
  "total",
  "complete",
  "pending",
  "duplicate-ptt",
  "fee-mismatches",
  "fee-variance-amount",
  "validity-mismatches",
  "vehicle-capacity-issues"
] as const;

export type PttDashboardMetricId = typeof PTT_DASHBOARD_METRIC_IDS[number];

export type PttDashboardRecord = PttDisplayRecord & {
  id: string;
  pttNumberDuplicate?: boolean;
  checkFindings?: Array<{ active?: boolean; checkType: string }>;
};

export type PttDashboardMetric = {
  id: PttDashboardMetricId;
  label: string;
  total: number;
  share: number;
  regions: Array<{ region: string; count: number; share: number }>;
  valueType?: "count" | "currency";
};

export type PttDashboardOfficeBreakdown = {
  region: string;
  count: number;
  provincialOffices: Array<{ provincialOffice: string; count: number }>;
};

export type PttDashboardData = {
  metricRows: Array<{ id: string; metrics: PttDashboardMetric[] }>;
  officeBreakdown: PttDashboardOfficeBreakdown[];
};

export const pttDashboardMetricOptions: Array<{ id: PttDashboardMetricId; label: string }> = [
  { id: "total", label: "Total PTT Records" },
  { id: "complete", label: "Complete Records" },
  { id: "pending", label: "Pending Records" },
  { id: "duplicate-ptt", label: "Duplicate PTT Numbers" },
  { id: "fee-mismatches", label: "Fee Mismatches" },
  { id: "fee-variance-amount", label: "Fee Variance Amount (Fee Mismatches)" },
  { id: "validity-mismatches", label: "Validity Mismatches" },
  { id: "vehicle-capacity-issues", label: "Vehicle Capacity Issues" }
];

function hasActiveFinding(record: PttDashboardRecord, checkType: "Fee" | "Validity" | "Vehicle") {
  return record.checkFindings?.some((finding) => finding.checkType === checkType && finding.active !== false) || false;
}

function feeVariance(record: PttDashboardRecord) {
  return Math.abs(decimalOrZero(record.amountPaid) - decimalOrZero(record.actualFee));
}

const pttDashboardMetricPredicates: Record<PttDashboardMetricId, (record: PttDashboardRecord) => boolean> = {
  total: () => true,
  complete: (record) => pttStatus(record) === "Complete",
  pending: (record) => pttStatus(record) === "Pending",
  "duplicate-ptt": (record) => Boolean(record.pttNumberDuplicate),
  "fee-mismatches": (record) => hasActiveFinding(record, "Fee"),
  "fee-variance-amount": (record) => hasActiveFinding(record, "Fee"),
  "validity-mismatches": (record) => hasActiveFinding(record, "Validity"),
  "vehicle-capacity-issues": (record) => hasActiveFinding(record, "Vehicle")
};

export function resolvePttDashboardMetric(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PTT_DASHBOARD_METRIC_IDS.includes(candidate as PttDashboardMetricId) ? candidate as PttDashboardMetricId : "total";
}

export function filterPttRecordsByDashboardMetric<T extends PttDashboardRecord>(records: T[], metric: PttDashboardMetricId) {
  return records.filter(pttDashboardMetricPredicates[metric]);
}

export function pttDashboardApplicationsHref({ version, region, provincialOffice, metric }: { version: string; region: string; provincialOffice?: string; metric: PttDashboardMetricId }) {
  const params = new URLSearchParams();
  params.set("version", version);
  if (region !== "All") params.set("region", region);
  if (provincialOffice && provincialOffice !== "All") params.set("provincialOffice", provincialOffice);
  if (metric !== "total") params.set("metric", metric);
  return `/ptt/applications?${params.toString()}`;
}

function metricShare(value: number, total: number) {
  return total === 0 ? 0 : value / total;
}

function regionsFor(records: PttDashboardRecord[]) {
  return Array.from(new Set(records.map(pttRegionName))).sort((left, right) => {
    if (left === "No Region") return 1;
    if (right === "No Region") return -1;
    return left.localeCompare(right);
  });
}

function metricRegions(records: PttDashboardRecord[], regions: string[], predicate: (record: PttDashboardRecord) => boolean, amount?: (record: PttDashboardRecord) => number) {
  const values = regions.map((region) => ({
    region,
    count: records.filter((record) => pttRegionName(record) === region && predicate(record)).reduce((sum, record) => sum + (amount ? amount(record) : 1), 0)
  }));
  const total = values.reduce((sum, region) => sum + region.count, 0);
  return values.map((region) => ({ ...region, share: metricShare(region.count, total) }));
}

function countMetric(id: PttDashboardMetricId, records: PttDashboardRecord[], regions: string[]): PttDashboardMetric {
  const predicate = pttDashboardMetricPredicates[id];
  const total = records.filter(predicate).length;
  return {
    id,
    label: pttDashboardMetricOptions.find((metric) => metric.id === id)!.label,
    total,
    share: metricShare(total, records.length),
    regions: metricRegions(records, regions, predicate)
  };
}

function feeVarianceMetric(records: PttDashboardRecord[], regions: string[]): PttDashboardMetric {
  const predicate = pttDashboardMetricPredicates["fee-variance-amount"];
  const total = records.filter(predicate).reduce((sum, record) => sum + feeVariance(record), 0);
  return {
    id: "fee-variance-amount",
    label: pttDashboardMetricOptions.find((metric) => metric.id === "fee-variance-amount")!.label,
    total,
    share: total === 0 ? 0 : 1,
    regions: metricRegions(records, regions, predicate, feeVariance),
    valueType: "currency"
  };
}

export function pttOfficeBreakdown(records: PttDashboardRecord[]): PttDashboardOfficeBreakdown[] {
  return regionsFor(records).map((region) => {
    const regionalRecords = records.filter((record) => pttRegionName(record) === region);
    const provincialOffices = Array.from(new Set(regionalRecords.map(pttProvincialOfficeName)))
      .sort((left, right) => {
        if (left === "No Provincial Office") return 1;
        if (right === "No Provincial Office") return -1;
        return left.localeCompare(right);
      })
      .map((provincialOffice) => ({
        provincialOffice,
        count: regionalRecords.filter((record) => pttProvincialOfficeName(record) === provincialOffice).length
      }));
    return { region, count: regionalRecords.length, provincialOffices };
  });
}

export function buildPttDashboardData(records: PttDashboardRecord[]): PttDashboardData {
  const regions = regionsFor(records);
  return {
    metricRows: [
      { id: "status", metrics: [countMetric("total", records, regions), countMetric("complete", records, regions), countMetric("pending", records, regions), countMetric("duplicate-ptt", records, regions)] },
      { id: "checkers", metrics: [countMetric("fee-mismatches", records, regions), feeVarianceMetric(records, regions), countMetric("validity-mismatches", records, regions), countMetric("vehicle-capacity-issues", records, regions)] }
    ],
    officeBreakdown: pttOfficeBreakdown(records)
  };
}
