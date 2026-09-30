import Link from "next/link";
import { ApplicationsTable } from "@/components/ptc/applications-table";
import { DashboardMetricFilter } from "@/components/ptc/dashboard-metric-filter";
import { DashboardRegionFilter } from "@/components/ptc/dashboard-region-filter";
import { ProvincialOfficeFilter } from "@/components/ptc/provincial-office-filter";
import { VersionFilter } from "@/components/ptc/version-filter";
import { requireUser, userHasFeature } from "@/lib/auth";
import { getApplicationTypesWithDocuments, getOfficeChoices, getReportData, getVersionContext } from "@/lib/data";
import { dashboardProvincialOfficeOptions, dashboardRegionOptions, filterDashboardAuditsByMetric, filterDashboardAuditsByProvincialOffice, filterDashboardAuditsByRegion, resolveDashboardMetric } from "@/lib/dashboard";
import { blankDisplay, decimalOrZero, displayPtcField, displayLocExemption, displayReplantedSeedlings, feesMatch, feeDifference, formatAuditTimestamp, formatDate, formatFee, formatSignedFeeDifference, formatValidityDays } from "@/lib/ptc";
import { FeatureKey, Role } from "@prisma/client";

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function firstQueryValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function applicationsPath({ version, region, provincialOffice, metric }: { version: string; region: string; provincialOffice: string; metric: string }) {
  const params = new URLSearchParams();
  params.set("version", version);
  if (region !== "All") params.set("region", region);
  if (provincialOffice !== "All") params.set("provincialOffice", provincialOffice);
  if (metric !== "total") params.set("metric", metric);
  return `/ptc/applications?${params.toString()}`;
}

export default async function ApplicationsPage({ searchParams }: { searchParams?: { version?: string; region?: string | string[]; provincialOffice?: string | string[]; metric?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const [user, selectedReport, allVersionsReport, applicationTypes, officeChoices] = await Promise.all([
    requireUser(),
    getReportData({ versionId: versionContext.selectedVersionId }),
    getReportData(),
    getApplicationTypesWithDocuments(),
    getOfficeChoices()
  ]);
  const regionOptions = dashboardRegionOptions(selectedReport.audits);
  const [fees, validity] = await Promise.all([
    userHasFeature(user, FeatureKey.PTC_FEES_CHECKER),
    userHasFeature(user, FeatureKey.PTC_VALIDITY_CHECKER)
  ]);
  const requestedRegion = firstQueryValue(searchParams?.region) || "All";
  const selectedRegion = regionOptions.includes(requestedRegion) ? requestedRegion : "All";
  const regionAudits = filterDashboardAuditsByRegion(selectedReport.audits, selectedRegion);
  const provincialOfficeOptions = dashboardProvincialOfficeOptions(regionAudits);
  const requestedProvincialOffice = firstQueryValue(searchParams?.provincialOffice) || "All";
  const selectedProvincialOffice = provincialOfficeOptions.includes(requestedProvincialOffice) ? requestedProvincialOffice : "All";
  const selectedMetric = resolveDashboardMetric(searchParams?.metric);
  const audits = filterDashboardAuditsByMetric(filterDashboardAuditsByProvincialOffice(regionAudits, selectedProvincialOffice), selectedMetric);
  const returnTo = applicationsPath({
    version: versionContext.selectedVersionParam,
    region: selectedRegion,
    provincialOffice: selectedProvincialOffice,
    metric: selectedMetric
  });

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
    manualRemarks: audit.manualRemarks || "",
    createdByName: audit.createdByName || "",
    createdAt: formatAuditTimestamp(audit.createdAt),
    editedByName: audit.editedByName || "",
    editedAt: audit.editedByName ? formatAuditTimestamp(audit.updatedAt) : "",
    dateIssued: formatDate(audit.dateIssued),
    dateIssuedValue: audit.dateIssued ? new Date(audit.dateIssued).toISOString().slice(0, 10) : "",
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
    officialReceiptNumber: audit.officialReceiptNumber || "",
    feesMatchDisplay: feesMatch(audit) ? "Yes" : "No",
    replantedSeedlingsDisplay: displayReplantedSeedlings(audit.replantedSeedlings),
    agriculturist: audit.agriculturist || "",
    recommendingApproval: audit.recommendingApproval || "",
    recommendingApprovalSignatureStatus: audit.recommendingApprovalSignatureStatus || null,
    recommendingApprovalSignatureForName: audit.recommendingApprovalSignatureForName || "",
    approved: audit.approved || "",
    approvedSignatureStatus: audit.approvedSignatureStatus || null,
    approvedSignatureForName: audit.approvedSignatureForName || "",
    ptcNumberDuplicate: !!audit.ptcNumberDuplicate
  }));

  return (
    <div className="grid">
      <div>
        <h1>PTC Applications</h1>
        <p className="muted">Applicant records with PTC metadata, submitted documents, and missing documents.</p>
        <div className="actions page-title-actions">
          <DashboardRegionFilter path="/ptc/applications" options={regionOptions} selected={selectedRegion} version={versionContext.selectedVersionParam} preservedParams={{ provincialOffice: selectedProvincialOffice === "All" ? undefined : selectedProvincialOffice, metric: selectedMetric === "total" ? undefined : selectedMetric }} />
          <ProvincialOfficeFilter path="/ptc/applications" options={provincialOfficeOptions} selected={selectedProvincialOffice} version={versionContext.selectedVersionParam} preservedParams={{ region: selectedRegion === "All" ? undefined : selectedRegion, metric: selectedMetric === "total" ? undefined : selectedMetric }} />
          <DashboardMetricFilter version={versionContext.selectedVersionParam} region={selectedRegion} provincialOffice={selectedProvincialOffice} selected={selectedMetric} />
          <VersionFilter path="/ptc/applications" selected={versionContext.selectedVersionParam} options={versionContext.options} preservedParams={{ region: selectedRegion === "All" ? undefined : selectedRegion, provincialOffice: selectedProvincialOffice === "All" ? undefined : selectedProvincialOffice, metric: selectedMetric === "total" ? undefined : selectedMetric }} />
          <Link className="button" href={`/ptc/applications/new?version=${versionContext.selectedVersionParam}`}>New Application</Link>
        </div>
      </div>
      <section className="panel">
        <ApplicationsTable
          rows={rows}
          allVersionRecordCount={allVersionsReport.completion.total}
          canBulkDelete={user.role === Role.ADMIN || user.role === Role.SUPERADMIN}
          checkerAccess={{ fees, validity }}
          versionOptions={versionContext.options}
          selectedVersionParam={versionContext.selectedVersionParam}
          returnTo={returnTo}
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



