import {
  clonePtcVersionAction,
  createApplicationTypeAction,
  createProvincialOfficeAction,
  createPtcVersionAction,
  createRegionalOfficeAction,
  createRequiredDocumentAction,
  deleteApplicationTypeAction,
  deleteProvincialOfficeAction,
  deletePtcVersionAction,
  deleteRegionalOfficeAction,
  deleteRequiredDocumentAction,
  hardDeleteApplicationTypeAction,
  hardDeleteProvincialOfficeAction,
  hardDeletePtcVersionAction,
  hardDeleteRegionalOfficeAction,
  hardDeleteRequiredDocumentAction,
  importPtcRecordsAction,
  restoreApplicationTypeAction,
  restoreProvincialOfficeAction,
  restorePtcVersionAction,
  restoreRegionalOfficeAction,
  restoreRequiredDocumentAction,
  updateApplicationTypeAction,
  updateProvincialOfficeAction,
  updatePtcVersionAction,
  updateRegionalOfficeAction,
  updateRequiredDocumentAction
} from "@/app/actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { ExportExcelButton } from "@/components/export-excel-button";
import { SubmitButton } from "@/components/submit-button";
import { VersionFilter } from "@/components/version-filter";
import { requireAdmin } from "@/lib/auth";
import { getApplicationTypesWithDocuments, getDeactivatedMasterData, getOfficeChoices, getVersionContext } from "@/lib/data";

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
export default async function MasterDataPage({ searchParams }: { searchParams?: { version?: string } }) {
  await requireAdmin();
  const versionContext = await getVersionContext(searchParams?.version);
  const selectedVersionId = versionContext.selectedVersionId;
  const [applicationTypes, officeChoices, deactivated] = await Promise.all([
    getApplicationTypesWithDocuments({ versionId: selectedVersionId }),
    getOfficeChoices(),
    getDeactivatedMasterData()
  ]);
  const deactivatedCount =
    deactivated.versions.length +
    deactivated.applicationTypes.length +
    deactivated.requiredDocuments.length +
    deactivated.regionalOffices.length +
    deactivated.provincialOffices.length;

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Master Data</h1>
          <p className="muted">Manage PTC versions, application types, required documents, offices, imports, and report exports.</p>
        </div>
        <div className="actions">
          <VersionFilter path="/admin/master-data" selected={versionContext.selectedVersionParam} options={versionContext.options} />
          <ExportExcelButton versionId={versionContext.selectedVersionParam} />
        </div>
      </div>

      <section className="grid cols-2">
        <form action={createPtcVersionAction} className="panel form">
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

      <section className="grid cols-2">
        <form action={createApplicationTypeAction} className="panel form">
          <h2>Add Application Type</h2>
          <input type="hidden" name="versionId" value={selectedVersionId || ""} />
          <div className="field">
            <label htmlFor="name">Type of application</label>
            <input id="name" name="name" required disabled={!selectedVersionId} />
          </div>
          <SubmitButton pendingText="Adding type..." disabled={!selectedVersionId}>Add Type</SubmitButton>
        </form>

        <form action={createRequiredDocumentAction} className="panel form">
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

      <section className="grid cols-2">
        <form action={createRegionalOfficeAction} className="panel form">
          <h2>Add Regional Office</h2>
          <div className="field">
            <label htmlFor="regionalOfficeName">Regional Office</label>
            <input id="regionalOfficeName" name="name" required />
          </div>
          <SubmitButton pendingText="Adding regional office...">Add Regional Office</SubmitButton>
        </form>

        <form action={createProvincialOfficeAction} className="panel form">
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

      <section className="panel table-wrap">
        <h2>Deactivated Data</h2>
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
            {deactivated.applicationTypes.map((type) => (
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

      <section className="grid cols-2">
        <form action={importPtcRecordsAction} className="panel form">
          <h2>Import PTC Excel File</h2>
          <div className="instruction-box">
            <p><strong>Expected first-sheet column order:</strong></p>
            <ol>
              <li>Regional Office</li><li>Provincial Office</li><li>PTC Number</li><li>Date Issued</li><li>Name of Applicant</li><li>Barangay</li><li>Municipality</li><li>No. of trees applied</li><li>No. of trees approved</li><li>No. of Seedlings Replacement</li><li>Type of Application (optional)</li><li>LOC Exemption (optional: Owner or Others)</li>
            </ol>
            <p className="muted">Rows import into the selected Version. If optional Type of Application and LOC Exemption columns are present, the type is matched only inside that Version and LOC Exemption accepts Owner or Others.</p>
          </div>
          <div className="field">
            <label htmlFor="importVersionId">Import Version</label>
            <select id="importVersionId" name="versionId" defaultValue="uncategorized">
              <option value="uncategorized">Uncategorized</option>
              {versionContext.activeVersions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ptcFile">PTC Excel file</label>
            <input id="ptcFile" name="file" type="file" accept=".xlsx,.xls" required />
          </div>
          <SubmitButton pendingText="Importing PTC records...">Import PTC Excel File</SubmitButton>
        </form>

        <div className="panel form disabled-panel">
          <h2>Import PTT Excel File</h2>
          <p className="muted">Coming soon. The PTT import workflow will be implemented in a future batch after the PTT record rules are finalized.</p>
        </div>
      </section>
    </div>
  );
}


