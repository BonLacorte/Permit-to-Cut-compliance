"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { bulkAssignApplicationVersionAction, bulkDeleteApplicationRecordsAction, deleteAllApplicationRecordsAction, deleteApplicationRecordAction } from "@/app/actions";
import { BulletList } from "@/components/bullet-list";
import { EditApplicationButton } from "@/components/edit-application-button";
import type { ApplicationTypeOption } from "@/components/edit-submitted-files";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import type { VersionOption } from "@/components/document-picker";
import type { OfficeChoice } from "@/lib/ptc";
import type { AuditStatus } from "@/lib/reporting";

type Row = {
  id: string;
  versionId: string | null;
  versionName: string;
  needsVersionReview: boolean;
  versionReviewMessages: string[];
  applicantName: string;
  applicationTypeId: string | null;
  applicationTypeName: string;
  submittedCount: number;
  requiredCount: number;
  missingCount: number;
  status: AuditStatus;
  selectedDocuments: string[];
  selectedDocumentIds: string[];
  remarks: string;
  manualRemarks: string;
  editedByName: string;
  dateIssued: string;
  dateIssuedValue?: string | null;
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
  recordedValidityDays: number | null;
  actualValidityDays: number | null;
  recordedValidityDisplay: string;
  actualValidityDisplay: string;
  actualFee: string;
  recordedFee: string;
  actualFeeAmount: number;
  recordedFeeAmount: number;
  feeDifferenceAmount: number;
  actualFeeDisplay: string;
  recordedFeeDisplay: string;
  feeDifferenceDisplay: string;
  replantedSeedlings: boolean | null;
  locExemption: "Owner" | "Others" | null;
  locExemptionDisplay: string;
  feesMatchDisplay: string;
  replantedSeedlingsDisplay: string;
  officialReceiptNumber: string;
  agriculturist: string;
  recommendingApproval: string;
  approved: string;
  ptcNumberDuplicate: boolean;
};

type SortKey = "versionName" | "applicantName" | "applicationTypeName" | "submittedCount" | "missingCount" | "status" | "editedByName" | "remarks" | "dateIssued" | "ptcNumber" | "regionalOffice" | "provincialOffice" | "municipality" | "barangay" | "treesApplied" | "treesApproved" | "seedlingsReplacement" | "recordedValidityDays" | "actualValidityDays" | "actualFeeAmount" | "recordedFeeAmount" | "officialReceiptNumber" | "feeDifferenceAmount" | "locExemptionDisplay" | "agriculturist" | "recommendingApproval" | "approved";

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

function displayNumber(value: number | null) {
  return value === null ? <span className="muted">Blank</span> : value;
}

function previewLabel(row: Row) {
  const name = displayName(row.applicantName);
  return row.ptcNumber ? `${row.ptcNumber} - ${name}` : name;
}

