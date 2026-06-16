import { createRecordAction } from "@/app/actions";
import { DocumentPicker } from "@/components/document-picker";
import { SubmitButton } from "@/components/submit-button";
import { getApplicationTypesWithDocuments } from "@/lib/data";

export default async function NewApplicationPage() {
  const applicationTypes = await getApplicationTypesWithDocuments();

  return (
    <div className="grid">
      <div>
        <h1>New Application</h1>
        <p className="muted">Create an application record and select the submitted documents in one step.</p>
      </div>
      <section className="panel">
        <form action={createRecordAction} className="form">
          <div className="field">
            <label htmlFor="applicantName">Name</label>
            <input id="applicantName" name="applicantName" required />
          </div>
          <DocumentPicker applicationTypes={applicationTypes} />
          <div className="field">
            <label htmlFor="remarks">Remarks</label>
            <textarea id="remarks" name="remarks" rows={4} />
          </div>
          <SubmitButton pendingText="Saving application...">Save Application</SubmitButton>
        </form>
      </section>
    </div>
  );
}