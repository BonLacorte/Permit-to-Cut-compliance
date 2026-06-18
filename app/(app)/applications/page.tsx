import Link from "next/link";
import { ApplicationsTable } from "@/components/applications-table";
import { getApplicationTypesWithDocuments, getReportData } from "@/lib/data";
import { displayPtcField, formatDate } from "@/lib/ptc";

export default async function ApplicationsPage() {
  const [{ audits }, applicationTypes] = await Promise.all([
    getReportData(),
    getApplicationTypesWithDocuments()
  ]);

  const rows = audits.map((audit) => ({
    id: audit.id,
    applicantName: audit.applicantName || "",
    applicationTypeId: audit.applicationTypeId,
    applicationTypeName: audit.applicationTypeName,
    submittedCount: audit.submittedCount,
    requiredCount: audit.requiredCount,
    missingCount: audit.missingCount,
    status: audit.status,
    selectedDocuments: audit.selectedDocuments.map((doc) => doc.name),
    selectedDocumentIds: audit.selectedDocuments.map((doc) => doc.id),
    remarks: audit.remarks || "",
    createdByName: audit.createdByName || "Unknown",
    dateIssued: formatDate(audit.dateIssued),
    ptcNumber: audit.ptcNumber || "",
    regionalOffice: audit.regionalOffice || "",
    provincialOffice: audit.provincialOffice || "",
    municipality: audit.municipality || "",
    barangay: audit.barangay || "",
    regionalOfficeDisplay: displayPtcField(audit, "regionalOffice"),
    provincialOfficeDisplay: displayPtcField(audit, "provincialOffice"),
    municipalityDisplay: displayPtcField(audit, "municipality"),
    barangayDisplay: displayPtcField(audit, "barangay"),
    treesApplied: audit.treesApplied ?? null,
    treesApproved: audit.treesApproved ?? null,
    seedlingsReplacement: audit.seedlingsReplacement ?? null,
    treesAppliedDisplay: displayPtcField(audit, "treesApplied"),
    treesApprovedDisplay: displayPtcField(audit, "treesApproved"),
    seedlingsReplacementDisplay: displayPtcField(audit, "seedlingsReplacement"),
    ptcNumberDuplicate: !!audit.ptcNumberDuplicate
  }));

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>PTC Applications</h1>
          <p className="muted">Applicant records with PTC metadata, submitted documents, and missing documents.</p>
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
