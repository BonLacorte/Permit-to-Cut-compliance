"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { createRecordAction } from "@/app/actions";
import { DocumentPicker, type VersionOption } from "@/components/document-picker";
import { PtcRecordFields } from "@/components/ptc-record-fields";
import { SubmitButton } from "@/components/submit-button";
import { mergeRemarks } from "@/lib/ptc-checks";
import type { OfficeChoice } from "@/lib/ptc";

type ApplicationTypeOption = { id: string; versionId: string; name: string; documents: { id: string; name: string; requirementMode: "Required" | "Optional" | "LocConditional" }[] };

export function NewPtcApplicationForm({ applicationTypes, officeChoices, versionOptions, initialVersionId, checkerAccess }: {
  applicationTypes: ApplicationTypeOption[];
  officeChoices: OfficeChoice[];
  versionOptions: VersionOption[];
  initialVersionId: string | null;
  checkerAccess: { fees: boolean; validity: boolean };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [findings, setFindings] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [manualRemarks, setManualRemarks] = useState("");
  const mergedRemarks = useMemo(() => mergeRemarks(manualRemarks, findings), [findings, manualRemarks]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmed) {
      setConfirmed(false);
      return;
    }
    if (findings.length > 0) {
      event.preventDefault();
      setReviewOpen(true);
    }
  };
  const confirmSave = () => {
    setConfirmed(true);
    setReviewOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  return <>
    <form ref={formRef} action={createRecordAction} className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="applicantName">Name of Applicant</label>
        <input id="applicantName" name="applicantName" />
      </div>
      <PtcRecordFields officeChoices={officeChoices} checkerAccess={checkerAccess} onGeneratedFindingsChange={setFindings} />
      <DocumentPicker applicationTypes={applicationTypes} versionOptions={versionOptions} initialVersionId={initialVersionId} />
      <div className="field">
        <label htmlFor="remarks">Remarks</label>
        <textarea id="remarks" name="remarks" rows={4} value={manualRemarks} onChange={(event) => setManualRemarks(event.target.value)} />
      </div>
      <SubmitButton pendingText="Saving application...">Save Application</SubmitButton>
    </form>
    {reviewOpen ? <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal">
      <h2>Review Generated Findings</h2>
      <p className="muted">These system findings will be shown together with the manual remarks after saving.</p>
      <div className="field"><label>Generated findings</label><div className="readonly-summary">{findings.map((finding) => <p key={finding}>{finding}</p>)}</div></div>
      <div className="field"><label>Final merged remarks</label><textarea readOnly value={mergedRemarks} rows={6} /></div>
      <div className="actions"><button className="button" type="button" onClick={confirmSave}>Confirm and Save</button><button className="button secondary" type="button" onClick={() => setReviewOpen(false)}>Back to Form</button></div>
    </div></div> : null}
  </>;
}
