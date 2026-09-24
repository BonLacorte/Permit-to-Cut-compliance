"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ImportGroup, ImportPreviewResult } from "@/lib/import-checker";
import { canImportPreview } from "@/lib/import-policy";

type VersionOption = {
  id: string;
  name: string;
};

type ImportCheckerPanelProps = {
  group: ImportGroup;
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  versionLabel: string;
  versionOptions: VersionOption[];
  defaultVersionId: string;
  fileInputId: string;
  fileLabel: string;
  instruction: React.ReactNode;
  templateHref?: string;
  templateLabel?: string;
  importButtonText: string;
  importingText: string;
};

function severityClass(severity: string) {
  return severity === "Error" ? "danger-badge" : "warn";
}

export function ImportCheckerPanel({
  group,
  title,
  description,
  action,
  returnTo,
  versionLabel,
  versionOptions,
  defaultVersionId,
  fileInputId,
  fileLabel,
  instruction,
  templateHref,
  templateLabel = "Download Template",
  importButtonText,
  importingText
}: ImportCheckerPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [forceImportOpen, setForceImportOpen] = useState(false);
  const [forceImport, setForceImport] = useState(false);

  async function checkFile() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("group", group);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setPreview(null);
      setCheckError(`Choose a ${group} Excel file before checking.`);
      return;
    }

    setChecking(true);
    setCheckError("");
    setPreview(null);
    setForceImport(false);
    try {
      const response = await fetch("/api/import-preview", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const result = await response.json();
      if (!response.ok) {
        setCheckError(result?.error || "Could not check the file.");
        return;
      }
      setPreview(result);
    } catch {
      setCheckError("Could not check the file. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function resetPreview() {
    setPreview(null);
    setForceImport(false);
    setForceImportOpen(false);
  }

  function confirmForceImport() {
    setForceImport(true);
    setForceImportOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  const canImport = Boolean(preview && canImportPreview(preview));
  const canForceImport = Boolean(preview && preview.errorCount > 0 && canImportPreview(preview, { forceImport: true }));

  return (
    <form action={action} ref={formRef} className="panel form import-checker-panel">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="forceImport" value={forceImport ? "true" : "false"} />
      <div className="section-heading-row">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {templateHref ? <a className="button secondary" href={templateHref}>{templateLabel}</a> : null}
      </div>
      <div className="instruction-box">{instruction}</div>
      <div className="field">
        <label htmlFor={`${fileInputId}-version`}>{versionLabel}</label>
        <select id={`${fileInputId}-version`} name="versionId" defaultValue={defaultVersionId} onChange={resetPreview}>
          {versionOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={fileInputId}>{fileLabel}</label>
        <input id={fileInputId} name="file" type="file" accept=".xlsx,.xls" required onChange={resetPreview} />
      </div>
      <div className="actions">
        <button className="button secondary" type="button" onClick={checkFile} disabled={checking} aria-busy={checking}>
          {checking ? <span className="spinner" aria-hidden="true" /> : null}
          {checking ? "Checking file..." : "Check File"}
        </button>
        <SubmitButton pendingText={importingText} disabled={!canImport}>{importButtonText}</SubmitButton>
        {canForceImport ? <button className="button danger" type="button" onClick={() => setForceImportOpen(true)}>Import Anyway</button> : null}
      </div>
      {checkError ? <p className="form-error">{checkError}</p> : null}
      {preview ? (
        <div className="import-preview">
          <div className="import-preview-summary">
            <div><span>Rows checked</span><strong>{preview.rowsChecked}</strong></div>
            <div><span>Ready</span><strong>{preview.readyRows}</strong></div>
            <div><span>Warnings</span><strong>{preview.warningCount}</strong></div>
            <div><span>Errors</span><strong>{preview.errorCount}</strong></div>
          </div>
          {preview.errorCount > 0 ? <p className="form-error">Fix the Excel errors before a normal import, or choose Import Anyway to import every nonblank row after confirmation.</p> : null}
          {preview.errorCount === 0 && preview.warningCount > 0 ? <p className="muted">Warnings will not block import, but please review them before continuing.</p> : null}
          {preview.errorCount === 0 && preview.warningCount === 0 ? <p className="muted">No issues found. The file is ready to import.</p> : null}
          {preview.issues.length > 0 ? (
            <div className="table-wrap import-issues">
              <table>
                <thead>
                  <tr><th>Row</th><th>Field</th><th>Severity</th><th>Message</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {preview.issues.slice(0, 80).map((item, index) => (
                    <tr key={`${item.row}-${item.field}-${index}`}>
                      <td>{item.row}</td>
                      <td>{item.field}</td>
                      <td><span className={`badge ${severityClass(item.severity)}`}>{item.severity}</span></td>
                      <td>{item.message}</td>
                      <td>{item.value || "Blank"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.issues.length > 80 ? <p className="muted">Showing the first 80 issues. Fix these first, then check again.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {forceImportOpen && preview ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`${fileInputId}-force-import-title`}>
          <div className="modal compact-modal">
            <h2 id={`${fileInputId}-force-import-title`}>Import {group} Despite Errors</h2>
            <p>This file has <strong>{preview.rowsChecked}</strong> checked row{preview.rowsChecked === 1 ? "" : "s"}, <strong>{preview.errorCount}</strong> error{preview.errorCount === 1 ? "" : "s"}, and <strong>{preview.warningCount}</strong> warning{preview.warningCount === 1 ? "" : "s"}.</p>
            <p className="warning-text">Every nonblank row will be imported. The importer reads values by the template column positions, so header errors can place data in the wrong fields. Invalid dates, numbers, booleans, and supported-choice values will be saved as blank.</p>
            <div className="actions">
              <button className="button danger" type="button" onClick={confirmForceImport}>Import Anyway</button>
              <button className="button secondary" type="button" onClick={() => setForceImportOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
