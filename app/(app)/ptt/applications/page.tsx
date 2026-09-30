import { FeatureKey, Role } from "@prisma/client";
import Link from "next/link";
import { PttApplicationsTable } from "@/components/ptt/applications-table";
import { PttDashboardMetricFilter } from "@/components/ptt/dashboard-metric-filter";
import { DashboardRegionFilter } from "@/components/ptc/dashboard-region-filter";
import { ProvincialOfficeFilter } from "@/components/ptc/provincial-office-filter";
import { VersionFilter } from "@/components/ptc/version-filter";
import { requireUser, userHasFeature } from "@/lib/auth";
import { getOfficeChoices, getPttApplicationRecords, getPttTransportTypes, getPttValidityRules, getVersionContext } from "@/lib/data";
import { decimalOrZero, formatAuditTimestamp, formatDate, formatValidityDays } from "@/lib/ptc";
import { filterPttRecordsByProvincialOffice, filterPttRecordsByRegion, formatPttBoolean, PERMIT_GROUP_PTT, pttProvincialOfficeOptions, pttRegionOptions, pttStatus } from "@/lib/ptt";
import { pttCapacityCategoryLabel, pttValidityBasisLabel } from "@/lib/ptt-checks";
import { pttValidityRuleConfig } from "@/lib/ptt-validity-rules";
import { filterPttRecordsByDashboardMetric, resolvePttDashboardMetric } from "@/lib/ptt-dashboard";

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function PttApplicationsPage({ searchParams }: { searchParams?: { version?: string; region?: string | string[]; provincialOffice?: string | string[]; metric?: string | string[] } }) {
  const user = await requireUser();
  const versionContext = await getVersionContext(searchParams?.version, PERMIT_GROUP_PTT);
  const [records, officeChoices, transportTypes, validityRules, feesAccess, validityAccess, vehicleAccess] = await Promise.all([
    getPttApplicationRecords({ versionId: versionContext.selectedVersionId }),
    getOfficeChoices(),
    getPttTransportTypes(),
    getPttValidityRules(),
    userHasFeature(user, FeatureKey.PTT_FEES_CHECKER),
    userHasFeature(user, FeatureKey.PTT_VALIDITY_CHECKER),
    userHasFeature(user, FeatureKey.PTT_VEHICLE_CAPACITY_CHECKER)
  ]);

  const requestedRegion = Array.isArray(searchParams?.region) ? searchParams?.region[0] : searchParams?.region || "All";
  const regionOptions = pttRegionOptions(records);
  const selectedRegion = regionOptions.includes(requestedRegion || "All") ? requestedRegion || "All" : "All";
  const regionalRecords = filterPttRecordsByRegion(records, selectedRegion);
  const provincialOfficeOptions = pttProvincialOfficeOptions(regionalRecords);
  const requestedProvincialOffice = Array.isArray(searchParams?.provincialOffice) ? searchParams?.provincialOffice[0] : searchParams?.provincialOffice || "All";
  const selectedProvincialOffice = provincialOfficeOptions.includes(requestedProvincialOffice || "All") ? requestedProvincialOffice || "All" : "All";
  const selectedMetric = resolvePttDashboardMetric(searchParams?.metric);
  const filteredRecords = filterPttRecordsByDashboardMetric(filterPttRecordsByProvincialOffice(regionalRecords, selectedProvincialOffice), selectedMetric);
  const returnParams = new URLSearchParams();
  returnParams.set("version", versionContext.selectedVersionParam);
  if (selectedRegion !== "All") returnParams.set("region", selectedRegion);
  if (selectedProvincialOffice !== "All") returnParams.set("provincialOffice", selectedProvincialOffice);
  if (selectedMetric !== "total") returnParams.set("metric", selectedMetric);
  const returnTo = `/ptt/applications?${returnParams.toString()}`;

  const rows = filteredRecords.map((record) => ({
    id: record.id,
    versionId: record.versionId || null,
    versionName: record.versionName,
    pttNumber: record.pttNumber || "",
    pttNumberDuplicate: record.pttNumberDuplicate,
    dateIssued: formatDate(record.dateIssued),
    transporterName: record.transporterName || "",
    regionalOffice: record.regionalOffice || "",
    provincialOffice: record.provincialOffice || "",
    transporterAddress: record.transporterAddress || "",
    ptcNumber: record.ptcNumber || "",
    pcaRegistrationCertificateNumber: record.pcaRegistrationCertificateNumber || "",
    pcaRegistrationCertificateDate: formatDate(record.pcaRegistrationCertificateDate),
    businessAddress: record.businessAddress || "",
    boardFeetGranted: formNumberValue(record.boardFeetGranted),
    boardFeetGrantedAmount: decimalOrZero(record.boardFeetGranted),
    certificateOfQuantityVolumeAttached: record.certificateOfQuantityVolumeAttached ?? null,
    certificateOfQuantityVolumeAttachedDisplay: formatPttBoolean(record.certificateOfQuantityVolumeAttached),
    volumeBoardFeet: formNumberValue(record.volumeBoardFeet),
    volumeBoardFeetAmount: decimalOrZero(record.volumeBoardFeet),
    originOfLumber: record.originOfLumber || "",
    destination: record.destination || "",
    consigneeName: record.consigneeName || "",
    consigneePcaRegistration: record.consigneePcaRegistration || "",
    transportType: record.transportType || "",
    actualTransportCategory: record.actualTransportCategory || "",
    actualTransportDisplay: pttCapacityCategoryLabel(record.actualTransportCategory),
    vehiclePlateNumber: record.vehiclePlateNumber || "",
    authorizedDriverName: record.authorizedDriverName || "",
    authorizedDriverContact: record.authorizedDriverContact || "",
    amountPaid: formNumberValue(record.amountPaid),
    amountPaidAmount: decimalOrZero(record.amountPaid),
    actualFee: formNumberValue(record.actualFee),
    actualFeeAmount: decimalOrZero(record.actualFee),
    officialReceiptNumber: record.officialReceiptNumber || "",
    recordedValidityDays: record.recordedValidityDays ?? null,
    actualValidityDays: record.actualValidityDays ?? null,
    validityBasis: record.validityBasis || "",
    validityBasisDisplay: pttValidityBasisLabel(record.validityBasis),
    recordedValidityDisplay: formatValidityDays(record.recordedValidityDays),
    actualValidityDisplay: formatValidityDays(record.actualValidityDays),
    dateValidatedInspected: formatDate(record.dateValidatedInspected),
    validatedInspectedBy: record.validatedInspectedBy || "",
    validatedInspectedBySignatureStatus: record.validatedInspectedBySignatureStatus || null,
    validatedInspectedBySignatureForName: record.validatedInspectedBySignatureForName || "",
    issuedByDate: formatDate(record.issuedByDate),
    issuedBy: record.issuedBy || "",
    issuedBySignatureStatus: record.issuedBySignatureStatus || null,
    issuedBySignatureForName: record.issuedBySignatureForName || "",
    manualRemarks: record.manualRemarks || "",
    remarks: record.remarks || "",
    createdByName: record.createdByName || "",
    createdAt: formatAuditTimestamp(record.createdAt),
    editedByName: record.editedByName || "",
    editedAt: record.editedByName ? formatAuditTimestamp(record.updatedAt) : "",
    status: pttStatus(record)
  }));

  return (
    <div className="grid">
      <div>
        <h1>PTT Applications</h1>
        <p className="muted">Permit-to-Transport records with transport metadata, fees, validity, and issuing details.</p>
        <div className="actions page-title-actions">
          <DashboardRegionFilter path="/ptt/applications" options={regionOptions} selected={selectedRegion} version={versionContext.selectedVersionParam} preservedParams={{ provincialOffice: selectedProvincialOffice === "All" ? undefined : selectedProvincialOffice, metric: selectedMetric === "total" ? undefined : selectedMetric }} />
          <ProvincialOfficeFilter path="/ptt/applications" options={provincialOfficeOptions} selected={selectedProvincialOffice} version={versionContext.selectedVersionParam} preservedParams={{ region: selectedRegion === "All" ? undefined : selectedRegion, metric: selectedMetric === "total" ? undefined : selectedMetric }} />
          <PttDashboardMetricFilter version={versionContext.selectedVersionParam} region={selectedRegion} provincialOffice={selectedProvincialOffice} selected={selectedMetric} />
          <VersionFilter path="/ptt/applications" selected={versionContext.selectedVersionParam} options={versionContext.options} preservedParams={{ region: selectedRegion === "All" ? undefined : selectedRegion, provincialOffice: selectedProvincialOffice === "All" ? undefined : selectedProvincialOffice, metric: selectedMetric === "total" ? undefined : selectedMetric }} />
          <Link className="button" href={`/ptt/applications/new?version=${versionContext.selectedVersionParam}`}>New PTT Application</Link>
          <Link className="button secondary" href={`/api/export?group=PTT&version=${versionContext.selectedVersionParam}`}>Export PTT Excel</Link>
        </div>
      </div>

      <section className="panel">
        <PttApplicationsTable
          checkerAccess={{ fees: feesAccess, validity: validityAccess, vehicle: vehicleAccess }}
          rows={rows}
          officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))}
          transportTypes={transportTypes.map((type) => ({ id: type.id, versionId: type.versionId, name: type.name, active: type.active, capacityCategory: type.capacityCategory, maxBoardFeet: type.maxBoardFeet === null ? null : String(type.maxBoardFeet) }))}
          validityRules={validityRules.map((rule) => ({ versionId: rule.versionId, ...pttValidityRuleConfig(rule) }))}
          versionOptions={versionContext.options}
          selectedVersionParam={versionContext.selectedVersionParam}
          returnTo={returnTo}
          canBulkDelete={user.role === Role.ADMIN || user.role === Role.SUPERADMIN}
        />
      </section>
    </div>
  );
}
