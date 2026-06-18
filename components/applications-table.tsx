"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { bulkDeleteApplicationRecordsAction, deleteAllApplicationRecordsAction, deleteApplicationRecordAction, updateApplicationRecordAction } from "@/app/actions";
import { BulletList } from "@/components/bullet-list";
import { EditSubmittedFiles, type ApplicationTypeOption } from "@/components/edit-submitted-files";
import { PtcRecordFields } from "@/components/ptc-record-fields";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";

type Row = {
  id: string;
  applicantName: string;
  applicationTypeId: string | null;
  applicationTypeName: string;
  submittedCount: number;
  requiredCount: number;
  missingCount: number;
  status: "Complete" | "Incomplete";
  selectedDocuments: string[];
  selectedDocumentIds: string[];
  remarks: string;
  createdByName: string;
  dateIssued: string;
  ptcNumber: string;
  regionalOffice: string;
  provincialOffice: string;
  municipality: string;
  barangay: string;
  regionalOfficeDisplay: string;
  provincialOfficeDisplay: string;
  municipalityDisplay: string;
  barangayDisplay: string;
  treesApplied: number | null;
  treesApproved: number | null;
  seedlingsReplacement: number | null;
  treesAppliedDisplay: string;
  treesApprovedDisplay: string;
  seedlingsReplacementDisplay: string;
  ptcNumberDuplicate: boolean;
};

type SortKey = "applicantName" | "applicationTypeName" | "submittedCount" | "missingCount" | "status" | "createdByName" | "remarks" | "dateIssued" | "ptcNumber" | "regionalOffice" | "provincialOffice" | "municipality" | "barangay";

function compareRows(a: Row, b: Row, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left || "").localeCompare(String(right || ""));
}

function displayName(name: string) {
  return name.trim() || "Blank Application";
}

function displayText(value: string) {
  return value || <span className="muted">Blank</span>;
}

function previewLabel(row: Row) {
  const name = displayName(row.applicantName);
  return row.ptcNumber ? `${row.ptcNumber} - ${name}` : name;
}

