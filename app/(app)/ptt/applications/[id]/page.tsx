import { FeatureKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditPttApplicationButton } from "@/components/edit-ptt-application-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser, userHasFeature } from "@/lib/auth";
import { getOfficeChoices, getPttTransportTypes, getVersionContext } from "@/lib/data";
import { formatDate, formatFee, formatValidityDays } from "@/lib/ptc";
import { mergeRemarks } from "@/lib/ptc-checks";
import { displayPttName, formatPttBoolean, formatPttNumber, PERMIT_GROUP_PTT, pttStatus } from "@/lib/ptt";
import { pttValidityBasisLabel } from "@/lib/ptt-checks";
import { prisma } from "@/lib/prisma";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

function metadataValue(value: string) {
  return value || <span className="muted">Blank</span>;
}

function formNumberValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function PttApplicationDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const [record, versionContext, officeChoices, transportTypes, feesAccess, validityAccess, vehicleAccess] = await Promise.all([
    prisma.pttApplicationRecord.findUnique({
      where: { id: params.id },
      include: {
        version: true,
        createdBy: true,
        editedBy: true,
        checkFindings: { where: { active: true }, orderBy: { checkType: "asc" } },
        checkRuns: { include: { appliedBy: true }, orderBy: { createdAt: "desc" } }
      }
    }),
    getVersionContext(null, PERMIT_GROUP_PTT),
    getOfficeChoices(),
    getPttTransportTypes(),
    userHasFeature(user, FeatureKey.PTT_FEES_CHECKER),
    userHasFeature(user, FeatureKey.PTT_VALIDITY_CHECKER),
    userHasFeature(user, FeatureKey.PTT_VEHICLE_CAPACITY_CHECKER)
  ]);

  if (!record) notFound();
  const status = pttStatus(record);
  const recordVersionParam = record.versionId || UNCATEGORIZED_VERSION;
  const dateIssued = formatDate(record.dateIssued);
  const activeFindingMessages = record.checkFindings.map((finding) => finding.message);
  const mergedRemarks = mergeRemarks(record.remarks, activeFindingMessages);

  return (
    <div className="grid">
      <div className="topbar">
        <Link className="button secondary" href={`/ptt/applications?version=${recordVersionParam}`}>Back to PTT Applications</Link>
        <EditPttApplicationButton
          checkerAccess={{ fees: feesAccess, validity: validityAccess, vehicle: vehicleAccess }}
          record={{
            id: record.id,
            versionId: record.versionId,
            transporterName: record.transporterName || "",
            remarks: record.remarks || "",
            returnTo: `/ptt/applications/${record.id}`,
            pttNumber: record.pttNumber || "",
            dateIssued,
            regionalOffice: record.regionalOffice || "",
            provincialOffice: record.provincialOffice || "",
            transporterAddress: record.transporterAddress || "",
            ptcNumber: record.ptcNumber || "",
            pcaRegistrationCertificateNumber: record.pcaRegistrationCertificateNumber || "",
            pcaRegistrationCertificateDate: formatDate(record.pcaRegistrationCertificateDate),
            businessAddress: record.businessAddress || "",
            boardFeetGranted: formNumberValue(record.boardFeetGranted),
            certificateOfQuantityVolumeAttached: record.certificateOfQuantityVolumeAttached,
            volumeBoardFeet: formNumberValue(record.volumeBoardFeet),
            originOfLumber: record.originOfLumber || "",
            destination: record.destination || "",
            consigneeName: record.consigneeName || "",
            consigneePcaRegistration: record.consigneePcaRegistration || "",
            transportType: record.transportType || "",
            vehiclePlateNumber: record.vehiclePlateNumber || "",
            authorizedDriverName: record.authorizedDriverName || "",
            authorizedDriverContact: record.authorizedDriverContact || "",
            amountPaid: formNumberValue(record.amountPaid),
            actualFee: formNumberValue(record.actualFee),
            officialReceiptNumber: record.officialReceiptNumber || "",
            recordedValidityDays: formNumberValue(record.recordedValidityDays),
            actualValidityDays: formNumberValue(record.actualValidityDays),
            validityBasis: record.validityBasis || "",
            dateValidatedInspected: formatDate(record.dateValidatedInspected),
            validatedInspectedBy: record.validatedInspectedBy || "",
            issuedByDate: formatDate(record.issuedByDate),
            issuedBy: record.issuedBy || ""
          }}
          officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))}
          transportTypes={transportTypes.map((type) => ({ id: type.id, versionId: type.versionId, name: type.name, active: type.active, capacityCategory: type.capacityCategory, maxBoardFeet: type.maxBoardFeet === null ? null : String(type.maxBoardFeet) }))}
          versionOptions={versionContext.options}
        />
      </div>

      <div>
        <h1>{displayPttName(record)}</h1>
        <p className="muted">{record.pttNumber ? `PTT Number ${record.pttNumber}` : "No PTT number recorded yet"}</p>
        {mergedRemarks ? <p>{mergedRemarks}</p> : null}
      </div>

      <section className="grid cols-3">
        <div className="card stat"><span>Status</span><strong><StatusBadge status={status} /></strong></div>
        <div className="card stat"><span>Recorded Fee</span><strong>{formatFee(record.amountPaid)}</strong></div>
        <div className="card stat"><span>Actual Fee</span><strong>{formatFee(record.actualFee)}</strong></div>
        <div className="card stat"><span>Volume</span><strong>{formatPttNumber(record.volumeBoardFeet) || "0"}</strong></div>
      </section>

      <section className="panel">
        <h2>PTT System Check Findings</h2>
        {record.checkFindings.length > 0 ? <ul>{record.checkFindings.map((finding) => <li key={finding.id}>{finding.message}</li>)}</ul> : <p className="muted">No active PTT system findings.</p>}
      </section>

      <section className="panel">
        <h2>PTT Check History</h2>
        <div className="table-wrap"><table><thead><tr><th>Check</th><th>Result</th><th>Applied By</th><th>Date</th></tr></thead><tbody>
          {record.checkRuns.map((run) => <tr key={run.id}><td>{run.checkType}</td><td>{JSON.stringify(run.outputSnapshot)}</td><td>{run.appliedBy.name}</td><td>{formatDate(run.createdAt)}</td></tr>)}
          {record.checkRuns.length === 0 ? <tr><td colSpan={4}>No PTT checker results saved.</td></tr> : null}
        </tbody></table></div>
      </section>

      <section className="panel">
        <div className="section-heading-row">
          <div>
            <h2>PTT Record Information</h2>
            <p className="muted">Metadata from the Permit-to-Transport form. Blank amounts are treated as 0 only in totals and display.</p>
          </div>
        </div>
        <div className="metadata-grid">
          <div><span>Version</span><strong>{record.version?.name || "Uncategorized"}</strong></div>
          <div><span>Date Issued</span><strong>{metadataValue(dateIssued)}</strong></div>
          <div><span>PTT Number</span><strong>{metadataValue(record.pttNumber || "")}</strong></div>
          <div><span>Regional Office</span><strong>{metadataValue(record.regionalOffice || "")}</strong></div>
          <div><span>Provincial Office</span><strong>{metadataValue(record.provincialOffice || "")}</strong></div>
          <div><span>Name</span><strong>{metadataValue(record.transporterName || "")}</strong></div>
          <div><span>Transporter Address</span><strong>{metadataValue(record.transporterAddress || "")}</strong></div>
          <div><span>PTC Number</span><strong>{metadataValue(record.ptcNumber || "")}</strong></div>
          <div><span>PCA Registration Certificate Number</span><strong>{metadataValue(record.pcaRegistrationCertificateNumber || "")}</strong></div>
          <div><span>PCA Registration Certificate Date</span><strong>{metadataValue(formatDate(record.pcaRegistrationCertificateDate))}</strong></div>
          <div><span>Business Address</span><strong>{metadataValue(record.businessAddress || "")}</strong></div>
          <div><span>Board Feet Granted</span><strong>{metadataValue(formatPttNumber(record.boardFeetGranted))}</strong></div>
          <div><span>Certificate of Quantity/Volume Attached</span><strong>{metadataValue(formatPttBoolean(record.certificateOfQuantityVolumeAttached))}</strong></div>
          <div><span>Volume of Lumber to be Transported</span><strong>{metadataValue(formatPttNumber(record.volumeBoardFeet))}</strong></div>
          <div><span>Origin of Lumber</span><strong>{metadataValue(record.originOfLumber || "")}</strong></div>
          <div><span>Destination/s</span><strong>{metadataValue(record.destination || "")}</strong></div>
          <div><span>Consignee Name / Business Name</span><strong>{metadataValue(record.consigneeName || "")}</strong></div>
          <div><span>PCA Registration of Consignee</span><strong>{metadataValue(record.consigneePcaRegistration || "")}</strong></div>
          <div><span>Type of Transport Used</span><strong>{metadataValue(record.transportType || "")}</strong></div>
          <div><span>Plate / Container / Vessel Number</span><strong>{metadataValue(record.vehiclePlateNumber || "")}</strong></div>
          <div><span>Authorized Driver Name</span><strong>{metadataValue(record.authorizedDriverName || "")}</strong></div>
          <div><span>Authorized Driver Contact</span><strong>{metadataValue(record.authorizedDriverContact || "")}</strong></div>
          <div><span>Recorded Fee</span><strong>{formatFee(record.amountPaid)}</strong></div>
          <div><span>Actual Fee</span><strong>{formatFee(record.actualFee)}</strong></div>
          <div><span>Official Receipt Number</span><strong>{metadataValue(record.officialReceiptNumber || "")}</strong></div>
          <div><span>Validity Basis</span><strong>{metadataValue(pttValidityBasisLabel(record.validityBasis))}</strong></div>
          <div><span>Recorded Validity</span><strong>{metadataValue(formatValidityDays(record.recordedValidityDays))}</strong></div>
          <div><span>Actual Validity</span><strong>{metadataValue(formatValidityDays(record.actualValidityDays))}</strong></div>
          <div><span>Date Validated/Inspected</span><strong>{metadataValue(formatDate(record.dateValidatedInspected))}</strong></div>
          <div><span>Validated/Inspected By</span><strong>{metadataValue(record.validatedInspectedBy || "")}</strong></div>
          <div><span>Issued By Date</span><strong>{metadataValue(formatDate(record.issuedByDate))}</strong></div>
          <div><span>Issued By</span><strong>{metadataValue(record.issuedBy || "")}</strong></div>
          <div><span>Edited By</span><strong>{metadataValue(record.editedBy?.name || "")}</strong></div>
        </div>
      </section>
    </div>
  );
}
