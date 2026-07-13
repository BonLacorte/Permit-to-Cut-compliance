import { ReportTable } from "@/components/report-table";
import { VersionFilter } from "@/components/version-filter";
import { getReportData, getVersionContext } from "@/lib/data";

export default async function ApplicationSummaryPage({ searchParams }: { searchParams?: { version?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const { applications } = await getReportData({ versionId: versionContext.selectedVersionId });
  const rows = applications.map((app) => ({
    applicationTypeName: app.applicationTypeName,
    totalRecords: app.totalRecords,
    completeRecords: app.completeRecords,
    incompleteRecords: app.incompleteRecords,
    pendingRecords: app.pendingRecords,
    completionRate: app.completionRate,
    requiredDocumentCount: app.requiredDocumentCount,
    missingDocumentInstances: app.missingDocumentInstances
  }));

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Application Summary</h1>
          <p className="muted">Counts, completion rates, and required-document totals by application type.</p>
        </div>
        <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/reports/application-summary" />
      </div>
      <section className="panel">
        <ReportTable
          rows={rows}
          columns={[
            { key: "applicationTypeName", label: "Type of application", sortable: true },
            { key: "totalRecords", label: "Total", sortable: true, type: "number" },
            { key: "completeRecords", label: "Complete", sortable: true, type: "number" },
            { key: "incompleteRecords", label: "Incomplete", sortable: true, type: "number" },
            { key: "pendingRecords", label: "Pending", sortable: true, type: "number" },
            { key: "completionRate", label: "Completion Rate", sortable: true, type: "percent" },
            { key: "requiredDocumentCount", label: "Required Docs", sortable: true, type: "number" },
            { key: "missingDocumentInstances", label: "Missing Instances", sortable: true, type: "number" }
          ]}
        />
      </section>
    </div>
  );
}
