import { decimalOrZero, feesMatch, isCancelledRecord } from "@/lib/ptc";
import type { RecordAudit, RequiredDocumentRef } from "@/lib/reporting";

export type DashboardRegionBreakdown = {
  region: string;
  count: number;
  share: number;
};

export const DASHBOARD_METRIC_IDS = [
  "total",
  "complete",
  "incomplete",
  "pending",
  "fee-mismatches",
  "fee-variance-amount",
  "duplicate-ptc",
  "cancelled",
  "replanted-yes",
  "replanted-no"
] as const;

export type DashboardMetricId = typeof DASHBOARD_METRIC_IDS[number];

export const dashboardMetricOptions: Array<{ id: DashboardMetricId; label: string }> = [
  { id: "total", label: "Total Records" },
  { id: "complete", label: "Complete Records" },
  { id: "incomplete", label: "Incomplete Records" },
  { id: "pending", label: "Pending Records" },
  { id: "fee-mismatches", label: "Fee Mismatches" },
  { id: "fee-variance-amount", label: "Fee Variance Amount (Fee Mismatches)" },
  { id: "duplicate-ptc", label: "Duplicate PTC Numbers" },
  { id: "cancelled", label: "Cancelled Applications" },
  { id: "replanted-yes", label: "Replanted Seedlings: Yes" },
  { id: "replanted-no", label: "Replanted Seedlings: No" }
];

export type DashboardMetric = {
  id: DashboardMetricId;
  label: string;
  total: number;
  share: number;
  regions: DashboardRegionBreakdown[];
  valueType?: "count" | "currency";
};

export type DashboardMetricRow = {
  id: string;
  metrics: DashboardMetric[];
};

export type DashboardMissingDocumentRow = {
  requiredDocumentId: string;
  requiredDocumentName: string;
  missingCount: number;
};

export type DashboardApplicationSummaryRow = {
  applicationTypeId: string;
  applicationTypeName: string;
  totalRecords: number;
  completeRecords: number;
  incompleteRecords: number;
  pendingRecords: number;
  share: number;
};

export type DashboardData = {
  totalRecords: number;
  metricRows: DashboardMetricRow[];
  regionOptions: string[];
  topMissingByRegion: Record<string, DashboardMissingDocumentRow[]>;
  topApplicationsByRegion: Record<string, DashboardApplicationSummaryRow[]>;
};

const ALL_REGIONS = "All";
const NO_REGION = "No Region";
const NO_PROVINCIAL_OFFICE = "No Provincial Office";

const dashboardMetricPredicates: Record<DashboardMetricId, (audit: RecordAudit) => boolean> = {
  total: () => true,
  complete: (audit) => audit.status === "Complete",
  incomplete: (audit) => audit.status === "Incomplete",
  pending: (audit) => audit.status === "Pending",
  "fee-mismatches": (audit) => !feesMatch(audit),
  "fee-variance-amount": (audit) => !feesMatch(audit),
  "duplicate-ptc": (audit) => !!audit.ptcNumberDuplicate,
  cancelled: (audit) => isCancelledRecord(audit),
  "replanted-yes": (audit) => audit.replantedSeedlings === true,
  "replanted-no": (audit) => audit.replantedSeedlings === false
};

export function resolveDashboardMetric(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return DASHBOARD_METRIC_IDS.includes(candidate as DashboardMetricId) ? candidate as DashboardMetricId : "total";
}

export function filterDashboardAuditsByMetric(audits: RecordAudit[], metric: DashboardMetricId) {
  return audits.filter(dashboardMetricPredicates[metric]);
}

export function dashboardApplicationsHref({ version, region, provincialOffice, metric }: { version: string; region: string; provincialOffice?: string; metric: DashboardMetricId }) {
  const params = new URLSearchParams();
  params.set("version", version);
  if (region !== ALL_REGIONS) params.set("region", region);
  if (provincialOffice && provincialOffice !== ALL_REGIONS) params.set("provincialOffice", provincialOffice);
  if (metric !== "total") params.set("metric", metric);
  return `/ptc/applications?${params.toString()}`;
}

export function dashboardRegionName(record: Pick<RecordAudit, "regionalOffice">) {
  return String(record.regionalOffice || "").trim() || NO_REGION;
}

