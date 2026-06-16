import Link from "next/link";
import { notFound } from "next/navigation";
import { EditApplicationButton } from "@/components/edit-application-button";
import { StatusBadge } from "@/components/status-badge";
import { getApplicationTypesWithDocuments, getReportData } from "@/lib/data";
import { prisma } from "@/lib/prisma";

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

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <Link className="button secondary" href="/applications">Back to Applications</Link>
        </div>
        <EditApplicationButton
          record={{
            id: record.id,
            applicantName: record.applicantName,
            applicationTypeId: record.applicationTypeId,
            remarks: record.remarks || "",
            selectedDocumentIds: existingDocumentIds,
            returnTo: `/applications/${record.id}`
          }}
          applicationTypes={applicationTypeOptions}
        />
      </div>

      <div>
        <h1>{record.applicantName}</h1>
        <p className="muted">{record.applicationType.name}</p>
        {record.remarks ? <p>{record.remarks}</p> : null}
      </div>

      <section className="grid cols-4">
        <div className="card stat"><span>Required</span><strong>{audit.requiredCount}</strong></div>
        <div className="card stat"><span>Submitted</span><strong>{audit.submittedCount}</strong></div>
        <div className="card stat"><span>Missing</span><strong>{audit.missingCount}</strong></div>
        <div className="card stat"><span>Status</span><strong><StatusBadge status={audit.status} /></strong></div>
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