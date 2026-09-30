import { PttDashboardMetrics } from "@/components/ptt/dashboard-metrics";
import { DashboardRegionFilter } from "@/components/ptc/dashboard-region-filter";
import { VersionFilter } from "@/components/ptc/version-filter";
import { getPttApplicationRecords, getVersionContext } from "@/lib/data";
import { buildPttDashboardData } from "@/lib/ptt-dashboard";
import { filterPttRecordsByRegion, PERMIT_GROUP_PTT, pttRegionOptions } from "@/lib/ptt";

export default async function PttDashboardPage({ searchParams }: { searchParams?: { version?: string | string[]; region?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version, PERMIT_GROUP_PTT);
  const records = await getPttApplicationRecords({ versionId: versionContext.selectedVersionId });
  const regionOptions = pttRegionOptions(records);
  const requestedRegion = Array.isArray(searchParams?.region) ? searchParams?.region[0] : searchParams?.region || "All";
  const selectedRegion = regionOptions.includes(requestedRegion) ? requestedRegion : "All";
  const scopedRecords = filterPttRecordsByRegion(records, selectedRegion);

  return (
    <div className="grid">
      <div>
        <h1>PTT Compliance Dashboard</h1>
        <p className="muted">Live PTT record status, checker exceptions, and office coverage by Region and Provincial Office.</p>
        <div className="actions page-title-actions">
          <DashboardRegionFilter options={regionOptions} selected={selectedRegion} version={versionContext.selectedVersionParam} path="/ptt/dashboard" />
          <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/ptt/dashboard" preservedParams={{ region: selectedRegion === "All" ? undefined : selectedRegion }} />
        </div>
      </div>
      <PttDashboardMetrics data={buildPttDashboardData(scopedRecords)} version={versionContext.selectedVersionParam} />
    </div>
  );
}
