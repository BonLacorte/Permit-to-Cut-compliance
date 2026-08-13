import { DashboardMetrics } from "@/components/dashboard-metrics";
import { DashboardRegionFilter } from "@/components/dashboard-region-filter";
import { VersionFilter } from "@/components/version-filter";
import { buildDashboardData, dashboardRegionOptions, filterDashboardAuditsByRegion } from "@/lib/dashboard";
import { getReportData, getVersionContext } from "@/lib/data";

export default async function DashboardPage({ searchParams }: { searchParams?: { version?: string | string[]; region?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const report = await getReportData({ versionId: versionContext.selectedVersionId });
  const regionOptions = dashboardRegionOptions(report.audits);
  const requestedRegion = Array.isArray(searchParams?.region) ? searchParams?.region[0] : searchParams?.region || "All";
  const selectedRegion = regionOptions.includes(requestedRegion) ? requestedRegion : "All";
  const scopedAudits = filterDashboardAuditsByRegion(report.audits, selectedRegion);
  const dashboard = { ...buildDashboardData(scopedAudits, report.requiredDocuments), regionOptions };

  return (
    <div className="grid">
      <div>
        <h1>Compliance Dashboard</h1>
        <p className="muted">Live audit view powered by application records, regional breakdowns, and required documents.</p>
        <div className="actions page-title-actions">
          <DashboardRegionFilter options={regionOptions} selected={selectedRegion} version={versionContext.selectedVersionParam} path="/dashboard" />
          <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/dashboard" />
        </div>
      </div>
      <DashboardMetrics data={dashboard} />
    </div>
  );
}
