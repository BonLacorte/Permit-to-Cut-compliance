import { ReportTable } from "@/components/report-table";
import { getReportData } from "@/lib/data";

export default async function ApplicationSummaryPage() {
  const { applications } = await getReportData();
  const rows = applications.map((app) => ({
    applicationTypeName: app.applicationTypeName,
    totalRecords: app.totalRecords,
    completeRecords: app.completeRecords,
    incompleteRecords: app.incompleteRecords,
    completionRate: app.completionRate,
    requiredDocumentCount: app.requiredDocumentCount,
    missingDocumentInstances: app.missingDocumentInstances
  }));

  return (
    <div className="grid">
      <div>
        <h1>Application Summary</h1>
        <p className="muted">Counts, completion rates, and required-document totals by application type.</p>
      </div>
      <section className="panel">
        <ReportTable
          rows={rows}
          columns={[
            { key: "applicationTypeName", label: "Type of application", sortable: true },
            { key: "totalRecords", label: "Total", sortable: true, type: "number" },
            { key: "completeRecords", label: "Complete", sortable: true, type: "number" },
            { key: "incompleteRecords", label: "Incomplete", sortable: true, type: "number" },
            { key: "completionRate", label: "Completion Rate", sortable: true, type: "percent" },
            { key: "requiredDocumentCount", label: "Required Docs", sortable: true, type: "number" },
            { key: "missingDocumentInstances", label: "Missing Instances", sortable: true, type: "number" }
          ]}
        />
      </section>
    </div>
  );
}