export function ApplicationsTable({
  rows,
  applicationTypes,
  officeChoices,
  versionOptions,
  selectedVersionParam,
  allVersionRecordCount,
  canBulkDelete = false,
  checkerAccess
}: {
  rows: Row[];
  applicationTypes: ApplicationTypeOption[];
  officeChoices: OfficeChoice[];
  versionOptions: VersionOption[];
  selectedVersionParam: string;
  allVersionRecordCount: number;
  canBulkDelete?: boolean;
  checkerAccess: { fees: boolean; validity: boolean };
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "applicantName", direction: "asc" });
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkVersionId, setBulkVersionId] = useState(selectedVersionParam);
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
            row.versionName,
            ...row.versionReviewMessages,
            row.applicantName,
            row.applicationTypeName,
            row.status,
            row.editedByName,
            row.remarks,
            row.dateIssued,
            row.ptcNumber,
            row.regionalOfficeDisplay,
            row.provincialOfficeDisplay,
            row.municipalityDisplay,
            row.barangayDisplay,
            String(row.treesApplied ?? ""),
            String(row.treesApproved ?? ""),
            String(row.seedlingsReplacement ?? ""),
            row.officialReceiptNumber,
            row.agriculturist,
            row.recordedValidityDisplay,
            row.actualValidityDisplay,
            row.feesMatchDisplay,
            row.replantedSeedlingsDisplay,
            row.locExemptionDisplay,
            row.feeDifferenceDisplay,
            row.recommendingApproval,
            row.approved,
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
  const tableColSpan = canBulkDelete ? 32 : 31;
  const activeAssignmentOptions = versionOptions.filter((version) => version.id === "uncategorized" || version.active !== false);
  const bulkPreview = useMemo(() => {
    const targetIsUncategorized = bulkVersionId === "uncategorized";
    let compatibleCount = 0;
    let resetCount = 0;
    let uncategorizedCount = 0;

    for (const row of selectedRows) {
      if (targetIsUncategorized) {
        uncategorizedCount += 1;
        if (row.versionId || row.applicationTypeId || row.selectedDocumentIds.length > 0) resetCount += 1;
        else compatibleCount += 1;
        continue;
      }

      const type = applicationTypes.find((item) => item.id === row.applicationTypeId && item.versionId === bulkVersionId);
      if (!type) {
        resetCount += 1;
        continue;
      }
      const allowedDocumentIds = new Set(type.documents.map((document) => document.id));
      const hasInvalidDocuments = row.selectedDocumentIds.some((documentId) => !allowedDocumentIds.has(documentId));
      if (hasInvalidDocuments) resetCount += 1;
      else compatibleCount += 1;
    }

    return { selectedCount: selectedRows.length, compatibleCount, resetCount, uncategorizedCount };
  }, [applicationTypes, bulkVersionId, selectedRows]);

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
            {selectedRows.length > 0 ? <button className="button secondary" type="button" onClick={() => { setBulkVersionId(selectedVersionParam); setBulkAssigning(true); }}>Assign Version</button> : null}
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
                  <input aria-label="Select visible applications" checked={allVisibleSelected} data-partial={someVisibleSelected && !allVisibleSelected ? "true" : undefined} disabled={visible.length === 0} type="checkbox" onChange={(event) => toggleVisible(event.target.checked)} />
                </th>
              ) : null}
              <th><button className="th-button" onClick={() => sortBy("dateIssued")}>Date Issued{sortLabel("dateIssued")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("recordedValidityDays")}>Recorded Validity{sortLabel("recordedValidityDays")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("actualValidityDays")}>Actual Validity{sortLabel("actualValidityDays")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("ptcNumber")}>PTC Number{sortLabel("ptcNumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("applicantName")}>Name{sortLabel("applicantName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("versionName")}>Version{sortLabel("versionName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("regionalOffice")}>Regional Office{sortLabel("regionalOffice")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("provincialOffice")}>Provincial Office{sortLabel("provincialOffice")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("municipality")}>Municipality{sortLabel("municipality")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("barangay")}>Barangay{sortLabel("barangay")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("treesApplied")}>Trees Applied{sortLabel("treesApplied")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("treesApproved")}>Trees Approved{sortLabel("treesApproved")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("seedlingsReplacement")}>Seedlings Replacement{sortLabel("seedlingsReplacement")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("applicationTypeName")}>Type of application{sortLabel("applicationTypeName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("locExemptionDisplay")}>LOC Exemption{sortLabel("locExemptionDisplay")}</button></th>
              <th>Submitted Documents</th>
              <th><button className="th-button" onClick={() => sortBy("submittedCount")}>Submitted{sortLabel("submittedCount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("missingCount")}>Missing{sortLabel("missingCount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("actualFeeAmount")}>Actual Fee{sortLabel("actualFeeAmount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("recordedFeeAmount")}>Recorded Fee{sortLabel("recordedFeeAmount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("officialReceiptNumber")}>Official Receipt No.{sortLabel("officialReceiptNumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("feeDifferenceAmount")}>Fee Difference{sortLabel("feeDifferenceAmount")}</button></th>
              <th>Fees Match</th>
              <th>Replanted Seedlings</th>
              <th><button className="th-button" onClick={() => sortBy("agriculturist")}>Agriculturist{sortLabel("agriculturist")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("recommendingApproval")}>Recommending Approval{sortLabel("recommendingApproval")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("approved")}>Approved{sortLabel("approved")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("status")}>Status{sortLabel("status")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("remarks")}>Remarks{sortLabel("remarks")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("editedByName")}>Edited By{sortLabel("editedByName")}</button></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {canBulkDelete ? (
                  <td className="selection-cell"><input aria-label={`Select ${previewLabel(row)}`} checked={selectedIds.has(row.id)} type="checkbox" onChange={(event) => toggleRow(row.id, event.target.checked)} /></td>
                ) : null}
                <td>{displayText(row.dateIssued)}</td>
                <td>{displayText(row.recordedValidityDisplay)}</td>
                <td>{displayText(row.actualValidityDisplay)}</td>
                <td><div className="cell-stack"><span>{displayText(row.ptcNumber)}</span>{row.ptcNumberDuplicate ? <span className="badge danger-badge">Duplicate</span> : null}</div></td>
                <td><Link href={`/applications/${row.id}`}>{displayName(row.applicantName)}</Link></td>
                <td><div className="cell-stack"><span>{row.versionName}</span>{row.needsVersionReview ? <span className="badge warning-badge">Needs Version Review</span> : null}</div></td>
                <td>{displayText(row.regionalOfficeDisplay)}</td>
                <td>{displayText(row.provincialOfficeDisplay)}</td>
                <td>{displayText(row.municipalityDisplay)}</td>
                <td>{displayText(row.barangayDisplay)}</td>
                <td>{displayNumber(row.treesApplied)}</td>
                <td>{displayNumber(row.treesApproved)}</td>
                <td>{displayNumber(row.seedlingsReplacement)}</td>
                <td>{row.applicationTypeName}</td>
                <td>{displayText(row.locExemptionDisplay)}</td>
                <td><BulletList items={row.selectedDocuments} empty="No documents selected" /></td>
                <td>{row.submittedCount} / {row.requiredCount}</td>
                <td>{row.missingCount}</td>
                <td>{row.actualFeeDisplay}</td>
                <td>{row.recordedFeeDisplay}</td>
                <td>{displayText(row.officialReceiptNumber)}</td>
                <td>{row.feeDifferenceDisplay}</td>
                <td>{row.feesMatchDisplay}</td>
                <td>{row.replantedSeedlingsDisplay || <span className="muted">Blank</span>}</td>
                <td>{displayText(row.agriculturist)}</td>
                <td>{displayText(row.recommendingApproval)}</td>
                <td>{displayText(row.approved)}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.remarks || <span className="muted">No remarks</span>}</td>
                <td>{row.editedByName || <span className="muted">Blank</span>}</td>
                <td><div className="actions compact-actions"><Link className="button secondary" href={`/applications/${row.id}`}>View</Link><EditApplicationButton record={{ ...row, remarks: row.manualRemarks, dateIssued: row.dateIssuedValue || "", returnTo: `/applications?version=${selectedVersionParam}` }} applicationTypes={applicationTypes} officeChoices={officeChoices} versionOptions={versionOptions} checkerAccess={checkerAccess} /><button className="button danger" type="button" onClick={() => setDeleting(row)}>Delete</button></div></td>
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
          <div><h3>Danger Zone</h3><p className="muted">Advanced destructive actions are hidden here to prevent accidental clicks.</p></div>
          {!showDangerZone ? <button className="button secondary" type="button" onClick={() => setShowDangerZone(true)}>Show delete all options</button> : <div className="danger-zone-actions"><p>Delete every PTC application record across all Versions, including saved progress and submitted documents.</p><button className="button danger" type="button" disabled={allVersionRecordCount === 0} onClick={() => { setDeleteAllConfirmation(""); setDeleteAllOpen(true); }}>Delete All PTC Applications</button></div>}
        </section>
      ) : null}

      {deleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal"><h2>Delete Application</h2><p>Delete <strong>{displayName(deleting.applicantName)}</strong>? This removes the record and all saved progress.</p><form action={deleteApplicationRecordAction} className="actions" onSubmit={() => setDeleting(null)}><input type="hidden" name="id" value={deleting.id} /><SubmitButton className="button danger" pendingText="Deleting...">Delete</SubmitButton><button className="button secondary" type="button" onClick={() => setDeleting(null)}>Cancel</button></form></div></div>
      ) : null}

      {bulkAssigning ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Assign Version</h2>
            <p>Assign <strong>{selectedRows.length}</strong> selected application{selectedRows.length === 1 ? "" : "s"} to a Version.</p>
            <form action={bulkAssignApplicationVersionAction} className="form" onSubmit={() => setBulkAssigning(false)}>
              <div className="instruction-box">
                <p><strong>Bulk assignment preview</strong></p>
                <p>Selected records: {bulkPreview.selectedCount}</p>
                <p>Already compatible: {bulkPreview.compatibleCount}</p>
                <p>Will reset Type/Documents: {bulkPreview.resetCount}</p>
                <p>Will become Uncategorized: {bulkPreview.uncategorizedCount}</p>
              </div>
              {bulkPreview.resetCount > 0 ? (
                <label className="checkbox-row warning-text">
                  <input name="confirmReset" type="checkbox" required />
                  <span>I understand incompatible Type/Documents will be reset and those records will need review.</span>
                </label>
              ) : null}
              <div className="field"><label>Version</label><select name="versionId" value={bulkVersionId} onChange={(event) => setBulkVersionId(event.target.value)}>{activeAssignmentOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}</select></div>
              {selectedRows.map((row) => <input key={row.id} type="hidden" name="applicationRecordIds" value={row.id} />)}
              <div className="actions"><SubmitButton disabled={selectedRows.length === 0} pendingText="Assigning Version...">Assign Version</SubmitButton><button className="button secondary" type="button" onClick={() => setBulkAssigning(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {bulkDeleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal"><h2>Delete Selected Applications</h2><p>Delete <strong>{selectedRows.length}</strong> selected application{selectedRows.length === 1 ? "" : "s"}? This removes the records, saved progress, and submitted documents.</p><ul className="compact-list bulk-preview-list">{selectedRows.slice(0, 8).map((row) => <li key={row.id}>{previewLabel(row)}</li>)}</ul>{selectedRows.length > 8 ? <p className="muted">And {selectedRows.length - 8} more.</p> : null}<form action={bulkDeleteApplicationRecordsAction} className="actions" onSubmit={() => setBulkDeleting(false)}>{selectedRows.map((row) => <input key={row.id} type="hidden" name="applicationRecordIds" value={row.id} />)}<SubmitButton className="button danger" disabled={selectedRows.length === 0} pendingText="Deleting selected...">Delete Selected</SubmitButton><button className="button secondary" type="button" onClick={() => setBulkDeleting(false)}>Cancel</button></form></div></div>
      ) : null}

      {deleteAllOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal"><h2>Delete All PTC Applications</h2><p className="warning-text">This permanently deletes all {allVersionRecordCount} PTC application records across all Versions, including saved progress and submitted documents. This is not limited to the selected Version.</p><p>Type <strong>DELETE ALL PTC</strong> to enable this action.</p><form action={deleteAllApplicationRecordsAction} className="form" onSubmit={() => setDeleteAllOpen(false)}><div className="field"><label htmlFor="deleteAllConfirmation">Confirmation phrase</label><input id="deleteAllConfirmation" name="confirmation" autoComplete="off" value={deleteAllConfirmation} onChange={(event) => setDeleteAllConfirmation(event.target.value)} /></div><div className="actions"><SubmitButton className="button danger" disabled={deleteAllConfirmation !== "DELETE ALL PTC" || allVersionRecordCount === 0} pendingText="Deleting all...">Delete All PTC Applications</SubmitButton><button className="button secondary" type="button" onClick={() => setDeleteAllOpen(false)}>Cancel</button></div></form></div></div>
      ) : null}
    </>
  );
}




