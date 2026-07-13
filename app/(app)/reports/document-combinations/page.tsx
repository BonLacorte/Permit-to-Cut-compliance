import { ReportTable } from "@/components/report-table";
import { VersionFilter } from "@/components/version-filter";
import { getReportData, getVersionContext } from "@/lib/data";

export default async function DocumentCombinationsPage({ searchParams }: { searchParams?: { version?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const { combinations } = await getReportData({ versionId: versionContext.selectedVersionId });
  const rows = combinations.map((row) => ({
    applicationTypeName: row.applicationTypeName,
    submittedCombination: row.documents,
    size: row.size,
    count: row.count,
    share: row.share
  }));

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Document Combinations</h1>
          <p className="muted">Common submitted-document combinations by application type.</p>
        </div>
        <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/reports/document-combinations" />
      </div>
      <section className="panel">
        <ReportTable
          rows={rows}
          columns={[
            { key: "applicationTypeName", label: "Type of application", sortable: true },
            { key: "submittedCombination", label: "Submitted Combination", type: "list" },
            { key: "size", label: "Size", sortable: true, type: "number" },
            { key: "count", label: "Count", sortable: true, type: "number" },
            { key: "share", label: "Share", sortable: true, type: "percent" }
          ]}
          empty="No combinations yet."
        />
      </section>
    </div>
  );
}
