import { decimalOrZero, feesMatch, isCancelledRecord } from "@/lib/ptc";
import type { RecordAudit, RequiredDocumentRef } from "@/lib/reporting";

export type DashboardRegionBreakdown = {
  region: string;
  count: number;
  share: number;
};

export type DashboardMetric = {
  id: string;
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

function regionName(record: Pick<RecordAudit, "regionalOffice">) {
  return String(record.regionalOffice || "").trim() || NO_REGION;
}

function metricShare(count: number, total: number) {
  return total === 0 ? 0 : count / total;
}

function uniqueRegions(audits: RecordAudit[]) {
  return Array.from(new Set(audits.map(regionName))).sort((a, b) => {
    if (a === NO_REGION) return 1;
    if (b === NO_REGION) return -1;
    return a.localeCompare(b);
  });
}

function regionalBreakdown(audits: RecordAudit[], regions: string[], predicate: (audit: RecordAudit) => boolean) {
  const counts = new Map(regions.map((region) => [region, 0]));
  for (const audit of audits) {
    if (!predicate(audit)) continue;
    const region = regionName(audit);
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
    const region = regionName(audit);
    counts.set(region, (counts.get(region) || 0) + value);
  }
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return regions.map((region) => {
    const count = counts.get(region) || 0;
    return { region, count, share: metricShare(count, total) };
  });
}

function amountMetric(
  id: string,
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
  id: string,
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
    const region = regionName(audit);
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
    const region = regionName(audit);
    if (!buckets.has(region)) buckets.set(region, []);
    buckets.get(region)!.push(audit);
  }

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([region, scopedAudits]) => [region, topApplicationSummary(scopedAudits, maxRows)])
  );
}

export function buildDashboardData(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]): DashboardData {
  const totalRecords = audits.length;
  const regions = uniqueRegions(audits);
  const metricRows: DashboardMetricRow[] = [
    {
      id: "status",
      metrics: [
        metric("total", "Total Records", audits, regions, totalRecords, () => true),
        metric("complete", "Complete Records", audits, regions, totalRecords, (audit) => audit.status === "Complete"),
        metric("incomplete", "Incomplete Records", audits, regions, totalRecords, (audit) => audit.status === "Incomplete"),
        metric("pending", "Pending Records", audits, regions, totalRecords, (audit) => audit.status === "Pending")
      ]
    },
    {
      id: "flags",
      metrics: [
        metric("fee-mismatches", "Fee Mismatches", audits, regions, totalRecords, (audit) => !feesMatch(audit)),
        amountMetric("fee-variance-amount", "Fee Variance Amount", audits, regions, feeVariance),
        metric("duplicate-ptc", "Duplicate PTC Numbers", audits, regions, totalRecords, (audit) => !!audit.ptcNumberDuplicate),
        metric("cancelled", "Cancelled Applications", audits, regions, totalRecords, (audit) => isCancelledRecord(audit))
      ]
    },
    {
      id: "replanted",
      metrics: [
        metric("replanted-yes", "Replanted Seedlings: Yes", audits, regions, totalRecords, (audit) => audit.replantedSeedlings === true),
        metric("replanted-no", "Replanted Seedlings: No", audits, regions, totalRecords, (audit) => audit.replantedSeedlings === false)
      ]
    }
  ];

  return {
    totalRecords,
    metricRows,
    regionOptions: [ALL_REGIONS, ...regions],
    topMissingByRegion: topMissingDocumentsByRegion(audits, requiredDocuments),
    topApplicationsByRegion: topApplicationSummaryByRegion(audits)
  };
}