export function dashboardProvincialOfficeName(record: Pick<RecordAudit, "provincialOffice">) {
  return String(record.provincialOffice || "").trim() || NO_PROVINCIAL_OFFICE;
}

function metricShare(count: number, total: number) {
  return total === 0 ? 0 : count / total;
}

function uniqueRegions(audits: RecordAudit[]) {
  return Array.from(new Set(audits.map(dashboardRegionName))).sort((a, b) => {
    if (a === NO_REGION) return 1;
    if (b === NO_REGION) return -1;
    return a.localeCompare(b);
  });
}

function regionalBreakdown(audits: RecordAudit[], regions: string[], predicate: (audit: RecordAudit) => boolean) {
  const counts = new Map(regions.map((region) => [region, 0]));
  for (const audit of audits) {
    if (!predicate(audit)) continue;
    const region = dashboardRegionName(audit);
    counts.set(region, (counts.get(region) || 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return regions.map((region) => {
    const count = counts.get(region) || 0;
    return { region, count, share: metricShare(count, total) };
  });
}


function feeVariance(record: Pick<RecordAudit, "actualFee" | "recordedFee">) {
  return Math.abs(decimalOrZero(record.actualFee) - decimalOrZero(record.recordedFee));
}

function regionalAmountBreakdown(audits: RecordAudit[], regions: string[], amount: (audit: RecordAudit) => number) {
  const counts = new Map(regions.map((region) => [region, 0]));
  for (const audit of audits) {
    const value = amount(audit);
    if (value <= 0) continue;
    const region = dashboardRegionName(audit);
    counts.set(region, (counts.get(region) || 0) + value);
  }
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return regions.map((region) => {
    const count = counts.get(region) || 0;
    return { region, count, share: metricShare(count, total) };
  });
}

function amountMetric(
  id: DashboardMetricId,
  label: string,
  audits: RecordAudit[],
  regions: string[],
  amount: (audit: RecordAudit) => number
): DashboardMetric {
  const total = audits.reduce((sum, audit) => sum + amount(audit), 0);
  return {
    id,
    label,
    total,
    share: total === 0 ? 0 : 1,
    regions: regionalAmountBreakdown(audits, regions, amount),
    valueType: "currency"
  };
}
function metric(
  id: DashboardMetricId,
  label: string,
  audits: RecordAudit[],
  regions: string[],
  totalRecords: number,
  predicate: (audit: RecordAudit) => boolean
): DashboardMetric {
  const total = audits.filter(predicate).length;
  return {
    id,
    label,
    total,
    share: metricShare(total, totalRecords),
    regions: regionalBreakdown(audits, regions, predicate)
  };
}

export function topMissingDocumentsByRegion(
  audits: RecordAudit[],
  requiredDocuments: RequiredDocumentRef[],
  maxRows = 5
): Record<string, DashboardMissingDocumentRow[]> {
  const names = new Map(requiredDocuments.map((document) => [document.id, document.name]));
  const buckets = new Map<string, Map<string, number>>([[ALL_REGIONS, new Map()]]);

  for (const audit of audits) {
    const region = dashboardRegionName(audit);
    if (!buckets.has(region)) buckets.set(region, new Map());
    for (const document of audit.missingDocuments) {
      const all = buckets.get(ALL_REGIONS)!;
      const scoped = buckets.get(region)!;
      all.set(document.id, (all.get(document.id) || 0) + 1);
      scoped.set(document.id, (scoped.get(document.id) || 0) + 1);
      if (!names.has(document.id)) names.set(document.id, document.name);
    }
  }

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([region, counts]) => [
      region,
      Array.from(counts.entries())
        .map(([requiredDocumentId, missingCount]) => ({
          requiredDocumentId,
          requiredDocumentName: names.get(requiredDocumentId) || "Unknown Document",
          missingCount
        }))
        .filter((row) => row.missingCount > 0)
        .sort((a, b) => b.missingCount - a.missingCount || a.requiredDocumentName.localeCompare(b.requiredDocumentName))
        .slice(0, maxRows)
    ])
  );
}

export function topApplicationSummary(audits: RecordAudit[], maxRows = 5): DashboardApplicationSummaryRow[] {
  const rows = new Map<string, DashboardApplicationSummaryRow>();
  for (const audit of audits) {
    const id = audit.applicationTypeId || "";
    const current = rows.get(id) || {
      applicationTypeId: id,
      applicationTypeName: audit.applicationTypeName,
      totalRecords: 0,
      completeRecords: 0,
      incompleteRecords: 0,
      pendingRecords: 0,
      share: 0
    };
    current.totalRecords += 1;
    if (audit.status === "Complete") current.completeRecords += 1;
    if (audit.status === "Incomplete") current.incompleteRecords += 1;
    if (audit.status === "Pending") current.pendingRecords += 1;
    rows.set(id, current);
  }

  const totalRecords = audits.length;
  return Array.from(rows.values())
    .map((row) => ({ ...row, share: metricShare(row.totalRecords, totalRecords) }))
    .sort((a, b) => b.totalRecords - a.totalRecords || a.applicationTypeName.localeCompare(b.applicationTypeName))
    .slice(0, maxRows);
}

export function topApplicationSummaryByRegion(audits: RecordAudit[], maxRows = 5): Record<string, DashboardApplicationSummaryRow[]> {
  const buckets = new Map<string, RecordAudit[]>([[ALL_REGIONS, audits]]);
  for (const audit of audits) {
    const region = dashboardRegionName(audit);
    if (!buckets.has(region)) buckets.set(region, []);
    buckets.get(region)!.push(audit);
  }

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([region, scopedAudits]) => [region, topApplicationSummary(scopedAudits, maxRows)])
  );
}

