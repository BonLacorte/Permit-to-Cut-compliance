"use client";

import { useMemo, useState } from "react";

type ApplicationType = {
  id: string;
  name: string;
  documents: { id: string; name: string }[];
};

export function DocumentPicker({
  applicationTypes,
  selectedApplicationTypeId,
  existingDocumentIds = []
}: {
  applicationTypes: ApplicationType[];
  selectedApplicationTypeId?: string | null;
  existingDocumentIds?: string[];
}) {
  const [applicationTypeId, setApplicationTypeId] = useState(selectedApplicationTypeId || "");
  const [selected, setSelected] = useState<string[]>([]);
  const existing = useMemo(() => new Set(existingDocumentIds), [existingDocumentIds]);
  const current = applicationTypes.find((type) => type.id === applicationTypeId);

  function toggle(id: string) {
    setSelected((currentSelected) =>
      currentSelected.includes(id)
        ? currentSelected.filter((item) => item !== id)
        : [...currentSelected, id]
    );
  }

  return (
    <>
      {!selectedApplicationTypeId ? (
        <div className="field">
          <label htmlFor="applicationTypeId">Type of application</label>
          <select
            id="applicationTypeId"
            name="applicationTypeId"
            value={applicationTypeId}
            onChange={(event) => {
              setApplicationTypeId(event.target.value);
              setSelected([]);
            }}
          >
            <option value="">No type yet</option>
            {applicationTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="applicationTypeId" value={selectedApplicationTypeId} />
      )}

      <div className="field">
        <label>Type of document</label>
        <div className="checklist">
          {!current ? <div className="muted">Choose an application type later to select required documents.</div> : null}
          {current?.documents.map((document) => {
            const alreadyAttached = existing.has(document.id);
            return (
              <label key={document.id} className={`check ${alreadyAttached ? "disabled" : ""}`}>
                <input
                  type="checkbox"
                  name="documentIds"
                  value={document.id}
                  disabled={alreadyAttached}
                  checked={selected.includes(document.id)}
                  onChange={() => toggle(document.id)}
                />
                <span>
                  {document.name}
                  {alreadyAttached ? <span className="muted"> Already selected</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}