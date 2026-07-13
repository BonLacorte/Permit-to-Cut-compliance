"use client";

import { useMemo, useState } from "react";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";
import type { VersionOption } from "@/components/document-picker";

type ApplicationTypeOption = {
  id: string;
  versionId: string;
  name: string;
  documents: { id: string; name: string; optional?: boolean }[];
};

export function EditSubmittedFiles({
  applicationTypes,
  versionOptions,
  initialVersionId,
  initialApplicationTypeId,
  initialDocumentIds
}: {
  applicationTypes: ApplicationTypeOption[];
  versionOptions: VersionOption[];
  initialVersionId?: string | null;
  initialApplicationTypeId?: string | null;
  initialDocumentIds: string[];
}) {
  const [versionId, setVersionId] = useState(initialVersionId || UNCATEGORIZED_VERSION);
  const [applicationTypeId, setApplicationTypeId] = useState(initialApplicationTypeId || "");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(initialDocumentIds);
  const isUncategorized = versionId === UNCATEGORIZED_VERSION;

  const versionedApplicationTypes = useMemo(
    () => applicationTypes.filter((type) => type.versionId === versionId),
    [applicationTypes, versionId]
  );
  const currentType = useMemo(
    () => versionedApplicationTypes.find((type) => type.id === applicationTypeId),
    [versionedApplicationTypes, applicationTypeId]
  );

  function changeVersion(nextVersionId: string) {
    setVersionId(nextVersionId);
    setApplicationTypeId("");
    setSelectedDocumentIds([]);
  }

  function changeApplicationType(nextApplicationTypeId: string) {
    setApplicationTypeId(nextApplicationTypeId);
    setSelectedDocumentIds([]);
  }

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  }

  return (
    <>
      <div className="field">
        <label>Version</label>
        <select name="versionId" value={versionId} onChange={(event) => changeVersion(event.target.value)}>
          {versionOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
        </select>
        <span className="muted">Changing Version resets incompatible Type of Application and submitted files.</span>
      </div>

      <div className="field">
        <label>Type of application</label>
        <select
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
        <span className="muted">Changing this resets the submitted files to the checked items below.</span>
      </div>

      <div className="field submitted-files-field">
        <div className="field-heading-row">
          <label>Submitted Files</label>
          <span className="selected-count">{selectedDocumentIds.length} selected</span>
        </div>
        <div className="submitted-files-box">
          {isUncategorized ? <div className="empty-state">Assign a Version before selecting application type and submitted files.</div> : null}
          {!isUncategorized && !currentType ? <div className="empty-state">Choose an application type later to select submitted files.</div> : null}
          {currentType?.documents.map((document) => {
            const checked = selectedDocumentIds.includes(document.id);
            return (
              <label key={document.id} className={`submitted-file-option ${checked ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  name="documentIds"
                  value={document.id}
                  checked={checked}
                  onChange={() => toggleDocument(document.id)}
                />
                <span>{document.name}{document.optional ? <span className="badge neutral"> Optional</span> : null}</span>
              </label>
            );
          })}
          {currentType && currentType.documents.length === 0 ? (
            <div className="empty-state">No required documents are configured for this application type.</div>
          ) : null}
        </div>
        <span className="muted">Saving replaces the submitted files for this record with exactly the checked files.</span>
      </div>
    </>
  );
}

export type { ApplicationTypeOption };