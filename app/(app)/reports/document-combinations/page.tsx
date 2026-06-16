import { ReportTable } from "@/components/report-table";
import { getReportData } from "@/lib/data";

export default async function DocumentCombinationsPage() {
  const { combinations } = await getReportData();
  const rows = combinations.map((row) => ({
    applicationTypeName: row.applicationTypeName,
    submittedCombination: row.documents,
    size: row.size,
    count: row.count,
    share: row.share
  }));

  return (
    <div className="grid">
      <div>
        <h1>Document Combinations</h1>
        <p className="muted">Common submitted-document combinations by application type.</p>
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