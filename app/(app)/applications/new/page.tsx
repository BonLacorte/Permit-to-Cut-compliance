import { createRecordAction } from "@/app/actions";
import { DocumentPicker } from "@/components/document-picker";
import { PtcRecordFields } from "@/components/ptc-record-fields";
import { SubmitButton } from "@/components/submit-button";
import { getApplicationTypesWithDocuments, getOfficeChoices, getVersionContext } from "@/lib/data";

export default async function NewApplicationPage({ searchParams }: { searchParams?: { version?: string } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const [applicationTypes, officeChoices] = await Promise.all([
    getApplicationTypesWithDocuments(),
    getOfficeChoices()
  ]);

  return (
    <div className="grid">
      <div>
        <h1>New PTC Application</h1>
        <p className="muted">Create a blank or incomplete PTC record now, then edit the details later.</p>
      </div>
      <section className="panel">
        <form action={createRecordAction} className="form">
          <div className="field">
            <label htmlFor="applicantName">Name of Applicant</label>
            <input id="applicantName" name="applicantName" />
          </div>
          <PtcRecordFields officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))} />
          <DocumentPicker
            applicationTypes={applicationTypes.map((type) => ({
              id: type.id,
              versionId: type.versionId,
              name: type.name,
              documents: type.documents.map((document) => ({ id: document.id, name: document.name, requirementMode: document.requirementMode }))
            }))}
            versionOptions={versionContext.options}
            initialVersionId={versionContext.selectedVersionId}
          />
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
