"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { updatePttApplicationRecordAction } from "@/app/actions";
import { PttRecordFields, type PttTransportTypeOption, type PttValidityRuleOption } from "@/components/ptt-record-fields";
import { SubmitButton } from "@/components/submit-button";
import type { VersionOption } from "@/components/document-picker";
import type { OfficeChoice } from "@/lib/ptc";
import { mergeRemarks } from "@/lib/ptc-checks";

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
  actualFee?: string | number | null;
  officialReceiptNumber?: string | null;
  recordedValidityDays?: string | number | null;
  actualValidityDays?: string | number | null;
  validityBasis?: string | null;
  dateValidatedInspected?: string | null;
  validatedInspectedBy?: string | null;
  issuedByDate?: string | null;
  issuedBy?: string | null;
};

export function EditPttApplicationButton({
  checkerAccess,
  record,
  officeChoices,
  transportTypes,
  validityRules,
  versionOptions
}: {
  checkerAccess: { fees: boolean; validity: boolean; vehicle: boolean };
  record: RecordDetails;
  officeChoices: OfficeChoice[];
  transportTypes: PttTransportTypeOption[];
  validityRules: PttValidityRuleOption[];
  versionOptions: VersionOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [manualRemarks, setManualRemarks] = useState(record.remarks);
  const mergedRemarks = useMemo(() => mergeRemarks(manualRemarks, findings), [findings, manualRemarks]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmed) {
      setConfirmed(false);
      setOpen(false);
      return;
    }
    if (findings.length > 0) {
      event.preventDefault();
      setReviewOpen(true);
      return;
    }
    setOpen(false);
  };
  const confirmSave = () => {
    setConfirmed(true);
    setReviewOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  return (
    <>
      <button className="button secondary" type="button" onClick={() => { setManualRemarks(record.remarks); setFindings([]); setOpen(true); }}>Edit PTT Application</button>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal wide-modal">
            <h2>Edit PTT Application</h2>
            <form ref={formRef} action={updatePttApplicationRecordAction} className="form" onSubmit={submit}>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="returnTo" value={record.returnTo} />
              <div className="field">
                <label>Name</label>
                <input name="transporterName" defaultValue={record.transporterName} />
              </div>
              <PttRecordFields defaults={record} officeChoices={officeChoices} transportTypes={transportTypes} validityRules={validityRules} versionOptions={versionOptions} checkerAccess={checkerAccess} onGeneratedFindingsChange={setFindings} />
              <div className="field">
                <label>Remarks</label>
                <textarea name="remarks" value={manualRemarks} onChange={(event) => setManualRemarks(event.target.value)} rows={4} />
              </div>
              <div className="actions">
                <SubmitButton pendingText="Saving changes...">Save Changes</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {reviewOpen ? <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal">
        <h2>Review Generated Findings</h2>
        <p className="muted">These PTT system findings will be shown together with the manual remarks after saving.</p>
        <div className="field"><label>Generated findings</label><div className="readonly-summary">{findings.map((finding) => <p key={finding}>{finding}</p>)}</div></div>
        <div className="field"><label>Final merged remarks</label><textarea readOnly value={mergedRemarks} rows={6} /></div>
        <div className="actions"><button className="button" type="button" onClick={confirmSave}>Confirm and Save</button><button className="button secondary" type="button" onClick={() => setReviewOpen(false)}>Back to Form</button></div>
      </div></div> : null}
    </>
  );
}
