import { createPttApplicationRecordAction } from "@/app/actions";
import { PttRecordFields } from "@/components/ptt-record-fields";
import { SubmitButton } from "@/components/submit-button";
import { getOfficeChoices, getPttTransportTypes, getVersionContext } from "@/lib/data";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";

export default async function NewPttApplicationPage({ searchParams }: { searchParams?: { version?: string } }) {
  const [versionContext, officeChoices, transportTypes] = await Promise.all([
    getVersionContext(searchParams?.version, PERMIT_GROUP_PTT),
    getOfficeChoices(),
    getPttTransportTypes()
  ]);

  return (
    <div className="grid">
      <div>
        <h1>New PTT Application</h1>
        <p className="muted">Create a blank or incomplete Permit-to-Transport record now, then edit the details later.</p>
      </div>
      <section className="panel">
        <form action={createPttApplicationRecordAction} className="form">
          <div className="field">
            <label htmlFor="transporterName">Name</label>
            <input id="transporterName" name="transporterName" />
          </div>
          <PttRecordFields
            versionOptions={versionContext.options}
            officeChoices={officeChoices.map((office) => ({
              id: office.id,
              name: office.name,
              provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
            }))}
            transportTypes={transportTypes.map((type) => ({ id: type.id, versionId: type.versionId, name: type.name, active: type.active }))}
            defaults={{ versionId: versionContext.selectedVersionId }}
          />
          <div className="field">
            <label htmlFor="remarks">Remarks</label>
            <textarea id="remarks" name="remarks" rows={4} />
          </div>
          <SubmitButton pendingText="Saving PTT application...">Save PTT Application</SubmitButton>
        </form>
      </section>
    </div>
  );
}
