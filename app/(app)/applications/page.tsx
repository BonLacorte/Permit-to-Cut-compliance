import Link from "next/link";
import { ApplicationsTable } from "@/components/applications-table";
import { getApplicationTypesWithDocuments, getReportData } from "@/lib/data";

export default async function ApplicationsPage() {
  const [{ audits }, applicationTypes] = await Promise.all([
    getReportData(),
    getApplicationTypesWithDocuments()
  ]);

  const rows = audits.map((audit) => ({
    id: audit.id,
    applicantName: audit.applicantName,
    applicationTypeId: audit.applicationTypeId,
    applicationTypeName: audit.applicationTypeName,
    submittedCount: audit.submittedCount,
    requiredCount: audit.requiredCount,
    missingCount: audit.missingCount,
    status: audit.status,
    selectedDocuments: audit.selectedDocuments.map((doc) => doc.name),
    selectedDocumentIds: audit.selectedDocuments.map((doc) => doc.id),
    remarks: audit.remarks || "",
    createdByName: audit.createdByName || "Unknown"
  }));

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Applications</h1>
          <p className="muted">Applicant records with submitted and missing documents.</p>
        </div>
        <Link className="button" href="/applications/new">New Application</Link>
      </div>
      <section className="panel">
        <ApplicationsTable
          rows={rows}
          applicationTypes={applicationTypes.map((type) => ({
            id: type.id,
            name: type.name,
            documents: type.documents.map((document) => ({ id: document.id, name: document.name }))
          }))}
        />
      </section>
    </div>
  );
}