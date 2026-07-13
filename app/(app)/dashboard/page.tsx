import { DashboardMetrics } from "@/components/dashboard-metrics";
import { VersionFilter } from "@/components/version-filter";
import { buildDashboardData } from "@/lib/dashboard";
import { getReportData, getVersionContext } from "@/lib/data";

export default async function DashboardPage({ searchParams }: { searchParams?: { version?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const report = await getReportData({ versionId: versionContext.selectedVersionId });
  const dashboard = buildDashboardData(report.audits, report.requiredDocuments);

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Compliance Dashboard</h1>
          <p className="muted">Live audit view powered by application records, regional breakdowns, and required documents.</p>
        </div>
        <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/dashboard" />
      </div>
      <DashboardMetrics data={dashboard} />
    </div>
  );
}
