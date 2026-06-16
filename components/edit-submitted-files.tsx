"use client";

import { useMemo, useState } from "react";

type ApplicationTypeOption = {
  id: string;
  name: string;
  documents: { id: string; name: string }[];
};

export function EditSubmittedFiles({
  applicationTypes,
  initialApplicationTypeId,
  initialDocumentIds
}: {
  applicationTypes: ApplicationTypeOption[];
  initialApplicationTypeId: string;
  initialDocumentIds: string[];
}) {
  const [applicationTypeId, setApplicationTypeId] = useState(initialApplicationTypeId);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(initialDocumentIds);

  const currentType = useMemo(
    () => applicationTypes.find((type) => type.id === applicationTypeId),
    [applicationTypes, applicationTypeId]
  );

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
        <label>Type of application</label>
        <select
          name="applicationTypeId"
          value={applicationTypeId}
          required
          onChange={(event) => changeApplicationType(event.target.value)}
        >
          {applicationTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>
        <span className="muted">Changing this resets the submitted files to the checked items below.</span>
      </div>

      <div className="field">
        <label>Submitted Files</label>
        <div className="checklist">
          {!currentType ? <div className="muted">Choose an application type first.</div> : null}
          {currentType?.documents.map((document) => (
            <label key={document.id} className="check">
              <input
                type="checkbox"
                name="documentIds"
                value={document.id}
                checked={selectedDocumentIds.includes(document.id)}
                onChange={() => toggleDocument(document.id)}
              />
              <span>{document.name}</span>
            </label>
          ))}
          {currentType && currentType.documents.length === 0 ? (
            <div className="muted">No required documents are configured for this application type.</div>
          ) : null}
        </div>
        <span className="muted">Saving replaces the submitted files for this record with exactly the checked files.</span>
      </div>
    </>
  );
}

export type { ApplicationTypeOption };