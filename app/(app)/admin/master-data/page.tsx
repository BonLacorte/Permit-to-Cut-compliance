import Link from "next/link";
import {
  clonePtcVersionAction,
  createApplicationTypeAction,
  createProvincialOfficeAction,
  createPttVersionAction,
  createPttTransportTypeAction,
  createPtcVersionAction,
  createRegionalOfficeAction,
  createRequiredDocumentAction,
  deleteApplicationTypeAction,
  deleteProvincialOfficeAction,
  deletePttVersionAction,
  deletePttTransportTypeAction,
  deletePtcVersionAction,
  deleteRegionalOfficeAction,
  deleteRequiredDocumentAction,
  hardDeleteApplicationTypeAction,
  hardDeleteProvincialOfficeAction,
  hardDeletePttVersionAction,
  hardDeletePttTransportTypeAction,
  hardDeletePtcVersionAction,
  hardDeleteRegionalOfficeAction,
  hardDeleteRequiredDocumentAction,
  importPtcRecordsAction,
  importPttRecordsAction,
  restoreApplicationTypeAction,
  restoreProvincialOfficeAction,
  restorePttVersionAction,
  restorePttTransportTypeAction,
  restorePtcVersionAction,
  restoreRegionalOfficeAction,
  restoreRequiredDocumentAction,
  updateApplicationTypeAction,
  updateProvincialOfficeAction,
  updatePttVersionAction,
  updatePttTransportTypeAction,
  updatePtcVersionAction,
  updateRegionalOfficeAction,
  updateRequiredDocumentAction
} from "@/app/actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { ExportExcelButton } from "@/components/export-excel-button";
import { ImportCheckerPanel } from "@/components/import-checker-panel";
import { PtcCalculationRulesManager } from "@/components/ptc-calculation-rules-manager";
import { SubmitButton } from "@/components/submit-button";
import { VersionFilter } from "@/components/version-filter";
import { requireAdmin } from "@/lib/auth";
import { getApplicationTypesWithDocuments, getDeactivatedMasterData, getOfficeChoices, getPttTransportTypes, getVersionContext } from "@/lib/data";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import { prisma } from "@/lib/prisma";
import { ruleConfig } from "@/lib/ptc-calculation-rules";
import { Role } from "@prisma/client";

type MasterDataTab = "general" | "ptc" | "ptt" | "imports" | "deactivated";

const MASTER_DATA_TABS: { id: MasterDataTab; label: string; description: string }[] = [
  { id: "general", label: "General", description: "Regional and provincial offices" },
  { id: "ptc", label: "PTC", description: "Versions, application types, documents, and rules" },
  { id: "ptt", label: "PTT", description: "Versions and transport types" },
  { id: "imports", label: "Imports / Exports", description: "Excel tools and filters" },
  { id: "deactivated", label: "Deactivated Data", description: "Restore or permanently delete" }
];

function activeMasterDataTab(value?: string): MasterDataTab {
  return MASTER_DATA_TABS.some((tab) => tab.id === value) ? value as MasterDataTab : "general";
}

function masterDataHref(tab: MasterDataTab, version?: string) {
  const params = new URLSearchParams({ tab });
  if (version && (tab === "ptc" || tab === "imports")) params.set("version", version);
  return `/admin/master-data?${params.toString()}`;
}

function returnField(returnTo: string) {
  return <input type="hidden" name="returnTo" value={returnTo} />;
}

function fieldsWithReturn(fields: { name: string; value: string }[], returnTo: string) {
  return [...fields, { name: "returnTo", value: returnTo }];
}
function requirementBadge(requirementMode: string) {
  if (requirementMode === "Optional") return <span className="badge neutral">Optional</span>;
  if (requirementMode === "LocConditional") return <span className="badge neutral">LOC Conditional</span>;
  return null;
}

