"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { updateApplicationRecordAction } from "@/app/actions";
import { EditSubmittedFiles, type ApplicationTypeOption } from "@/components/edit-submitted-files";
import { PtcRecordFields } from "@/components/ptc-record-fields";
import { SubmitButton } from "@/components/submit-button";
import type { VersionOption } from "@/components/document-picker";
import type { OfficeChoice } from "@/lib/ptc";
import { mergeRemarks } from "@/lib/ptc-checks";

type RecordDetails = {
  id: string;
  versionId: string | null;
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
  recordedValidityDays?: number | null;
  actualValidityDays?: number | null;
  actualFee?: string | number | null;
  recordedFee?: string | number | null;
  officialReceiptNumber?: string | null;
  replantedSeedlings?: boolean | null;
  locExemption?: "Owner" | "Others" | null;
  agriculturist?: string | null;
  recommendingApproval?: string | null;
  approved?: string | null;
};

export function EditApplicationButton({
  record,
  applicationTypes,
  officeChoices,
  versionOptions,
  checkerAccess
}: {
  record: RecordDetails;
  applicationTypes: ApplicationTypeOption[];
  officeChoices: OfficeChoice[];
  versionOptions: VersionOption[];
  checkerAccess: { fees: boolean; validity: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<string[]>([]);
  const [manualRemarks, setManualRemarks] = useState(record.remarks);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const mergedRemarks = useMemo(() => mergeRemarks(manualRemarks, findings), [manualRemarks, findings]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmed) {
      setConfirmed(false);
      setOpen(false);
      return;
    }
    if (findings.length > 0) {
      event.preventDefault();
      setReviewOpen(true);
    } else {
      setOpen(false);
    }
  };

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>Edit Application</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal wide-modal">
            <h2>Edit Application</h2>
            <form ref={formRef} action={updateApplicationRecordAction} className="form" onSubmit={submit}>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="returnTo" value={record.returnTo} />
              <div className="field">
                <label>Name of Applicant</label>
                <input name="applicantName" defaultValue={record.applicantName} />
              </div>
              <PtcRecordFields defaults={record} officeChoices={officeChoices} checkerAccess={checkerAccess} onGeneratedFindingsChange={setFindings} />
              <EditSubmittedFiles
                applicationTypes={applicationTypes}
                versionOptions={versionOptions}
                initialVersionId={record.versionId}
                initialApplicationTypeId={record.applicationTypeId}
                initialDocumentIds={record.selectedDocumentIds}
              />
              <div className="field">
                <label>Remarks</label>
                <textarea name="remarks" value={manualRemarks} onChange={(event) => setManualRemarks(event.target.value)} rows={4} />
              </div>
              <div className="actions">
                <SubmitButton pendingText="Saving changes...">Save Changes</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
            {reviewOpen ? <div className="modal-backdrop nested-modal" role="dialog" aria-modal="true"><div className="modal compact-modal">
              <h2>Review Generated Findings</h2>
              <p className="muted">These system findings will be shown with the manual remarks after saving.</p>
              <div className="field"><label>Generated findings</label><div className="readonly-summary">{findings.map((finding) => <p key={finding}>{finding}</p>)}</div></div>
              <div className="field"><label>Final merged remarks</label><textarea readOnly value={mergedRemarks} rows={6} /></div>
              <div className="actions"><button className="button" type="button" onClick={() => { setConfirmed(true); setReviewOpen(false); window.setTimeout(() => formRef.current?.requestSubmit(), 0); }}>Confirm and Save</button><button className="button secondary" type="button" onClick={() => setReviewOpen(false)}>Back to Form</button></div>
            </div></div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
