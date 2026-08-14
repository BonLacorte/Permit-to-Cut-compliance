"use client";

import { useState } from "react";
import { updatePttApplicationRecordAction } from "@/app/actions";
import { PttRecordFields, type PttTransportTypeOption } from "@/components/ptt-record-fields";
import { SubmitButton } from "@/components/submit-button";
import type { VersionOption } from "@/components/document-picker";
import type { OfficeChoice } from "@/lib/ptc";

type RecordDetails = {
  id: string;
  versionId: string | null;
  transporterName: string;
  remarks: string;
  returnTo: string;
  pttNumber?: string | null;
  dateIssued?: string | null;
  regionalOffice?: string | null;
  provincialOffice?: string | null;
  transporterAddress?: string | null;
  ptcNumber?: string | null;
  pcaRegistrationCertificateNumber?: string | null;
  pcaRegistrationCertificateDate?: string | null;
  businessAddress?: string | null;
  boardFeetGranted?: string | number | null;
  certificateOfQuantityVolumeAttached?: boolean | null;
  volumeBoardFeet?: string | number | null;
  originOfLumber?: string | null;
  destination?: string | null;
  consigneeName?: string | null;
  consigneePcaRegistration?: string | null;
  transportType?: string | null;
  vehiclePlateNumber?: string | null;
  authorizedDriverName?: string | null;
  authorizedDriverContact?: string | null;
  amountPaid?: string | number | null;
  officialReceiptNumber?: string | null;
  recordedValidityDays?: string | number | null;
  actualValidityDays?: string | number | null;
  dateValidatedInspected?: string | null;
  validatedInspectedBy?: string | null;
  issuedByDate?: string | null;
  issuedBy?: string | null;
};

export function EditPttApplicationButton({
  record,
  officeChoices,
  transportTypes,
  versionOptions
}: {
  record: RecordDetails;
  officeChoices: OfficeChoice[];
  transportTypes: PttTransportTypeOption[];
  versionOptions: VersionOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>Edit PTT Application</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal wide-modal">
            <h2>Edit PTT Application</h2>
            <form action={updatePttApplicationRecordAction} className="form" onSubmit={() => setOpen(false)}>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="returnTo" value={record.returnTo} />
              <div className="field">
                <label>Name</label>
                <input name="transporterName" defaultValue={record.transporterName} />
              </div>
              <PttRecordFields defaults={record} officeChoices={officeChoices} transportTypes={transportTypes} versionOptions={versionOptions} />
              <div className="field">
                <label>Remarks</label>
                <textarea name="remarks" defaultValue={record.remarks} rows={4} />
              </div>
              <div className="actions">
                <SubmitButton pendingText="Saving changes...">Save Changes</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
