"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteApplicationRecordAction, updateApplicationRecordAction } from "@/app/actions";
import { BulletList } from "@/components/bullet-list";
import { EditSubmittedFiles, type ApplicationTypeOption } from "@/components/edit-submitted-files";
import { StatusBadge } from "@/components/status-badge";

type Row = {
  id: string;
  applicantName: string;
  applicationTypeId: string;
  applicationTypeName: string;
  submittedCount: number;
  requiredCount: number;
  missingCount: number;
  status: "Complete" | "Incomplete";
  selectedDocuments: string[];
  selectedDocumentIds: string[];
  remarks: string;
  createdByName: string;
};

type SortKey = "applicantName" | "applicationTypeName" | "submittedCount" | "missingCount" | "status" | "createdByName" | "remarks";

function compareRows(a: Row, b: Row, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left || "").localeCompare(String(right || ""));
}

export function ApplicationsTable({ rows, applicationTypes }: { rows: Row[]; applicationTypes: ApplicationTypeOption[] }) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "applicantName", direction: "asc" });
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const base = !text
      ? rows
      : rows.filter((row) =>
          [row.applicantName, row.applicationTypeName, row.status, row.createdByName, row.remarks, ...row.selectedDocuments]
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button className="th-button" onClick={() => sortBy("applicantName")}>Name{sortLabel("applicantName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("applicationTypeName")}>Type of application{sortLabel("applicationTypeName")}</button></th>
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
                <td><Link href={`/applications/${row.id}`}>{row.applicantName}</Link></td>
                <td>{row.applicationTypeName}</td>
                <td><BulletList items={row.selectedDocuments} empty="No documents selected" /></td>
                <td>{row.submittedCount} / {row.requiredCount}</td>
                <td>{row.missingCount}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.remarks || <span className="muted">No remarks</span>}</td>
                <td>{row.createdByName}</td>
                <td>
                  <div className="actions compact-actions">
                    <button className="button secondary" type="button" onClick={() => setEditing(row)}>Edit</button>
                    <button className="button danger" type="button" onClick={() => setDeleting(row)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? <tr><td colSpan={9}>No records found.</td></tr> : null}
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

      {editing ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Edit Application</h2>
            <form action={updateApplicationRecordAction} className="form" onSubmit={() => setEditing(null)}>
              <input type="hidden" name="id" value={editing.id} />
              <div className="field">
                <label>Name</label>
                <input name="applicantName" defaultValue={editing.applicantName} required />
              </div>
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
                <button className="button" type="submit">Save Changes</button>
                <button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Delete Application</h2>
            <p>Delete <strong>{deleting.applicantName}</strong>? This removes the record and all saved progress.</p>
            <form action={deleteApplicationRecordAction} className="actions" onSubmit={() => setDeleting(null)}>
              <input type="hidden" name="id" value={deleting.id} />
              <button className="button danger" type="submit">Delete</button>
              <button className="button secondary" type="button" onClick={() => setDeleting(null)}>Cancel</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}