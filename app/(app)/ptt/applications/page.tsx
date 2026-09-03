import { FeatureKey } from "@prisma/client";
import Link from "next/link";
import { PttApplicationsTable } from "@/components/ptt-applications-table";
import { VersionFilter } from "@/components/version-filter";
import { requireUser, userHasFeature } from "@/lib/auth";
import { getOfficeChoices, getPttApplicationRecords, getPttTransportTypes, getPttValidityRules, getVersionContext } from "@/lib/data";
import { decimalOrZero, formatDate, formatValidityDays } from "@/lib/ptc";
import { formatPttBoolean, PERMIT_GROUP_PTT, pttStatus } from "@/lib/ptt";
import { pttValidityBasisLabel } from "@/lib/ptt-checks";
import { pttValidityRuleConfig } from "@/lib/ptt-validity-rules";

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function PttApplicationsPage({ searchParams }: { searchParams?: { version?: string } }) {
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

  const rows = records.map((record) => ({
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
    issuedByDate: formatDate(record.issuedByDate),
    issuedBy: record.issuedBy || "",
    manualRemarks: record.manualRemarks || "",
    remarks: record.remarks || "",
    editedByName: record.editedByName || "",
    status: pttStatus(record)
  }));

  return (
    <div className="grid">
      <div>
        <h1>PTT Applications</h1>
        <p className="muted">Permit-to-Transport records with transport metadata, fees, validity, and issuing details.</p>
        <div className="actions page-title-actions">
          <VersionFilter path="/ptt/applications" selected={versionContext.selectedVersionParam} options={versionContext.options} />
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
        />
      </section>
    </div>
  );
}
