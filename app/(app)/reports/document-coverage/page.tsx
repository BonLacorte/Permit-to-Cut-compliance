import Link from "next/link";
import { VersionFilter } from "@/components/version-filter";
import { filterDashboardAuditsByProvincialOffice, filterDashboardAuditsByRegion, dashboardProvincialOfficeName, dashboardRegionName } from "@/lib/dashboard";
import { getReportData, getVersionContext } from "@/lib/data";
import { displayPtcField, formatDate } from "@/lib/ptc";
import { documentCoverage, type RecordAudit, type RequiredDocumentRef } from "@/lib/reporting";

const ALL = "All";
const STATE_ALL = "all";
const STATE_WITH = "with";
const STATE_WITHOUT = "without";

type Search = {
  version?: string | string[];
  region?: string | string[];
  provincialOffice?: string | string[];
  applicationTypeId?: string | string[];
  documentId?: string | string[];
  coverageState?: string | string[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => {
    if (a.startsWith("No ")) return 1;
    if (b.startsWith("No ")) return -1;
    return a.localeCompare(b);
  });
}

function requirementLabel(mode: string) {
  if (mode === "Optional") return "Optional";
  if (mode === "LocConditional") return "LOC Conditional";
  return "Required";
}

function coverageParams({
  version,
  region,
  provincialOffice,
  applicationTypeId,
  documentId,
  coverageState
}: {
  version: string;
  region: string;
  provincialOffice: string;
  applicationTypeId?: string;
  documentId?: string;
  coverageState?: string;
}) {
  const params = new URLSearchParams();
  params.set("version", version);
  if (region && region !== ALL) params.set("region", region);
  if (provincialOffice && provincialOffice !== ALL) params.set("provincialOffice", provincialOffice);
  if (applicationTypeId) params.set("applicationTypeId", applicationTypeId);
  if (documentId) params.set("documentId", documentId);
  if (coverageState && coverageState !== STATE_ALL) params.set("coverageState", coverageState);
  return `/reports/document-coverage?${params.toString()}`;
}

function hasDocument(audit: RecordAudit, documentId: string) {
  return audit.selectedDocumentIds.includes(documentId);
}