function RequirementModeSelect({ defaultValue = "Required", disabled = false }: { defaultValue?: string; disabled?: boolean }) {
  return (
    <select name="requirementMode" defaultValue={defaultValue} disabled={disabled}>
      <option value="Required">Required</option>
      <option value="Optional">Optional</option>
      <option value="LocConditional">Conditional on LOC Exemption</option>
    </select>
  );
}
export default async function MasterDataPage({ searchParams }: { searchParams?: { version?: string; tab?: string } }) {
  const user = await requireAdmin();
  const activeTab = activeMasterDataTab(searchParams?.tab);
  const versionContext = await getVersionContext(searchParams?.version);
  const pttVersionContext = await getVersionContext(null, PERMIT_GROUP_PTT);
  const selectedVersionId = versionContext.selectedVersionId;
  const emptyDeactivated = {
    versions: [],
    applicationTypes: [],
    requiredDocuments: [],
    regionalOffices: [],
    provincialOffices: [],
    pttVersions: [],
    pttTransportTypes: []
  };
  const [applicationTypes, officeChoices, deactivated, calculationRules, pttTransportTypes] = await Promise.all([
    activeTab === "ptc" ? getApplicationTypesWithDocuments({ versionId: selectedVersionId }) : Promise.resolve([]),
    activeTab === "general" || activeTab === "imports" ? getOfficeChoices() : Promise.resolve([]),
    activeTab === "deactivated" ? getDeactivatedMasterData() : Promise.resolve(emptyDeactivated),
    activeTab === "ptc" && user.role === Role.SUPERADMIN && selectedVersionId
      ? prisma.ptcCalculationRule.findMany({ where: { versionId: selectedVersionId }, orderBy: { applicationTypeId: "asc" } })
      : Promise.resolve([]),
    activeTab === "ptt" ? getPttTransportTypes(true) : Promise.resolve([])
  ]);
  const deactivatedCount =
    deactivated.versions.length +
    deactivated.applicationTypes.length +
    deactivated.requiredDocuments.length +
    deactivated.regionalOffices.length +
    deactivated.provincialOffices.length +
    deactivated.pttVersions.length +
    deactivated.pttTransportTypes.length;
  const returnToGeneral = masterDataHref("general");
  const returnToPtc = masterDataHref("ptc", versionContext.selectedVersionParam);
  const returnToPtt = masterDataHref("ptt");
  const returnToImports = masterDataHref("imports", versionContext.selectedVersionParam);
  const returnToDeactivated = masterDataHref("deactivated");

  return (
    <div className="grid">
      <div className="topbar master-data-topbar">
        <div>
          <h1>Master Data</h1>
          <p className="muted">Manage PTC, PTT, shared offices, imports, and regional exports from one control center.</p>
        </div>
      </div>

      <nav className="master-data-tabs" aria-label="Master Data sections">
        {MASTER_DATA_TABS.map((tab) => (
          <Link
            key={tab.id}
            className={`master-data-tab ${activeTab === tab.id ? "active" : ""}`}
            href={masterDataHref(tab.id, searchParams?.version)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span>{tab.label}</span>
            <small>{tab.description}</small>
          </Link>
        ))}
      </nav>

      {activeTab === "ptc" ? (
        <>
          <div className="master-data-group-title"><h2>PTC Master Data</h2><p className="muted">Manage PTC versions, application types, and document requirements.</p></div>
          <div className="actions"><VersionFilter path="/admin/master-data" selected={versionContext.selectedVersionParam} options={versionContext.options} preservedParams={{ tab: "ptc" }} /></div>

      <section className="grid cols-2">
        <form action={createPtcVersionAction} className="panel form">
          {returnField(returnToPtc)}
          <h2>Add Version</h2>
          <div className="field">
            <label htmlFor="versionName">Version</label>
            <input id="versionName" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="versionDescription">Description</label>
            <input id="versionDescription" name="description" placeholder="Optional notes" />
          </div>
          <SubmitButton pendingText="Adding Version...">Add Version</SubmitButton>
        </form>

        <form action={clonePtcVersionAction} className="panel form">
          {returnField(returnToPtc)}
          <h2>Clone Version</h2>
          <div className="field">
            <label htmlFor="sourceVersionId">Source Version</label>
            <select id="sourceVersionId" name="sourceVersionId" required>
              <option value="">Choose source Version</option>
              {versionContext.versions.map((version) => <option key={version.id} value={version.id}>{version.name}{version.active ? "" : " (Archived)"}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cloneVersionName">New Version</label>
            <input id="cloneVersionName" name="name" placeholder="2025" required />
          </div>
          <div className="field">
            <label htmlFor="cloneVersionDescription">Description</label>
            <input id="cloneVersionDescription" name="description" placeholder="Optional notes" />
          </div>
          <SubmitButton pendingText="Cloning Version...">Clone Version</SubmitButton>
        </form>

        <section className="panel form">
          <h2>Selected Version</h2>
          {selectedVersionId ? (
            <>
              <form action={updatePtcVersionAction} className="form compact-form">
          {returnField(returnToPtc)}
                <input type="hidden" name="id" value={selectedVersionId} />
                <div className="field">
                  <label htmlFor="selectedVersionName">Version</label>
                  <input id="selectedVersionName" name="name" defaultValue={versionContext.selectedVersionName} required />
                </div>
                <div className="field">
                  <label htmlFor="selectedVersionDescription">Description</label>
                  <input id="selectedVersionDescription" name="description" defaultValue={versionContext.versions.find((version) => version.id === selectedVersionId)?.description || ""} />
                </div>
                <div className="actions">
                  <SubmitButton className="button secondary" pendingText="Saving Version...">Save Version</SubmitButton>
                </div>
              </form>
              <div className="actions">
                <ConfirmDeleteForm
                  action={deletePtcVersionAction}
                  fields={[{ name: "id", value: selectedVersionId }]}
                  triggerText="Deactivate Version"
                  pendingText="Deactivating..."
                  title="Deactivate Version"
                  message={`Deactivate "${versionContext.selectedVersionName}"? This also deactivates its application types and documents for future selections, but assigned records keep their history.`}
                />
              </div>
            </>
          ) : (
            <p className="muted">Choose or create an active Version before managing application types and documents.</p>
          )}
        </section>
      </section>

        </>
      ) : null}

      {activeTab === "ptt" ? (
        <>
          <div className="master-data-group-title"><h2>PTT Master Data</h2><p className="muted">Manage PTT versions and transport type choices.</p></div>

      <section className="panel table-wrap">
        <div className="section-heading-row">
          <div>
            <h2>PTT Versions</h2>
            <p className="muted">Manage Permit-to-Transport versions. PTT application records use these versions, but PTT document/type master data is not configured yet.</p>
          </div>
        </div>
        <form action={createPttVersionAction} className="inline-edit-form">
          {returnField(returnToPtt)}
          <input name="name" placeholder="PTT Version name" required />
          <input name="description" placeholder="Optional notes" />
          <SubmitButton pendingText="Adding PTT Version...">Add PTT Version</SubmitButton>
        </form>
        <table>
          <thead><tr><th>Version</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {pttVersionContext.versions.map((version) => (
              <tr key={version.id}>
                <td>
                  <form action={updatePttVersionAction} className="inline-edit-form">
          {returnField(returnToPtt)}
                    <input type="hidden" name="id" value={version.id} />
                    <input name="name" defaultValue={version.name} required />
                    <input name="description" defaultValue={version.description || ""} placeholder="Optional notes" />
                    <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                  </form>
                </td>
                <td>{version.description || <span className="muted">Blank</span>}</td>
                <td>{version.active ? <span className="badge ok">Active</span> : <span className="badge neutral">Archived</span>}</td>
                <td>
                  <div className="actions">
                    {version.active ? (
                      <ConfirmDeleteForm
                        action={deletePttVersionAction}
                        fields={[{ name: "id", value: version.id }]}
                        triggerText="Deactivate"
                        pendingText="Deactivating..."
                        title="Deactivate PTT Version"
                        message={`Deactivate "${version.name}"? Existing PTT records keep their assigned Version.`}
                      />
                    ) : (
                      <>
                        <ConfirmDeleteForm action={restorePttVersionAction} fields={[{ name: "id", value: version.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore PTT Version" message={`Restore "${version.name}" to active PTT Versions?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                        <ConfirmDeleteForm action={hardDeletePttVersionAction} fields={[{ name: "id", value: version.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete PTT Version" message={`Permanently delete "${version.name}"? This is allowed only when no PTT application records use it.`} confirmText="Delete Permanently" />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pttVersionContext.versions.length === 0 ? <tr><td colSpan={4}>No PTT versions configured.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="panel table-wrap">
        <div className="section-heading-row">
          <div>
            <h2>PTT Types of Transport</h2>
            <p className="muted">Manage active and deactivated transport choices by PTT Version.</p>
          </div>
        </div>
        <form action={createPttTransportTypeAction} className="inline-edit-form">
          {returnField(returnToPtt)}
          <select name="versionId" required>
            <option value="">Choose PTT Version</option>
            {pttVersionContext.activeVersions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
          </select>
          <input name="name" placeholder="Type of transport" required />
          <SubmitButton pendingText="Adding transport type...">Add Transport Type</SubmitButton>
        </form>
        <table>
          <thead><tr><th>Version</th><th>Type of Transport</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {pttTransportTypes.map((type) => (
              <tr key={type.id}>
                <td>{type.version.name}{type.version.active ? "" : " (Archived Version)"}</td>
                <td>
                  <form action={updatePttTransportTypeAction} className="inline-edit-form">
          {returnField(returnToPtt)}
                    <input type="hidden" name="id" value={type.id} />
                    <select name="versionId" defaultValue={type.versionId} required>
                      {pttVersionContext.versions.map((version) => <option key={version.id} value={version.id}>{version.name}{version.active ? "" : " (Archived)"}</option>)}
                    </select>
                    <input name="name" defaultValue={type.name} required />
                    <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                  </form>
                </td>
                <td>{type.active ? <span className="badge ok">Active</span> : <span className="badge neutral">Archived</span>}</td>
                <td>
                  <div className="actions">
                    {type.active ? (
                      <ConfirmDeleteForm
                        action={deletePttTransportTypeAction}
                        fields={[{ name: "id", value: type.id }]}
                        triggerText="Delete"
                        pendingText="Deleting..."
                        title="Delete PTT Transport Type"
                        message={`Delete "${type.name}"? This deactivates the transport type for future PTT records.`}
                      />
                    ) : (
                      <>
                        <ConfirmDeleteForm action={restorePttTransportTypeAction} fields={[{ name: "id", value: type.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore PTT Transport Type" message={`Restore "${type.name}" to active transport choices?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                        <ConfirmDeleteForm action={hardDeletePttTransportTypeAction} fields={[{ name: "id", value: type.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete PTT Transport Type" message={`Permanently delete "${type.name}"? This is allowed only when no PTT application records in the same Version use it.`} confirmText="Delete Permanently" />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pttTransportTypes.length === 0 ? <tr><td colSpan={4}>No PTT transport types configured.</td></tr> : null}
          </tbody>
        </table>
      </section>

        </>
      ) : null}

      {activeTab === "ptc" ? (
        <>
          <div className="master-data-group-title"><h2>PTC Application Types and Documents</h2><p className="muted">Manage active PTC choices for the selected Version.</p></div>

      {user.role === Role.SUPERADMIN && selectedVersionId ? <PtcCalculationRulesManager
        versionId={selectedVersionId}
        versionName={versionContext.selectedVersionName}
        applicationTypes={applicationTypes.map((type) => ({ id: type.id, name: type.name }))}
        rules={calculationRules.map((rule) => ({ applicationTypeId: rule.applicationTypeId, config: ruleConfig(rule) }))}
      /> : null}

      <section className="grid cols-2">
        <form action={createApplicationTypeAction} className="panel form">
          {returnField(returnToPtc)}
          <h2>Add Application Type</h2>
          <input type="hidden" name="versionId" value={selectedVersionId || ""} />
          <div className="field">
            <label htmlFor="name">Type of application</label>
            <input id="name" name="name" required disabled={!selectedVersionId} />
          </div>
          <SubmitButton pendingText="Adding type..." disabled={!selectedVersionId}>Add Type</SubmitButton>
        </form>

        <form action={createRequiredDocumentAction} className="panel form">
          {returnField(returnToPtc)}
          <h2>Add Required Document</h2>
          <div className="field">
            <label htmlFor="applicationTypeId">Type of application</label>
            <select id="applicationTypeId" name="applicationTypeId" required disabled={!selectedVersionId || applicationTypes.length === 0}>
              <option value="">Choose type</option>
              {applicationTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="docName">Type of document</label>
            <input id="docName" name="name" required disabled={!selectedVersionId} />
          </div>
          <div className="field">
            <label htmlFor="requirementMode">Requirement</label>
            <RequirementModeSelect disabled={!selectedVersionId} />
          </div>
          <SubmitButton pendingText="Adding document..." disabled={!selectedVersionId}>Add Document</SubmitButton>
        </form>
      </section>

      <section className="panel table-wrap">
        <h2>Types of Application and Documents</h2>
        <p className="muted">Showing active choices for Version: {versionContext.selectedVersionName}</p>
        <table>
          <thead><tr><th>Type of application</th><th>Required Documents</th><th>Actions</th></tr></thead>
          <tbody>
            {applicationTypes.map((type) => (
              <tr key={type.id}>
                <td>
                  <form action={updateApplicationTypeAction} className="inline-edit-form">
          {returnField(returnToPtc)}
                    <input type="hidden" name="id" value={type.id} />
                    <input name="name" defaultValue={type.name} required />
                    <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                  </form>
                </td>
                <td>
                  <div className="stacked-list">
                    {type.documents.map((doc) => (
                      <div key={doc.id} className="inline-row">
                        <form action={updateRequiredDocumentAction} className="inline-edit-form">
          {returnField(returnToPtc)}
                          <input type="hidden" name="id" value={doc.id} />
                          <input name="name" defaultValue={doc.name} required />
                          <RequirementModeSelect defaultValue={doc.requirementMode} />
                          <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                        </form>
                        {requirementBadge(doc.requirementMode)}
                        <ConfirmDeleteForm
                          action={deleteRequiredDocumentAction}
                          fields={[{ name: "id", value: doc.id }]}
                          triggerText="Delete"
                          pendingText="Deleting..."
                          title="Delete Required Document"
                          message={`Delete "${doc.name}"? This deactivates the document for future selections but keeps existing records intact.`}
                        />
                      </div>
                    ))}
                    {type.documents.length === 0 ? <span className="muted">No documents configured.</span> : null}
                  </div>
                </td>
                <td>
                  <ConfirmDeleteForm
                    action={deleteApplicationTypeAction}
                    fields={[{ name: "id", value: type.id }]}
                    triggerText="Delete Type"
                    pendingText="Deleting..."
                    title="Delete Application Type"
                    message={`Delete "${type.name}"? This deactivates the application type for future records and document selection.`}
                  />
                </td>
              </tr>
            ))}
            {applicationTypes.length === 0 ? <tr><td colSpan={3}>No application types configured for this Version.</td></tr> : null}
          </tbody>
        </table>
      </section>

        </>
      ) : null}

      {activeTab === "general" ? (
        <>
          <div className="master-data-group-title"><h2>General</h2><p className="muted">Regional and provincial offices are reused by both PTC and PTT records.</p></div>

      <section className="grid cols-2">
        <form action={createRegionalOfficeAction} className="panel form">
          {returnField(returnToGeneral)}
          <h2>Add Regional Office</h2>
          <div className="field">
            <label htmlFor="regionalOfficeName">Regional Office</label>
            <input id="regionalOfficeName" name="name" required />
          </div>
          <SubmitButton pendingText="Adding regional office...">Add Regional Office</SubmitButton>
        </form>

        <form action={createProvincialOfficeAction} className="panel form">
          {returnField(returnToGeneral)}
          <h2>Add Provincial Office</h2>
          <div className="field">
            <label htmlFor="regionalOfficeId">Regional Office</label>
            <select id="regionalOfficeId" name="regionalOfficeId" required>
              <option value="">Choose regional office</option>
              {officeChoices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="provincialOfficeName">Provincial Office</label>
            <input id="provincialOfficeName" name="name" required />
          </div>
          <SubmitButton pendingText="Adding provincial office...">Add Provincial Office</SubmitButton>
        </form>
      </section>

      <section className="panel table-wrap">
        <h2>Regional and Provincial Offices</h2>
        <table>
          <thead><tr><th>Regional Office</th><th>Provincial Offices</th><th>Actions</th></tr></thead>
          <tbody>
            {officeChoices.map((office) => (
              <tr key={office.id}>
                <td>
                  <form action={updateRegionalOfficeAction} className="inline-edit-form">
          {returnField(returnToGeneral)}
                    <input type="hidden" name="id" value={office.id} />
                    <input name="name" defaultValue={office.name} required />
                    <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                  </form>
                </td>
                <td>
                  <div className="stacked-list">
                    {office.provincialOffices.map((provincial) => (
                      <div key={provincial.id} className="inline-row">
                        <form action={updateProvincialOfficeAction} className="inline-edit-form">
          {returnField(returnToGeneral)}
                          <input type="hidden" name="id" value={provincial.id} />
                          <select name="regionalOfficeId" defaultValue={office.id} required>
                            {officeChoices.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
                          </select>
                          <input name="name" defaultValue={provincial.name} required />
                          <SubmitButton className="button secondary" pendingText="Saving...">Save</SubmitButton>
                        </form>
                        <ConfirmDeleteForm
                          action={deleteProvincialOfficeAction}
                          fields={[{ name: "id", value: provincial.id }]}
                          triggerText="Delete"
                          pendingText="Deleting..."
                          title="Delete Provincial Office"
                          message={`Delete "${provincial.name}"? This deactivates the provincial office for future selections.`}
                        />
                      </div>
                    ))}
                    {office.provincialOffices.length === 0 ? <span className="muted">No provincial offices configured.</span> : null}
                  </div>
                </td>
                <td>
                  <ConfirmDeleteForm
                    action={deleteRegionalOfficeAction}
                    fields={[{ name: "id", value: office.id }]}
                    triggerText="Delete Region"
                    pendingText="Deleting..."
                    title="Delete Regional Office"
                    message={`Delete "${office.name}"? This deactivates the regional office and its provincial offices for future selections.`}
                  />
                </td>
              </tr>
            ))}
            {officeChoices.length === 0 ? <tr><td colSpan={3}>No office choices configured.</td></tr> : null}
          </tbody>
        </table>
      </section>
        </>
      ) : null}

      {activeTab === "deactivated" ? (
        <>
          <div className="master-data-group-title"><h2>Deactivated Data</h2><p className="muted">Restore inactive choices or permanently delete unused inactive master data.</p></div>
          <section className="panel table-wrap">
        <table>
          <thead><tr><th>Category</th><th>Name</th><th>Parent / Belongs To</th><th>Actions</th></tr></thead>
          <tbody>
            {deactivated.versions.map((version) => (
              <tr key={`version-${version.id}`}>
                <td>Version</td>
                <td>{version.name}</td>
                <td>{version.description || "PTC"}</td>
                <td>
                  <div className="actions">
                    <ConfirmDeleteForm action={restorePtcVersionAction} fields={[{ name: "id", value: version.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore Version" message={`Restore "${version.name}" to active Versions?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                    <ConfirmDeleteForm action={hardDeletePtcVersionAction} fields={[{ name: "id", value: version.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete Version" message={`Permanently delete "${version.name}"? This is allowed only when it has no application records or application types.`} confirmText="Delete Permanently" />
                  </div>
                </td>
              </tr>
            ))}
            {deactivated.pttVersions.map((version) => (
              <tr key={`ptt-version-${version.id}`}>
                <td>PTT Version</td>
                <td>{version.name}</td>
                <td>{version.description || "PTT"}</td>
                <td>
                  <div className="actions">
                    <ConfirmDeleteForm action={restorePttVersionAction} fields={fieldsWithReturn([{ name: "id", value: version.id }], returnToDeactivated)} triggerText="Restore" pendingText="Restoring..." title="Restore PTT Version" message={`Restore "${version.name}" to active PTT Versions?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                    <ConfirmDeleteForm action={hardDeletePttVersionAction} fields={fieldsWithReturn([{ name: "id", value: version.id }], returnToDeactivated)} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete PTT Version" message={`Permanently delete "${version.name}"? This is allowed only when no PTT application records use it.`} confirmText="Delete Permanently" />
                  </div>
                </td>
              </tr>
            ))}
            {deactivated.pttTransportTypes.map((type) => (
              <tr key={`ptt-transport-type-${type.id}`}>
                <td>PTT Type of Transport</td>
                <td>{type.name}</td>
                <td>{type.version.name}{type.version.active ? "" : " (PTT Version inactive)"}</td>
                <td>
                  <div className="actions">
                    <ConfirmDeleteForm action={restorePttTransportTypeAction} fields={fieldsWithReturn([{ name: "id", value: type.id }], returnToDeactivated)} triggerText="Restore" pendingText="Restoring..." title="Restore PTT Transport Type" message={`Restore "${type.name}" to active transport choices?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                    <ConfirmDeleteForm action={hardDeletePttTransportTypeAction} fields={fieldsWithReturn([{ name: "id", value: type.id }], returnToDeactivated)} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete PTT Transport Type" message={`Permanently delete "${type.name}"? This is allowed only when no PTT application records in the same Version use it.`} confirmText="Delete Permanently" />
                  </div>
                </td>
              </tr>
            ))}            {deactivated.applicationTypes.map((type) => (
              <tr key={`application-type-${type.id}`}>
                <td>Type of Application</td>
                <td>{type.name}</td>
                <td>{type.version.name}</td>
                <td>
                  <div className="actions">
                    <ConfirmDeleteForm action={restoreApplicationTypeAction} fields={[{ name: "id", value: type.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore Application Type" message={`Restore "${type.name}" to active choices?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                    <ConfirmDeleteForm action={hardDeleteApplicationTypeAction} fields={[{ name: "id", value: type.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete Application Type" message={`Permanently delete "${type.name}"? This is allowed only when it has no application records or document history.`} confirmText="Delete Permanently" />
                  </div>
                </td>
              </tr>
            ))}
            {deactivated.requiredDocuments.map((doc) => (
              <tr key={`required-document-${doc.id}`}>
                <td>Type of Document</td>
                <td>{doc.name}{requirementBadge(doc.requirementMode)}</td>
                <td>{doc.applicationType.name} / {doc.applicationType.version.name}{doc.applicationType.active ? "" : " (application type inactive)"}</td>
                <td>
                  <div className="actions">
                    <ConfirmDeleteForm action={restoreRequiredDocumentAction} fields={[{ name: "id", value: doc.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore Required Document" message={`Restore "${doc.name}" to active document choices?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" />
                    <ConfirmDeleteForm action={hardDeleteRequiredDocumentAction} fields={[{ name: "id", value: doc.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete Required Document" message={`Permanently delete "${doc.name}"? This is allowed only when no application history uses it.`} confirmText="Delete Permanently" />
                  </div>
                </td>
              </tr>
            ))}
            {deactivated.regionalOffices.map((office) => (
              <tr key={`regional-office-${office.id}`}>
                <td>Regional Office</td>
                <td>{office.name}</td>
                <td>PTC</td>
                <td><div className="actions"><ConfirmDeleteForm action={restoreRegionalOfficeAction} fields={[{ name: "id", value: office.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore Regional Office" message={`Restore "${office.name}" to active regional office choices?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" /><ConfirmDeleteForm action={hardDeleteRegionalOfficeAction} fields={[{ name: "id", value: office.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete Regional Office" message={`Permanently delete "${office.name}" and its provincial office choices? Application records keep their saved text values.`} confirmText="Delete Permanently" /></div></td>
              </tr>
            ))}
            {deactivated.provincialOffices.map((office) => (
              <tr key={`provincial-office-${office.id}`}>
                <td>Provincial Office</td>
                <td>{office.name}</td>
                <td>{office.regionalOffice.name}{office.regionalOffice.active ? "" : " (regional office inactive)"}</td>
                <td><div className="actions"><ConfirmDeleteForm action={restoreProvincialOfficeAction} fields={[{ name: "id", value: office.id }]} triggerText="Restore" pendingText="Restoring..." title="Restore Provincial Office" message={`Restore "${office.name}" to active provincial office choices?`} confirmText="Restore" triggerClassName="button secondary" submitClassName="button" /><ConfirmDeleteForm action={hardDeleteProvincialOfficeAction} fields={[{ name: "id", value: office.id }]} triggerText="Delete Permanently" pendingText="Deleting permanently..." title="Permanently Delete Provincial Office" message={`Permanently delete "${office.name}"? Application records keep their saved text values.`} confirmText="Delete Permanently" /></div></td>
              </tr>
            ))}
            {deactivatedCount === 0 ? <tr><td colSpan={4}>No deactivated master data.</td></tr> : null}
          </tbody>
        </table>
      </section>

        </>
      ) : null}

      {activeTab === "imports" ? (
        <>
          <div className="master-data-group-title"><h2>Imports and Exports</h2><p className="muted">Import records and export Excel workbooks by Version, Region, and Provincial Office.</p></div>

      <section className="grid cols-2">
        <ImportCheckerPanel
          group="PTC"
          title="Import PTC Excel File"
          description="Check Permit-to-Cut rows before importing them into the selected Version."
          action={importPtcRecordsAction}
          returnTo={returnToImports}
          versionLabel="Import Version"
          versionOptions={[{ id: "uncategorized", name: "Uncategorized" }, ...versionContext.activeVersions.map((version) => ({ id: version.id, name: version.name }))]}
          defaultVersionId="uncategorized"
          fileInputId="ptcFile"
          fileLabel="PTC Excel file"
          templateHref="/api/import-template?group=PTC"
          importButtonText="Import PTC Excel File"
          importingText="Importing PTC records..."
          instruction={(
            <>
              <p><strong>Template columns:</strong></p>
              <p className="muted">Regional Office, Provincial Office, PTC Number, Date Issued, Name of Applicant, location details, tree counts, Type of Application, and LOC Exemption.</p>
              <p className="muted">Download the template for exact column order. Rows import only after this checker finds no blocking errors; warnings stay visible for review.</p>
            </>
          )}
        />

        <ImportCheckerPanel
          group="PTT"
          title="Import PTT Excel File"
          description="Check Permit-to-Transport rows before importing them into the selected PTT Version."
          action={importPttRecordsAction}
          returnTo={returnToImports}
          versionLabel="Import PTT Version"
          versionOptions={[{ id: "", name: "Choose PTT Version" }, ...pttVersionContext.activeVersions.map((version) => ({ id: version.id, name: version.name }))]}
          defaultVersionId=""
          fileInputId="pttFile"
          fileLabel="PTT Excel file"
          templateHref="/api/import-template?group=PTT"
          importButtonText="Import PTT Excel File"
          importingText="Importing PTT records..."
          instruction={(
            <>
              <p><strong>Template columns:</strong></p>
              <p className="muted">Regional Office, Provincial Office, PTT Number, Date Issued, Name, transport details, fees, validity, issuing details, and Remarks.</p>
              <p className="muted">Dates may be Excel dates or readable date strings. Yes/No and True/False are accepted for Certificate of Quantity/Volume Attached.</p>
            </>
          )}
        />
      </section>
      <section className="grid cols-2">
        <section className="panel form">
          <h2>Export PTC Records</h2>
          <p className="muted">Exports the selected PTC Version. Region and Provincial Office filtering apply to all workbook sheets.</p>
          <VersionFilter path="/admin/master-data" selected={versionContext.selectedVersionParam} options={versionContext.options} preservedParams={{ tab: "imports" }} />
          <ExportExcelButton versionId={versionContext.selectedVersionParam} versionName={versionContext.selectedVersionName} officeChoices={officeChoices} label="Export PTC Excel" />
        </section>

        <section className="panel form">
          <h2>Export PTT Records</h2>
          <p className="muted">Exports PTT application records from the current active PTT Version. Region and Provincial Office filtering apply to all workbook sheets.</p>
          <div className="field">
            <label>PTT Version</label>
            <span className="muted">{pttVersionContext.selectedVersionName}</span>
          </div>
          <ExportExcelButton group="PTT" versionId={pttVersionContext.selectedVersionParam} versionName={pttVersionContext.selectedVersionName} officeChoices={officeChoices} label="Export PTT Excel" />
        </section>
      </section>
        </>
      ) : null}
    </div>
  );
}


