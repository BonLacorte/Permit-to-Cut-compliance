import Link from "next/link";
import { ApplicationsTable } from "@/components/applications-table";
import { DashboardRegionFilter } from "@/components/dashboard-region-filter";
import { VersionFilter } from "@/components/version-filter";
import { requireUser } from "@/lib/auth";
import { getApplicationTypesWithDocuments, getOfficeChoices, getReportData, getVersionContext } from "@/lib/data";
import { dashboardRegionOptions, filterDashboardAuditsByRegion } from "@/lib/dashboard";
import { blankDisplay, decimalOrZero, displayPtcField, displayLocExemption, displayReplantedSeedlings, feesMatch, feeDifference, formatDate, formatFee, formatSignedFeeDifference, formatValidityDays } from "@/lib/ptc";

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function ApplicationsPage({ searchParams }: { searchParams?: { version?: string; region?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const [user, selectedReport, allVersionsReport, applicationTypes, officeChoices] = await Promise.all([
    requireUser(),
    getReportData({ versionId: versionContext.selectedVersionId }),
    getReportData(),
    getApplicationTypesWithDocuments(),
    getOfficeChoices()
  ]);
  const regionOptions = dashboardRegionOptions(selectedReport.audits);
  const requestedRegion = Array.isArray(searchParams?.region) ? searchParams?.region[0] : searchParams?.region || "All";
  const selectedRegion = regionOptions.includes(requestedRegion) ? requestedRegion : "All";
  const audits = filterDashboardAuditsByRegion(selectedReport.audits, selectedRegion);

  const rows = audits.map((audit) => ({
    id: audit.id,
    versionId: audit.versionId || null,
    versionName: audit.versionName || "Uncategorized",
    needsVersionReview: audit.needsVersionReview,
    versionReviewMessages: audit.versionReviewMessages,
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
    editedByName: audit.editedByName || "",
    dateIssued: formatDate(audit.dateIssued),
    ptcNumber: audit.ptcNumber || "",
    regionalOffice: audit.regionalOffice || "",
    provincialOffice: audit.provincialOffice || "",
    municipality: audit.municipality || "",
    barangay: audit.barangay || "",
    regionalOfficeDisplay: blankDisplay(audit.regionalOffice),
    provincialOfficeDisplay: blankDisplay(audit.provincialOffice),
    municipalityDisplay: displayPtcField(audit, "municipality"),
    barangayDisplay: displayPtcField(audit, "barangay"),
    treesApplied: audit.treesApplied ?? null,
    treesApproved: audit.treesApproved ?? null,
    seedlingsReplacement: audit.seedlingsReplacement ?? null,
    recordedValidityDays: audit.recordedValidityDays ?? null,
    actualValidityDays: audit.actualValidityDays ?? null,
    recordedValidityDisplay: formatValidityDays(audit.recordedValidityDays),
    actualValidityDisplay: formatValidityDays(audit.actualValidityDays),
    actualFee: formNumberValue(audit.actualFee),
    recordedFee: formNumberValue(audit.recordedFee),
    actualFeeAmount: decimalOrZero(audit.actualFee),
    recordedFeeAmount: decimalOrZero(audit.recordedFee),
    feeDifferenceAmount: feeDifference(audit),
    actualFeeDisplay: formatFee(audit.actualFee),
    recordedFeeDisplay: formatFee(audit.recordedFee),
    feeDifferenceDisplay: formatSignedFeeDifference(audit),
    replantedSeedlings: audit.replantedSeedlings ?? null,
    locExemption: audit.locExemption || null,
    locExemptionDisplay: displayLocExemption(audit.locExemption),
    feesMatchDisplay: feesMatch(audit) ? "Yes" : "No",
    replantedSeedlingsDisplay: displayReplantedSeedlings(audit.replantedSeedlings),
    recommendingApproval: audit.recommendingApproval || "",
    approved: audit.approved || "",
    ptcNumberDuplicate: !!audit.ptcNumberDuplicate
  }));

  return (
    <div className="grid">
      <div>
        <h1>PTC Applications</h1>
        <p className="muted">Applicant records with PTC metadata, submitted documents, and missing documents.</p>
        <div className="actions page-title-actions">
          <DashboardRegionFilter path="/applications" options={regionOptions} selected={selectedRegion} version={versionContext.selectedVersionParam} />
          <VersionFilter path="/applications" selected={versionContext.selectedVersionParam} options={versionContext.options} preservedParams={{ region: selectedRegion === "All" ? undefined : selectedRegion }} />
          <Link className="button" href={`/applications/new?version=${versionContext.selectedVersionParam}`}>New Application</Link>
        </div>
      </div>
      <section className="panel">
        <ApplicationsTable
          rows={rows}
          allVersionRecordCount={allVersionsReport.completion.total}
          canBulkDelete={user.role === "ADMIN"}
          versionOptions={versionContext.options}
          selectedVersionParam={versionContext.selectedVersionParam}
          officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))}
          applicationTypes={applicationTypes.map((type) => ({
            id: type.id,
            versionId: type.versionId,
            name: type.name,
            documents: type.documents.map((document) => ({ id: document.id, name: document.name, requirementMode: document.requirementMode }))
          }))}
        />
      </section>
    </div>
  );
}




