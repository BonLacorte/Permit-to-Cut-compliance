import Link from "next/link";
import { PttApplicationsTable } from "@/components/ptt-applications-table";
import { VersionFilter } from "@/components/version-filter";
import { getOfficeChoices, getPttApplicationRecords, getPttTransportTypes, getVersionContext } from "@/lib/data";
import { decimalOrZero, formatDate } from "@/lib/ptc";
import { formatPttBoolean, PERMIT_GROUP_PTT, pttStatus } from "@/lib/ptt";

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function PttApplicationsPage({ searchParams }: { searchParams?: { version?: string } }) {
  const versionContext = await getVersionContext(searchParams?.version, PERMIT_GROUP_PTT);
  const [records, officeChoices, transportTypes] = await Promise.all([
    getPttApplicationRecords({ versionId: versionContext.selectedVersionId }),
    getOfficeChoices(),
    getPttTransportTypes()
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
    officialReceiptNumber: record.officialReceiptNumber || "",
    validUntil: formatDate(record.validUntil),
    dateValidatedInspected: formatDate(record.dateValidatedInspected),
    validatedInspectedBy: record.validatedInspectedBy || "",
    issuedBy: record.issuedBy || "",
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
          rows={rows}
          officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))}
          transportTypes={transportTypes.map((type) => ({ id: type.id, versionId: type.versionId, name: type.name, active: type.active }))}
          versionOptions={versionContext.options}
          selectedVersionParam={versionContext.selectedVersionParam}
        />
      </section>
    </div>
  );
}
