"use client";

import { useState } from "react";
import { updateApplicationRecordAction } from "@/app/actions";
import { EditSubmittedFiles, type ApplicationTypeOption } from "@/components/edit-submitted-files";
import { PtcRecordFields } from "@/components/ptc-record-fields";
import { SubmitButton } from "@/components/submit-button";

type RecordDetails = {
  id: string;
  applicantName: string;
  applicationTypeId: string | null;
  remarks: string;
  selectedDocumentIds: string[];
  returnTo: string;
  dateIssued?: string | null;
  ptcNumber?: string | null;
  regionalOffice?: string | null;
  provincialOffice?: string | null;
  municipality?: string | null;
  barangay?: string | null;
  treesApplied?: number | null;
  treesApproved?: number | null;
  seedlingsReplacement?: number | null;
};

export function EditApplicationButton({ record, applicationTypes }: { record: RecordDetails; applicationTypes: ApplicationTypeOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>Edit Application</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal wide-modal">
            <h2>Edit Application</h2>
            <form action={updateApplicationRecordAction} className="form" onSubmit={() => setOpen(false)}>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="returnTo" value={record.returnTo} />
              <div className="field">
                <label>Name of Applicant</label>
                <input name="applicantName" defaultValue={record.applicantName} />
              </div>
              <PtcRecordFields defaults={record} />
              <EditSubmittedFiles
                applicationTypes={applicationTypes}
                initialApplicationTypeId={record.applicationTypeId}
                initialDocumentIds={record.selectedDocumentIds}
              />
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