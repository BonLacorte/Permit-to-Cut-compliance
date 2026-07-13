import { ReportTable } from "@/components/report-table";
import { VersionFilter } from "@/components/version-filter";
import { getReportData, getVersionContext } from "@/lib/data";

export default async function DocumentSummaryPage({ searchParams }: { searchParams?: { version?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const { documents } = await getReportData({ versionId: versionContext.selectedVersionId });
  const rows = documents.map((doc) => ({
    applicationTypeName: doc.applicationTypeName,
    requiredDocumentName: doc.requiredDocumentName,
    applicationRecords: doc.applicationRecords,
    submittedCount: doc.submittedCount,
    missingCount: doc.missingCount,
    submittedRate: doc.submittedRate
  }));

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Document Summary</h1>
          <p className="muted">Submitted and missing document counts by application and required document.</p>
        </div>
        <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/reports/document-summary" />
      </div>
      <section className="panel">
        <ReportTable
          rows={rows}
          columns={[
            { key: "applicationTypeName", label: "Type of application", sortable: true },
            { key: "requiredDocumentName", label: "Required Document", sortable: true },
            { key: "applicationRecords", label: "Records", sortable: true, type: "number" },
            { key: "submittedCount", label: "Submitted", sortable: true, type: "number" },
            { key: "missingCount", label: "Missing", sortable: true, type: "number" },
            { key: "submittedRate", label: "Submitted %", sortable: true, type: "percent" }
          ]}
        />
      </section>
    </div>
  );
}