export function dashboardRegionOptions(audits: RecordAudit[]) {
  return [ALL_REGIONS, ...uniqueRegions(audits)];
}

export function dashboardProvincialOfficeOptions(audits: RecordAudit[]) {
  const offices = Array.from(new Set(audits.map(dashboardProvincialOfficeName))).sort((a, b) => {
    if (a === NO_PROVINCIAL_OFFICE) return 1;
    if (b === NO_PROVINCIAL_OFFICE) return -1;
    return a.localeCompare(b);
  });
  return [ALL_REGIONS, ...offices];
}

export function filterDashboardAuditsByRegion(audits: RecordAudit[], region: string) {
  if (!region || region === ALL_REGIONS) return audits;
  return audits.filter((audit) => dashboardRegionName(audit) === region);
}

export function filterDashboardAuditsByProvincialOffice(audits: RecordAudit[], provincialOffice: string) {
  if (!provincialOffice || provincialOffice === ALL_REGIONS) return audits;
  return audits.filter((audit) => dashboardProvincialOfficeName(audit) === provincialOffice);
}

export function buildDashboardData(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]): DashboardData {
  const totalRecords = audits.length;
  const regions = uniqueRegions(audits);
  const metricRows: DashboardMetricRow[] = [
    {
      id: "status",
      metrics: [
        metric("total", "Total Records", audits, regions, totalRecords, dashboardMetricPredicates.total),
        metric("complete", "Complete Records", audits, regions, totalRecords, dashboardMetricPredicates.complete),
        metric("incomplete", "Incomplete Records", audits, regions, totalRecords, dashboardMetricPredicates.incomplete),
        metric("pending", "Pending Records", audits, regions, totalRecords, dashboardMetricPredicates.pending)
      ]
    },
    {
      id: "flags",
      metrics: [
        metric("fee-mismatches", "Fee Mismatches", audits, regions, totalRecords, dashboardMetricPredicates["fee-mismatches"]),
        amountMetric("fee-variance-amount", "Fee Variance Amount", audits, regions, feeVariance),
        metric("duplicate-ptc", "Duplicate PTC Numbers", audits, regions, totalRecords, dashboardMetricPredicates["duplicate-ptc"]),
        metric("cancelled", "Cancelled Applications", audits, regions, totalRecords, dashboardMetricPredicates.cancelled)
      ]
    },
    {
      id: "replanted",
      metrics: [
        metric("replanted-yes", "Replanted Seedlings: Yes", audits, regions, totalRecords, dashboardMetricPredicates["replanted-yes"]),
        metric("replanted-no", "Replanted Seedlings: No", audits, regions, totalRecords, dashboardMetricPredicates["replanted-no"])
      ]
    }
  ];

  return {
    totalRecords,
    metricRows,
    regionOptions: dashboardRegionOptions(audits),
    topMissingByRegion: topMissingDocumentsByRegion(audits, requiredDocuments),
    topApplicationsByRegion: topApplicationSummaryByRegion(audits)
  };
}