export function ApplicationsTable({
  rows,
  applicationTypes,
  canBulkDelete = false
}: {
  rows: Row[];
  applicationTypes: ApplicationTypeOption[];
  canBulkDelete?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "applicantName", direction: "asc" });
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmation, setDeleteAllConfirmation] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const base = !text
      ? rows
      : rows.filter((row) =>
          [
            row.applicantName,
            row.applicationTypeName,
            row.status,
            row.createdByName,
            row.remarks,
            row.dateIssued,
            row.ptcNumber,
            row.regionalOfficeDisplay,
            row.provincialOfficeDisplay,
            row.municipalityDisplay,
            row.barangayDisplay,
            ...row.selectedDocuments
          ]
            .join(" ")
            .toLowerCase()
            .includes(text)
        );
    return [...base].sort((a, b) => {
      const result = compareRows(a, b, sort.key);
      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selectedIds.has(row.id));
  const someVisibleSelected = visible.some((row) => selectedIds.has(row.id));
  const tableColSpan = canBulkDelete ? 19 : 18;

  function sortBy(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  function sortLabel(key: SortKey) {
    if (sort.key !== key) return "";
    return sort.direction === "asc" ? " asc" : " desc";
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of visible) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  return (
    <>
      <div className="table-toolbar">
        <label className="table-search">
          <span>Filter</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search applications" />
        </label>
        <label className="page-size">
          <span>Rows</span>
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>

      {canBulkDelete ? (
        <div className="bulk-action-bar">
          <span>{selectedRows.length} selected</span>
          <div className="actions compact-actions">
            <button className="button secondary" type="button" disabled={selectedRows.length === 0} onClick={() => setSelectedIds(new Set())}>Clear Selection</button>
            {selectedRows.length > 0 ? <button className="button danger" type="button" onClick={() => setBulkDeleting(true)}>Delete Selected</button> : null}
          </div>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {canBulkDelete ? (
                <th className="selection-cell">
                  <input
                    aria-label="Select visible applications"
                    checked={allVisibleSelected}
                    data-partial={someVisibleSelected && !allVisibleSelected ? "true" : undefined}
                    disabled={visible.length === 0}
                    type="checkbox"
                    onChange={(event) => toggleVisible(event.target.checked)}
                  />
                </th>
              ) : null}
              <th><button className="th-button" onClick={() => sortBy("dateIssued")}>Date Issued{sortLabel("dateIssued")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("ptcNumber")}>PTC Number{sortLabel("ptcNumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("applicantName")}>Name{sortLabel("applicantName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("applicationTypeName")}>Type of application{sortLabel("applicationTypeName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("regionalOffice")}>Regional Office{sortLabel("regionalOffice")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("provincialOffice")}>Provincial Office{sortLabel("provincialOffice")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("municipality")}>Municipality{sortLabel("municipality")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("barangay")}>Barangay{sortLabel("barangay")}</button></th>
              <th>Trees Applied</th>
              <th>Trees Approved</th>
              <th>Seedlings Replacement</th>
              <th>Submitted Documents</th>
              <th><button className="th-button" onClick={() => sortBy("submittedCount")}>Submitted{sortLabel("submittedCount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("missingCount")}>Missing{sortLabel("missingCount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("status")}>Status{sortLabel("status")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("remarks")}>Remarks{sortLabel("remarks")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("createdByName")}>Added By{sortLabel("createdByName")}</button></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {canBulkDelete ? (
                  <td className="selection-cell">
                    <input
                      aria-label={`Select ${previewLabel(row)}`}
                      checked={selectedIds.has(row.id)}
                      type="checkbox"
                      onChange={(event) => toggleRow(row.id, event.target.checked)}
                    />
                  </td>
                ) : null}
                <td>{displayText(row.dateIssued)}</td>
                <td>
                  <div className="cell-stack">
                    <span>{displayText(row.ptcNumber)}</span>
                    {row.ptcNumberDuplicate ? <span className="badge danger-badge">Duplicate</span> : null}
                  </div>
                </td>
                <td><Link href={`/applications/${row.id}`}>{displayName(row.applicantName)}</Link></td>
                <td>{row.applicationTypeName}</td>
                <td>{displayText(row.regionalOfficeDisplay)}</td>
                <td>{displayText(row.provincialOfficeDisplay)}</td>
                <td>{displayText(row.municipalityDisplay)}</td>
                <td>{displayText(row.barangayDisplay)}</td>
                <td>{row.treesAppliedDisplay}</td>
                <td>{row.treesApprovedDisplay}</td>
                <td>{row.seedlingsReplacementDisplay}</td>
                <td><BulletList items={row.selectedDocuments} empty="No documents selected" /></td>
                <td>{row.submittedCount} / {row.requiredCount}</td>
                <td>{row.missingCount}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.remarks || <span className="muted">No remarks</span>}</td>
                <td>{row.createdByName}</td>
                <td>
                  <div className="actions compact-actions">
                    <Link className="button secondary" href={`/applications/${row.id}`}>View</Link>
                    <button className="button secondary" type="button" onClick={() => setEditing(row)}>Edit</button>
                    <button className="button danger" type="button" onClick={() => setDeleting(row)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? <tr><td colSpan={tableColSpan}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span className="muted">Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}</span>
        <div className="actions compact-actions">
          <button className="button secondary" type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>Page {safePage} of {totalPages}</span>
          <button className="button secondary" type="button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
        </div>
      </div>

      {canBulkDelete ? (
        <section className="danger-zone-panel" aria-label="Application danger zone">
          <div>
            <h3>Danger Zone</h3>
            <p className="muted">Advanced destructive actions are hidden here to prevent accidental clicks.</p>
          </div>
          {!showDangerZone ? (
            <button className="button secondary" type="button" onClick={() => setShowDangerZone(true)}>Show delete all options</button>
          ) : (
            <div className="danger-zone-actions">
              <p>Delete every PTC application record, including saved progress and submitted documents.</p>
              <button className="button danger" type="button" disabled={rows.length === 0} onClick={() => { setDeleteAllConfirmation(""); setDeleteAllOpen(true); }}>
                Delete All PTC Applications
              </button>
            </div>
          )}
        </section>
      ) : null}

      {editing ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal wide-modal">
            <h2>Edit Application</h2>
            <form action={updateApplicationRecordAction} className="form" onSubmit={() => setEditing(null)}>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="returnTo" value="/applications" />
              <div className="field">
                <label>Name of Applicant</label>
                <input name="applicantName" defaultValue={editing.applicantName} />
              </div>
              <PtcRecordFields defaults={editing} />
              <EditSubmittedFiles
                key={editing.id}
                applicationTypes={applicationTypes}
                initialApplicationTypeId={editing.applicationTypeId}
                initialDocumentIds={editing.selectedDocumentIds}
              />
              <div className="field">
                <label>Remarks</label>
                <textarea name="remarks" defaultValue={editing.remarks} rows={4} />
              </div>
              <div className="actions">
                <SubmitButton pendingText="Saving changes...">Save Changes</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Delete Application</h2>
            <p>Delete <strong>{displayName(deleting.applicantName)}</strong>? This removes the record and all saved progress.</p>
            <form action={deleteApplicationRecordAction} className="actions" onSubmit={() => setDeleting(null)}>
              <input type="hidden" name="id" value={deleting.id} />
              <SubmitButton className="button danger" pendingText="Deleting...">Delete</SubmitButton>
              <button className="button secondary" type="button" onClick={() => setDeleting(null)}>Cancel</button>
            </form>
          </div>
        </div>
      ) : null}

      {bulkDeleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Delete Selected Applications</h2>
            <p>Delete <strong>{selectedRows.length}</strong> selected application{selectedRows.length === 1 ? "" : "s"}? This removes the records, saved progress, and submitted documents.</p>
            <ul className="compact-list bulk-preview-list">
              {selectedRows.slice(0, 8).map((row) => <li key={row.id}>{previewLabel(row)}</li>)}
            </ul>
            {selectedRows.length > 8 ? <p className="muted">And {selectedRows.length - 8} more.</p> : null}
            <form action={bulkDeleteApplicationRecordsAction} className="actions" onSubmit={() => setBulkDeleting(false)}>
              {selectedRows.map((row) => <input key={row.id} type="hidden" name="applicationRecordIds" value={row.id} />)}
              <SubmitButton className="button danger" disabled={selectedRows.length === 0} pendingText="Deleting selected...">Delete Selected</SubmitButton>
              <button className="button secondary" type="button" onClick={() => setBulkDeleting(false)}>Cancel</button>
            </form>
          </div>
        </div>
      ) : null}

      {deleteAllOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Delete All PTC Applications</h2>
            <p className="warning-text">This permanently deletes all {rows.length} PTC application records, including saved progress and submitted documents.</p>
            <p>Type <strong>DELETE ALL PTC</strong> to enable this action.</p>
            <form action={deleteAllApplicationRecordsAction} className="form" onSubmit={() => setDeleteAllOpen(false)}>
              <div className="field">
                <label htmlFor="deleteAllConfirmation">Confirmation phrase</label>
                <input
                  id="deleteAllConfirmation"
                  name="confirmation"
                  autoComplete="off"
                  value={deleteAllConfirmation}
                  onChange={(event) => setDeleteAllConfirmation(event.target.value)}
                />
              </div>
              <div className="actions">
                <SubmitButton className="button danger" disabled={deleteAllConfirmation !== "DELETE ALL PTC" || rows.length === 0} pendingText="Deleting all...">Delete All PTC Applications</SubmitButton>
                <button className="button secondary" type="button" onClick={() => setDeleteAllOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}




