import { ReportTable } from "@/components/report-table";
import { getReportData } from "@/lib/data";

export default async function MissingDocumentsPage() {
  const { audits } = await getReportData();
  const rows = audits.filter((audit) => audit.missingCount > 0).map((audit) => ({
    applicantName: audit.applicantName,
    applicationTypeName: audit.applicationTypeName,
    missingCount: audit.missingCount,
    missingDocuments: audit.missingDocuments.map((doc) => doc.name),
    selectedDocuments: audit.selectedDocuments.map((doc) => doc.name)
  }));

  return (
    <div className="grid">
      <div>
        <h1>Missing Documents</h1>
        <p className="muted">Applicant-level follow-up list for incomplete records.</p>
      </div>
      <section className="panel">
        <ReportTable
          rows={rows}
          columns={[
            { key: "applicantName", label: "Name", sortable: true },
            { key: "applicationTypeName", label: "Type of application", sortable: true },
            { key: "missingCount", label: "Missing Count", sortable: true, type: "number" },
            { key: "missingDocuments", label: "Missing Documents", type: "list" },
            { key: "selectedDocuments", label: "Selected Documents", type: "list" }
          ]}
          empty="No missing documents."
        />
      </section>
    </div>
  );
}