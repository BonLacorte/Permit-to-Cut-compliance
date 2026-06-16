import { createRecordAction } from "@/app/actions";
import { getApplicationTypesWithDocuments } from "@/lib/data";
import { DocumentPicker } from "@/components/document-picker";

export default async function NewApplicationPage() {
  const applicationTypes = await getApplicationTypesWithDocuments();

  return (
    <div className="grid">
      <div>
        <h1>New Application</h1>
        <p className="muted">Create an application record. Documents can be appended after saving the record.</p>
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
          <button className="button" type="submit">Save Application</button>
        </form>
      </section>
    </div>
  );
}