export default async function DocumentCoveragePage({ searchParams }: { searchParams?: Search }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const report = await getReportData({ versionId: versionContext.selectedVersionId });
  const selectedRegion = first(searchParams?.region) || ALL;
  const selectedProvincialOffice = first(searchParams?.provincialOffice) || ALL;
  const selectedApplicationTypeId = first(searchParams?.applicationTypeId);
  const selectedDocumentId = first(searchParams?.documentId);
  const selectedCoverageState = first(searchParams?.coverageState) || STATE_ALL;

  const regionOptions = [ALL, ...uniqueSorted(report.audits.map(dashboardRegionName))];
  const regionAudits = filterDashboardAuditsByRegion(report.audits, selectedRegion);
  const provincialOptions = [ALL, ...uniqueSorted(regionAudits.map(dashboardProvincialOfficeName))];
  const filteredAudits = filterDashboardAuditsByProvincialOffice(regionAudits, selectedProvincialOffice);

  const applicationTypes = Array.from(new Map(report.requiredDocuments.map((doc) => [doc.applicationTypeId, doc.applicationTypeName] as const)))
    .sort((a, b) => a[1].localeCompare(b[1]));
  const documentOptions = report.requiredDocuments
    .filter((doc) => !selectedApplicationTypeId || doc.applicationTypeId === selectedApplicationTypeId)
    .sort((a, b) => a.applicationTypeName.localeCompare(b.applicationTypeName) || a.name.localeCompare(b.name));

  let scopedDocuments: RequiredDocumentRef[] = report.requiredDocuments;
  if (selectedApplicationTypeId) scopedDocuments = scopedDocuments.filter((doc) => doc.applicationTypeId === selectedApplicationTypeId);
  if (selectedDocumentId) scopedDocuments = scopedDocuments.filter((doc) => doc.id === selectedDocumentId);
  const rows = documentCoverage(filteredAudits, scopedDocuments)
    .sort((a, b) => a.applicationTypeName.localeCompare(b.applicationTypeName) || a.requiredDocumentName.localeCompare(b.requiredDocumentName));

  const selectedDocument = report.requiredDocuments.find((doc) => doc.id === selectedDocumentId);
  const detailRows = selectedDocument
    ? filteredAudits
        .filter((audit) => audit.applicationTypeId === selectedDocument.applicationTypeId)
        .filter((audit) => selectedCoverageState === STATE_WITH ? hasDocument(audit, selectedDocument.id) : selectedCoverageState === STATE_WITHOUT ? !hasDocument(audit, selectedDocument.id) : true)
        .sort((a, b) => String(a.ptcNumber || "").localeCompare(String(b.ptcNumber || "")))
    : [];

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Document Coverage</h1>
          <p className="muted">See which PTC numbers have or do not have each configured document.</p>
        </div>
        <VersionFilter
          options={versionContext.options}
          selected={versionContext.selectedVersionParam}
          path="/reports/document-coverage"
          preservedParams={{
            region: selectedRegion === ALL ? undefined : selectedRegion,
            provincialOffice: selectedProvincialOffice === ALL ? undefined : selectedProvincialOffice,
            applicationTypeId: selectedApplicationTypeId || undefined,
            documentId: selectedDocumentId || undefined,
            coverageState: selectedCoverageState === STATE_ALL ? undefined : selectedCoverageState
          }}
        />
      </div>

      <form className="panel form" action="/reports/document-coverage">
        <input type="hidden" name="version" value={versionContext.selectedVersionParam} />
        <div className="grid cols-3">
          <div className="field"><label>Region</label><select name="region" defaultValue={selectedRegion}>{regionOptions.map((region) => <option key={region} value={region}>{region}</option>)}</select></div>
          <div className="field"><label>Provincial Office</label><select name="provincialOffice" defaultValue={selectedProvincialOffice}>{provincialOptions.map((office) => <option key={office} value={office}>{office}</option>)}</select></div>
          <div className="field"><label>Type of Application</label><select name="applicationTypeId" defaultValue={selectedApplicationTypeId}><option value="">All Types</option>{applicationTypes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
          <div className="field"><label>Document</label><select name="documentId" defaultValue={selectedDocumentId}><option value="">All Documents</option>{documentOptions.map((doc) => <option key={doc.id} value={doc.id}>{doc.applicationTypeName} - {doc.name}</option>)}</select></div>
          <div className="field"><label>Coverage State</label><select name="coverageState" defaultValue={selectedCoverageState}><option value={STATE_ALL}>All</option><option value={STATE_WITH}>With Document</option><option value={STATE_WITHOUT}>Without Document</option></select></div>
        </div>
        <div className="actions"><button className="button" type="submit">Apply Filters</button><Link className="button secondary" href={`/reports/document-coverage?version=${encodeURIComponent(versionContext.selectedVersionParam)}`}>Clear Filters</Link></div>
      </form>

      <section className="panel table-wrap">
        <h2>Coverage Summary</h2>
        <table>
          <thead><tr><th>Type of Application</th><th>Document</th><th>Requirement</th><th>Total PTCs</th><th>With Document</th><th>Without Document</th><th>Coverage Rate</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.applicationTypeId}:${row.requiredDocumentId}`}>
                <td>{row.applicationTypeName}</td>
                <td>{row.requiredDocumentName}</td>
                <td>{requirementLabel(row.requirementMode)}</td>
                <td>{row.totalRecords}</td>
                <td><Link href={coverageParams({ version: versionContext.selectedVersionParam, region: selectedRegion, provincialOffice: selectedProvincialOffice, applicationTypeId: row.applicationTypeId, documentId: row.requiredDocumentId, coverageState: STATE_WITH })}>{row.withDocumentCount}</Link></td>
                <td><Link href={coverageParams({ version: versionContext.selectedVersionParam, region: selectedRegion, provincialOffice: selectedProvincialOffice, applicationTypeId: row.applicationTypeId, documentId: row.requiredDocumentId, coverageState: STATE_WITHOUT })}>{row.withoutDocumentCount}</Link></td>
                <td>{Math.round(row.coverageRate * 100)}%</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={7}>No document coverage rows found.</td></tr> : null}
          </tbody>
        </table>
      </section>

      {selectedDocument ? <section className="panel table-wrap">
        <h2>PTC Numbers {selectedCoverageState === STATE_WITH ? "With" : selectedCoverageState === STATE_WITHOUT ? "Without" : "For"} {selectedDocument.name}</h2>
        <p className="muted">This list is factual coverage only. Optional documents can be absent without making a record incomplete.</p>
        <table>
          <thead><tr><th>PTC Number</th><th>Date Issued</th><th>Name</th><th>Regional Office</th><th>Provincial Office</th><th>Coverage</th><th>Status</th><th>View</th></tr></thead>
          <tbody>
            {detailRows.map((audit) => {
              const covered = hasDocument(audit, selectedDocument.id);
              return <tr key={audit.id}>
                <td>{audit.ptcNumber || <span className="muted">None</span>}</td>
                <td>{formatDate(audit.dateIssued)}</td>
                <td>{audit.applicantName || <span className="muted">None</span>}</td>
                <td>{displayPtcField(audit, "regionalOffice")}</td>
                <td>{displayPtcField(audit, "provincialOffice")}</td>
                <td>{covered ? "With Document" : "Without Document"}</td>
                <td><span className="badge neutral">{audit.status}</span></td>
                <td><Link className="button secondary" href={`/applications/${audit.id}`}>View</Link></td>
              </tr>;
            })}
            {detailRows.length === 0 ? <tr><td colSpan={8}>No PTC records found for this coverage state.</td></tr> : null}
          </tbody>
        </table>
      </section> : null}
    </div>
  );
}
