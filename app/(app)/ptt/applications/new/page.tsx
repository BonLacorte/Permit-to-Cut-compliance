import { FeatureKey } from "@prisma/client";
import { NewPttApplicationForm } from "@/components/new-ptt-application-form";
import { requireUser, userHasFeature } from "@/lib/auth";
import { getOfficeChoices, getPttTransportTypes, getPttValidityRules, getVersionContext } from "@/lib/data";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import { pttValidityRuleConfig } from "@/lib/ptt-validity-rules";

export default async function NewPttApplicationPage({ searchParams }: { searchParams?: { version?: string } }) {
  const user = await requireUser();
  const [versionContext, officeChoices, transportTypes, validityRules, feesAccess, validityAccess, vehicleAccess] = await Promise.all([
    getVersionContext(searchParams?.version, PERMIT_GROUP_PTT),
    getOfficeChoices(),
    getPttTransportTypes(),
    getPttValidityRules(),
    userHasFeature(user, FeatureKey.PTT_FEES_CHECKER),
    userHasFeature(user, FeatureKey.PTT_VALIDITY_CHECKER),
    userHasFeature(user, FeatureKey.PTT_VEHICLE_CAPACITY_CHECKER)
  ]);

  return (
    <div className="grid">
      <div>
        <h1>New PTT Application</h1>
        <p className="muted">Create a blank or incomplete Permit-to-Transport record now, then edit the details later.</p>
      </div>
      <section className="panel">
        <NewPttApplicationForm
          versionOptions={versionContext.options}
          officeChoices={officeChoices.map((office) => ({
            id: office.id,
            name: office.name,
            provincialOffices: office.provincialOffices.map((provincial) => ({ id: provincial.id, name: provincial.name }))
          }))}
          transportTypes={transportTypes.map((type) => ({
            id: type.id,
            versionId: type.versionId,
            name: type.name,
            active: type.active,
            capacityCategory: type.capacityCategory,
            maxBoardFeet: type.maxBoardFeet === null ? null : String(type.maxBoardFeet)
          }))}
          validityRules={validityRules.map((rule) => ({ versionId: rule.versionId, ...pttValidityRuleConfig(rule) }))}
          initialVersionId={versionContext.selectedVersionId}
          checkerAccess={{ fees: feesAccess, validity: validityAccess, vehicle: vehicleAccess }}
        />
      </section>
    </div>
  );
}
