"use client";

import { useMemo, useState } from "react";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

export type VersionOption = {
  id: string;
  name: string;
  active?: boolean;
};

type ApplicationType = {
  id: string;
  versionId: string;
  name: string;
  documents: { id: string; name: string; requirementMode?: "Required" | "Optional" | "LocConditional" }[];
};

function requirementBadge(mode?: "Required" | "Optional" | "LocConditional") {
  if (mode === "Optional") return <span className="badge neutral"> Optional</span>;
  if (mode === "LocConditional") return <span className="badge neutral"> LOC Conditional</span>;
  return null;
}
export function DocumentPicker({
  applicationTypes,
  versionOptions,
  initialVersionId,
  selectedApplicationTypeId,
  existingDocumentIds = []
}: {
  applicationTypes: ApplicationType[];
  versionOptions: VersionOption[];
  initialVersionId?: string | null;
  selectedApplicationTypeId?: string | null;
  existingDocumentIds?: string[];
}) {
  const initialVersionValue = initialVersionId || UNCATEGORIZED_VERSION;
  const [versionId, setVersionId] = useState(initialVersionValue);
  const [applicationTypeId, setApplicationTypeId] = useState(selectedApplicationTypeId || "");
  const [selected, setSelected] = useState<string[]>([]);
  const existing = useMemo(() => new Set(existingDocumentIds), [existingDocumentIds]);
  const versionedApplicationTypes = applicationTypes.filter((type) => type.versionId === versionId);
  const current = versionedApplicationTypes.find((type) => type.id === applicationTypeId);
  const isUncategorized = versionId === UNCATEGORIZED_VERSION;

  function changeVersion(nextVersionId: string) {
    setVersionId(nextVersionId);
    setApplicationTypeId("");
    setSelected([]);
  }

  function changeApplicationType(nextApplicationTypeId: string) {
    setApplicationTypeId(nextApplicationTypeId);
    setSelected([]);
  }

  function toggle(id: string) {
    setSelected((currentSelected) =>
      currentSelected.includes(id)
        ? currentSelected.filter((item) => item !== id)
        : [...currentSelected, id]
    );
  }

  return (
    <>
      <div className="field">
        <label htmlFor="versionId">Version</label>
        <select id="versionId" name="versionId" value={versionId} onChange={(event) => changeVersion(event.target.value)}>
          {versionOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
        </select>
        <span className="muted">Changing Version resets the Type of Application and submitted documents if they do not belong to that Version.</span>
      </div>

      {!selectedApplicationTypeId ? (
        <div className="field">
          <label htmlFor="applicationTypeId">Type of application</label>
          <select
            id="applicationTypeId"
            name="applicationTypeId"
            value={applicationTypeId}
            disabled={isUncategorized}
            onChange={(event) => changeApplicationType(event.target.value)}
          >
            <option value="">No type yet</option>
            {versionedApplicationTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="applicationTypeId" value={selectedApplicationTypeId} />
      )}

      <div className="field submitted-files-field">
        <div className="field-heading-row">
          <label>Type of Document</label>
          <span className="selected-count">{selected.length} selected</span>
        </div>
        <div className="submitted-files-box">
          {isUncategorized ? <div className="empty-state">Assign a Version before selecting application type and documents.</div> : null}
          {!isUncategorized && !current ? <div className="empty-state">Choose an application type later to select required documents.</div> : null}
          {current?.documents.map((document) => {
            const alreadyAttached = existing.has(document.id);
            const checked = selected.includes(document.id);
            return (
              <label key={document.id} className={`submitted-file-option ${checked ? "selected" : ""} ${alreadyAttached ? "disabled" : ""}`}>
                <input
                  type="checkbox"
                  name="documentIds"
                  value={document.id}
                  disabled={alreadyAttached}
                  checked={checked}
                  onChange={() => toggle(document.id)}
                />
                <span>
                  {document.name}
                  {requirementBadge(document.requirementMode)}
                  {alreadyAttached ? <span className="muted"> Already selected</span> : null}
                </span>
              </label>
            );
          })}
          {current && current.documents.length === 0 ? (
            <div className="empty-state">No required documents are configured for this application type.</div>
          ) : null}
        </div>
        <span className="muted">Changing the application type resets the selected documents.</span>
      </div>
    </>
  );
}
