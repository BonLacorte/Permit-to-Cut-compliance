"use client";

import { useState } from "react";
import { updateApplicationRecordAction } from "@/app/actions";
import { EditSubmittedFiles, type ApplicationTypeOption } from "@/components/edit-submitted-files";

type RecordDetails = {
  id: string;
  applicantName: string;
  applicationTypeId: string;
  remarks: string;
  selectedDocumentIds: string[];
};

export function EditApplicationButton({ record, applicationTypes }: { record: RecordDetails; applicationTypes: ApplicationTypeOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>Edit Application</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Edit Application</h2>
            <form action={updateApplicationRecordAction} className="form" onSubmit={() => setOpen(false)}>
              <input type="hidden" name="id" value={record.id} />
              <div className="field">
                <label>Name</label>
                <input name="applicantName" defaultValue={record.applicantName} required />
              </div>
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
                <button className="button" type="submit">Save Changes</button>
                <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}