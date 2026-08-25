import Link from "next/link";
import { notFound } from "next/navigation";
import { EditApplicationButton } from "@/components/edit-application-button";
import { StatusBadge } from "@/components/status-badge";
import { getApplicationTypesWithDocuments, getOfficeChoices, getReportData, getVersionContext } from "@/lib/data";
import { displayApplicantName, displayLocExemption, displayPtcField, displayReplantedSeedlings, feesMatch, formatDate, formatFee, formatSignedFeeDifference, formatValidityDays } from "@/lib/ptc";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";
import { prisma } from "@/lib/prisma";
import { requireUser, userHasFeature } from "@/lib/auth";
import { FeatureKey } from "@prisma/client";

function metadataValue(value: string) {
  return value || <span className="muted">Blank</span>;
}

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const [user, record, applicationTypes, officeChoices, report, versionContext] = await Promise.all([
    requireUser(),
    prisma.applicationRecord.findUnique({
      where: { id: params.id },
      include: {
        version: true,
        applicationType: { include: { documents: { where: { active: true }, orderBy: { sortOrder: "asc" } } } },
        progressDocuments: { include: { requiredDocument: true } },
        progressEntries: {
          include: { user: true, documents: { include: { requiredDocument: true } } },
          orderBy: { createdAt: "desc" }
        },
        checkFindings: { where: { active: true }, orderBy: { checkType: "asc" } },
        checkRuns: { include: { appliedBy: true }, orderBy: { createdAt: "desc" } }
      }
    }),
    getApplicationTypesWithDocuments(),
    getOfficeChoices(),
    getReportData(),
    getVersionContext()
  ]);

  if (!record) notFound();
  const [fees, validity] = await Promise.all([
    userHasFeature(user, FeatureKey.PTC_FEES_CHECKER),
    userHasFeature(user, FeatureKey.PTC_VALIDITY_CHECKER)
  ]);
  const audit = report.audits.find((item) => item.id === record.id);
  if (!audit) notFound();
  const existingDocumentIds = record.progressDocuments.map((doc) => doc.requiredDocumentId);
  const applicationTypeOptions = applicationTypes.map((type) => ({
    id: type.id,
    versionId: type.versionId,
    name: type.name,
    documents: type.documents.map((document) => ({ id: document.id, name: document.name, requirementMode: document.requirementMode }))
  }));
  const officeOptions = officeChoices.map((office) => ({
    id: office.id,
    name: office.name,
    provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
  }));
  const applicantName = displayApplicantName(record);
  const dateIssued = formatDate(record.dateIssued);
  const dateIssuedInput = record.dateIssued ? record.dateIssued.toISOString().slice(0, 10) : "";
  const recordVersionParam = record.versionId || UNCATEGORIZED_VERSION;

  return (
    <div className="grid">
      <div className="topbar">
        <Link className="button secondary" href={`/applications?version=${recordVersionParam}`}>Back to Applications</Link>
        <EditApplicationButton
          record={{
            id: record.id,
            versionId: record.versionId,
            applicantName: record.applicantName || "",
            applicationTypeId: record.applicationTypeId,
            remarks: record.remarks || "",
            selectedDocumentIds: existingDocumentIds,
            returnTo: `/applications/${record.id}`,
            dateIssued: dateIssuedInput,
            ptcNumber: record.ptcNumber || "",
            regionalOffice: record.regionalOffice || "",
            provincialOffice: record.provincialOffice || "",
            municipality: record.municipality || "",
            barangay: record.barangay || "",
            treesApplied: record.treesApplied,
            treesApproved: record.treesApproved,
            seedlingsReplacement: record.seedlingsReplacement,
            recordedValidityDays: record.recordedValidityDays,
            actualValidityDays: record.actualValidityDays,
            actualFee: formNumberValue(record.actualFee),
            recordedFee: formNumberValue(record.recordedFee),
            officialReceiptNumber: record.officialReceiptNumber || "",
            replantedSeedlings: record.replantedSeedlings,
            locExemption: record.locExemption,
            agriculturist: record.agriculturist || "",
            recommendingApproval: record.recommendingApproval || "",
            approved: record.approved || ""
          }}
          applicationTypes={applicationTypeOptions}
          officeChoices={officeOptions}
          versionOptions={versionContext.options}
          checkerAccess={{ fees, validity }}
        />
      </div>

      <div>
        <h1>{applicantName}</h1>
        <p className="muted">{record.applicationType?.name || "No type of application selected yet"}</p>
        {record.remarks ? <p>{record.remarks}</p> : null}
      </div>

      {audit.needsVersionReview ? (
        <section className="panel warning-panel">
          <h2>Needs Version Review</h2>
          <ul>
            {audit.versionReviewMessages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </section>
      ) : null}

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
            <p className="muted">Metadata for the application request. Blank counts and fees are treated as 0.</p>
          </div>
          {audit.ptcNumberDuplicate ? <span className="badge danger-badge">Duplicate PTC Number</span> : null}
        </div>
        <div className="metadata-grid">
          <div><span>Version</span><strong>{record.version?.name || "Uncategorized"}</strong></div>
          <div><span>Date Issued</span><strong>{metadataValue(dateIssued)}</strong></div>
          <div><span>PTC Number</span><strong>{metadataValue(record.ptcNumber || "")}</strong></div>
          <div><span>Recorded Validity</span><strong>{metadataValue(formatValidityDays(record.recordedValidityDays))}</strong></div>
          <div><span>Actual Validity</span><strong>{metadataValue(formatValidityDays(record.actualValidityDays))}</strong></div>
          <div><span>Regional Office</span><strong>{metadataValue(displayPtcField(record, "regionalOffice"))}</strong></div>
          <div><span>Provincial Office</span><strong>{metadataValue(displayPtcField(record, "provincialOffice"))}</strong></div>
          <div><span>Municipality</span><strong>{metadataValue(displayPtcField(record, "municipality"))}</strong></div>
          <div><span>Barangay</span><strong>{metadataValue(displayPtcField(record, "barangay"))}</strong></div>
          <div><span>No. of trees applied</span><strong>{displayPtcField(record, "treesApplied")}</strong></div>
          <div><span>No. of trees approved</span><strong>{displayPtcField(record, "treesApproved")}</strong></div>
          <div><span>No. of Seedlings Replacement</span><strong>{displayPtcField(record, "seedlingsReplacement")}</strong></div>
          <div><span>Actual Fee</span><strong>{formatFee(record.actualFee)}</strong></div>
          <div><span>Recorded Fee</span><strong>{formatFee(record.recordedFee)}</strong></div>
          <div><span>Fee Difference</span><strong>{formatSignedFeeDifference(record)}</strong></div>
          <div><span>Fees Match</span><strong>{feesMatch(record) ? "Yes" : "No"}</strong></div>
          <div><span>Official Receipt No.</span><strong>{metadataValue(record.officialReceiptNumber || "")}</strong></div>
          <div><span>Replanted Seedlings</span><strong>{metadataValue(displayReplantedSeedlings(record.replantedSeedlings))}</strong></div>
          <div><span>LOC Exemption</span><strong>{metadataValue(displayLocExemption(record.locExemption))}</strong></div>
          <div><span>Agriculturist</span><strong>{metadataValue(record.agriculturist || "")}</strong></div>
          <div><span>Recommending Approval</span><strong>{metadataValue(record.recommendingApproval || "")}</strong></div>
          <div><span>Approved</span><strong>{metadataValue(record.approved || "")}</strong></div>
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
        <h2>System Check Findings</h2>
        {record.checkFindings.length > 0 ? <ul>{record.checkFindings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul> : <p className="muted">No active system findings.</p>}
      </section>

      <section className="panel">
        <h2>Calculation History</h2>
        <div className="table-wrap"><table><thead><tr><th>Check</th><th>Result</th><th>Applied By</th><th>Date</th></tr></thead><tbody>
          {record.checkRuns.map((run) => <tr key={run.id}><td>{run.checkType}</td><td>{JSON.stringify(run.outputSnapshot)}</td><td>{run.appliedBy.name}</td><td>{formatDate(run.createdAt)}</td></tr>)}
          {record.checkRuns.length === 0 ? <tr><td colSpan={4}>No checker results saved.</td></tr> : null}
        </tbody></table></div>
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

