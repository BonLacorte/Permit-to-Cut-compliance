import Link from "next/link";
import { notFound } from "next/navigation";
import { EditApplicationButton } from "@/components/edit-application-button";
import { StatusBadge } from "@/components/status-badge";
import { getApplicationTypesWithDocuments, getReportData } from "@/lib/data";
import { displayApplicantName, displayPtcField, formatDate } from "@/lib/ptc";
import { prisma } from "@/lib/prisma";

function metadataValue(value: string) {
  return value || <span className="muted">Blank</span>;
}

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const [record, applicationTypes, report] = await Promise.all([
    prisma.applicationRecord.findUnique({
      where: { id: params.id },
      include: {
        applicationType: { include: { documents: { where: { active: true }, orderBy: { sortOrder: "asc" } } } },
        progressDocuments: { include: { requiredDocument: true } },
        progressEntries: {
          include: { user: true, documents: { include: { requiredDocument: true } } },
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    getApplicationTypesWithDocuments(),
    getReportData()
  ]);

  if (!record) notFound();
  const audit = report.audits.find((item) => item.id === record.id);
  if (!audit) notFound();
  const existingDocumentIds = record.progressDocuments.map((doc) => doc.requiredDocumentId);
  const applicationTypeOptions = applicationTypes.map((type) => ({
    id: type.id,
    name: type.name,
    documents: type.documents.map((document) => ({ id: document.id, name: document.name }))
  }));
  const applicantName = displayApplicantName(record);
  const dateIssued = formatDate(record.dateIssued);

  return (
    <div className="grid">
      <div className="topbar">
        <Link className="button secondary" href="/applications">Back to Applications</Link>
        <EditApplicationButton
          record={{
            id: record.id,
            applicantName: record.applicantName || "",
            applicationTypeId: record.applicationTypeId,
            remarks: record.remarks || "",
            selectedDocumentIds: existingDocumentIds,
            returnTo: `/applications/${record.id}`,
            dateIssued,
            ptcNumber: record.ptcNumber || "",
            regionalOffice: record.regionalOffice || "",
            provincialOffice: record.provincialOffice || "",
            municipality: record.municipality || "",
            barangay: record.barangay || "",
            treesApplied: record.treesApplied,
            treesApproved: record.treesApproved,
            seedlingsReplacement: record.seedlingsReplacement
          }}
          applicationTypes={applicationTypeOptions}
        />
      </div>

      <div>
        <h1>{applicantName}</h1>
        <p className="muted">{record.applicationType?.name || "No type of application selected yet"}</p>
        {record.remarks ? <p>{record.remarks}</p> : null}
      </div>

      <section className="grid cols-4">
        <div className="card stat"><span>Required</span><strong>{audit.requiredCount}</strong></div>
        <div className="card stat"><span>Submitted</span><strong>{audit.submittedCount}</strong></div>
        <div className="card stat"><span>Missing</span><strong>{audit.missingCount}</strong></div>
        <div className="card stat"><span>Status</span><strong><StatusBadge status={audit.status} /></strong></div>
      </section>

      <section className="panel">
        <div className="section-heading-row">
          <div>
            <h2>PTC Record Information</h2>
            <p className="muted">Metadata for the application request. Blank tree counts are treated as 0.</p>
          </div>
          {audit.ptcNumberDuplicate ? <span className="badge danger-badge">Duplicate PTC Number</span> : null}
        </div>
        <div className="metadata-grid">
          <div><span>Date Issued</span><strong>{metadataValue(dateIssued)}</strong></div>
          <div><span>PTC Number</span><strong>{metadataValue(record.ptcNumber || "")}</strong></div>
          <div><span>Regional Office</span><strong>{metadataValue(displayPtcField(record, "regionalOffice"))}</strong></div>
          <div><span>Provincial Office</span><strong>{metadataValue(displayPtcField(record, "provincialOffice"))}</strong></div>
          <div><span>Municipality</span><strong>{metadataValue(displayPtcField(record, "municipality"))}</strong></div>
          <div><span>Barangay</span><strong>{metadataValue(displayPtcField(record, "barangay"))}</strong></div>
          <div><span>No. of trees applied</span><strong>{displayPtcField(record, "treesApplied")}</strong></div>
          <div><span>No. of trees approved</span><strong>{displayPtcField(record, "treesApproved")}</strong></div>
          <div><span>No. of Seedlings Replacement</span><strong>{displayPtcField(record, "seedlingsReplacement")}</strong></div>
        </div>
      </section>

      <section className="grid cols-2">
        <div className="panel">
          <h2>Selected Documents</h2>
          <ul>
            {audit.selectedDocuments.map((doc) => <li key={doc.id}>{doc.name}</li>)}
            {audit.selectedDocuments.length === 0 ? <li>No documents selected.</li> : null}
          </ul>
        </div>
        <div className="panel">
          <h2>Missing Documents</h2>
          <ul>
            {audit.missingDocuments.map((doc) => <li key={doc.id}>{doc.name}</li>)}
            {audit.missingDocuments.length === 0 ? <li>No missing documents.</li> : null}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>Progress History</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Documents</th><th>Remarks</th></tr></thead>
            <tbody>
              {record.progressEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.user.name}</td>
                  <td>{entry.documents.map((doc) => doc.requiredDocument.name).join(", ") || "No document changes"}</td>
                  <td>{entry.remarks || ""}</td>
                </tr>
              ))}
              {record.progressEntries.length === 0 ? <tr><td colSpan={3}>No progress entries yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
