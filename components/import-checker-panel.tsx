"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ImportGroup, ImportPreviewResult } from "@/lib/import-checker";

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

  const canImport = Boolean(preview && preview.errorCount === 0 && preview.rowsChecked > 0);

  return (
    <form action={action} ref={formRef} className="panel form import-checker-panel">
      <input type="hidden" name="returnTo" value={returnTo} />
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
        <select id={`${fileInputId}-version`} name="versionId" defaultValue={defaultVersionId} onChange={() => setPreview(null)}>
          {versionOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={fileInputId}>{fileLabel}</label>
        <input id={fileInputId} name="file" type="file" accept=".xlsx,.xls" required onChange={() => setPreview(null)} />
      </div>
      <div className="actions">
        <button className="button secondary" type="button" onClick={checkFile} disabled={checking} aria-busy={checking}>
          {checking ? <span className="spinner" aria-hidden="true" /> : null}
          {checking ? "Checking file..." : "Check File"}
        </button>
        <SubmitButton pendingText={importingText} disabled={!canImport}>{importButtonText}</SubmitButton>
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
          {preview.errorCount > 0 ? <p className="form-error">Fix the Excel errors, then check the file again before importing.</p> : null}
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
    </form>
  );
}
