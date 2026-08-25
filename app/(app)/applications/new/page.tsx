import { NewPtcApplicationForm } from "@/components/new-ptc-application-form";
import { requireUser, userHasFeature } from "@/lib/auth";
import { getApplicationTypesWithDocuments, getOfficeChoices, getVersionContext } from "@/lib/data";
import { FeatureKey } from "@prisma/client";

export default async function NewApplicationPage({ searchParams }: { searchParams?: { version?: string } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const [user, applicationTypes, officeChoices] = await Promise.all([
    requireUser(),
    getApplicationTypesWithDocuments(),
    getOfficeChoices()
  ]);
  const [fees, validity] = await Promise.all([
    userHasFeature(user, FeatureKey.PTC_FEES_CHECKER),
    userHasFeature(user, FeatureKey.PTC_VALIDITY_CHECKER)
  ]);

  return (
    <div className="grid">
      <div>
        <h1>New PTC Application</h1>
        <p className="muted">Create a blank or incomplete PTC record now, then edit the details later.</p>
      </div>
      <section className="panel">
        <NewPtcApplicationForm
          applicationTypes={applicationTypes.map((type) => ({
            id: type.id,
            versionId: type.versionId,
            name: type.name,
            documents: type.documents.map((document) => ({ id: document.id, name: document.name, requirementMode: document.requirementMode }))
          }))}
          officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))}
          versionOptions={versionContext.options}
          initialVersionId={versionContext.selectedVersionId}
          checkerAccess={{ fees, validity }}
        />
      </section>
    </div>
  );
}
