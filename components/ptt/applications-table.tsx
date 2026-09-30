"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bulkAssignPttApplicationVersionAction, bulkDeletePttApplicationRecordsAction, deletePttApplicationRecordAction, updatePttApplicationRecordAction } from "@/app/actions";
import { PttRecordFields, type PttTransportTypeOption, type PttValidityRuleOption } from "@/components/ptt/record-fields";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import type { VersionOption } from "@/components/ptc/document-picker";
import type { OfficeChoice } from "@/lib/ptc";
import { mergeRemarks } from "@/lib/ptc-checks";
import { pttValidityBasisLabel } from "@/lib/ptt-checks";
import type { PttStatus } from "@/lib/ptt";

type Row = {
  id: string;
  versionId: string | null;
  versionName: string;
  pttNumber: string;
  pttNumberDuplicate: boolean;
  dateIssued: string;
  transporterName: string;
  regionalOffice: string;
  provincialOffice: string;
  transporterAddress: string;
  ptcNumber: string;
  pcaRegistrationCertificateNumber: string;
  pcaRegistrationCertificateDate: string;
  businessAddress: string;
  boardFeetGranted: string;
  boardFeetGrantedAmount: number;
  certificateOfQuantityVolumeAttached: boolean | null;
  certificateOfQuantityVolumeAttachedDisplay: string;
  volumeBoardFeet: string;
  volumeBoardFeetAmount: number;
  originOfLumber: string;
  destination: string;
  consigneeName: string;
  consigneePcaRegistration: string;
  transportType: string;
  actualTransportCategory: string;
  actualTransportDisplay: string;
  vehiclePlateNumber: string;
  authorizedDriverName: string;
  authorizedDriverContact: string;
  amountPaid: string;
  amountPaidAmount: number;
  actualFee: string;
  actualFeeAmount: number;
  officialReceiptNumber: string;
  recordedValidityDays: number | null;
  actualValidityDays: number | null;
  validityBasis: string;
  validityBasisDisplay: string;
  recordedValidityDisplay: string;
  actualValidityDisplay: string;
  dateValidatedInspected: string;
  validatedInspectedBy: string;
  validatedInspectedBySignatureStatus?: string | null;
  validatedInspectedBySignatureForName?: string | null;
  issuedByDate: string;
  issuedBy: string;
  issuedBySignatureStatus?: string | null;
  issuedBySignatureForName?: string | null;
  manualRemarks: string;
  remarks: string;
  createdByName: string;
  createdAt: string;
  editedByName: string;
  editedAt: string;
  status: PttStatus;
};

type SortKey = "versionName" | "pttNumber" | "dateIssued" | "transporterName" | "regionalOffice" | "provincialOffice" | "ptcNumber" | "volumeBoardFeetAmount" | "originOfLumber" | "destination" | "transportType" | "actualTransportDisplay" | "amountPaidAmount" | "actualFeeAmount" | "officialReceiptNumber" | "validityBasisDisplay" | "recordedValidityDays" | "actualValidityDays" | "status" | "remarks" | "createdByName" | "createdAt" | "editedByName" | "editedAt";

function compareRows(a: Row, b: Row, key: SortKey) {
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left || "").localeCompare(String(right || ""));
}

function displayName(name: string) {
  return name.trim() || "Blank PTT Application";
}

function displayText(value: string) {
  return value || <span className="muted">Blank</span>;
}

function previewLabel(row: Row) {
  const name = displayName(row.transporterName);
  return row.pttNumber ? `${row.pttNumber} - ${name}` : name;
}

export function PttApplicationsTable({
  checkerAccess,
  rows,
  officeChoices,
  transportTypes,
  validityRules,
  versionOptions,
  selectedVersionParam,
  returnTo,
  canBulkDelete = false
}: {
  checkerAccess: { fees: boolean; validity: boolean; vehicle: boolean };
  rows: Row[];
  officeChoices: OfficeChoice[];
  transportTypes: PttTransportTypeOption[];
  validityRules: PttValidityRuleOption[];
  versionOptions: VersionOption[];
  selectedVersionParam: string;
  returnTo: string;
  canBulkDelete?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "dateIssued", direction: "desc" });
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkVersionId, setBulkVersionId] = useState(selectedVersionParam);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [findings, setFindings] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [manualRemarks, setManualRemarks] = useState("");
  const mergedRemarks = useMemo(() => mergeRemarks(manualRemarks, findings), [findings, manualRemarks]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const base = !text
      ? rows
      : rows.filter((row) =>
          [
            row.versionName,
            row.pttNumber,
            row.dateIssued,
            row.transporterName,
            row.regionalOffice,
            row.provincialOffice,
            row.transporterAddress,
            row.ptcNumber,
            row.pcaRegistrationCertificateNumber,
            row.volumeBoardFeet,
            row.originOfLumber,
            row.destination,
            row.transportType,
            row.actualTransportDisplay,
            row.amountPaid,
            row.actualFee,
            row.officialReceiptNumber,
            row.validityBasisDisplay,
            row.recordedValidityDisplay,
            row.actualValidityDisplay,
            row.status,
            row.remarks,
            row.createdByName,
            row.createdAt,
            row.editedByName,
            row.editedAt
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
  const tableColSpan = canBulkDelete ? 25 : 24;
  const activeAssignmentOptions = versionOptions.filter((version) => version.id === "uncategorized" || version.active !== false);

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

  function openEdit(row: Row) {
    setEditing(row);
    setManualRemarks(row.manualRemarks);
    setFindings([]);
    setReviewOpen(false);
    setConfirmed(false);
  }

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    if (confirmed) {
      setConfirmed(false);
      setEditing(null);
      return;
    }
    if (findings.length > 0) {
      event.preventDefault();
      setReviewOpen(true);
      return;
    }
    setEditing(null);
  };

  const confirmSave = () => {
    setConfirmed(true);
    setReviewOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  return (
    <>
      <div className="table-toolbar">
        <label className="table-search">
          <span>Filter</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search PTT applications" />
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
                  <input aria-label="Select visible PTT applications" checked={allVisibleSelected} data-partial={someVisibleSelected && !allVisibleSelected ? "true" : undefined} disabled={visible.length === 0} type="checkbox" onChange={(event) => toggleVisible(event.target.checked)} />
                </th>
              ) : null}
              <th><button className="th-button" onClick={() => sortBy("dateIssued")}>Date Issued{sortLabel("dateIssued")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("pttNumber")}>PTT Number{sortLabel("pttNumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("transporterName")}>Name{sortLabel("transporterName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("regionalOffice")}>Regional Office{sortLabel("regionalOffice")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("provincialOffice")}>Provincial Office{sortLabel("provincialOffice")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("ptcNumber")}>PTC Number{sortLabel("ptcNumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("volumeBoardFeetAmount")}>Volume{sortLabel("volumeBoardFeetAmount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("originOfLumber")}>Origin{sortLabel("originOfLumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("destination")}>Destination{sortLabel("destination")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("transportType")}>Recorded Type{sortLabel("transportType")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("actualTransportDisplay")}>Actual Type{sortLabel("actualTransportDisplay")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("amountPaidAmount")}>Recorded Fee{sortLabel("amountPaidAmount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("actualFeeAmount")}>Actual Fee{sortLabel("actualFeeAmount")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("officialReceiptNumber")}>OR Number{sortLabel("officialReceiptNumber")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("validityBasisDisplay")}>Validity Basis{sortLabel("validityBasisDisplay")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("recordedValidityDays")}>Recorded Validity{sortLabel("recordedValidityDays")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("actualValidityDays")}>Actual Validity{sortLabel("actualValidityDays")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("status")}>Status{sortLabel("status")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("remarks")}>Remarks{sortLabel("remarks")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("createdByName")}>Created By{sortLabel("createdByName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("createdAt")}>Created At{sortLabel("createdAt")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("editedByName")}>Edited By{sortLabel("editedByName")}</button></th>
              <th><button className="th-button" onClick={() => sortBy("editedAt")}>Edited At{sortLabel("editedAt")}</button></th>
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
                <td><div className="cell-stack"><span>{displayText(row.pttNumber)}</span>{row.pttNumberDuplicate ? <span className="badge danger-badge">Duplicate</span> : null}</div></td>
                <td><Link href={`/ptt/applications/${row.id}`}>{displayName(row.transporterName)}</Link></td>
                <td>{displayText(row.regionalOffice)}</td>
                <td>{displayText(row.provincialOffice)}</td>
                <td>{displayText(row.ptcNumber)}</td>
                <td>{displayText(row.volumeBoardFeet)}</td>
                <td>{displayText(row.originOfLumber)}</td>
                <td>{displayText(row.destination)}</td>
                <td>{displayText(row.transportType)}</td>
                <td>{displayText(row.actualTransportDisplay)}</td>
                <td>{displayText(row.amountPaid)}</td>
                <td>{displayText(row.actualFee)}</td>
                <td>{displayText(row.officialReceiptNumber)}</td>
                <td>{displayText(row.validityBasisDisplay)}</td>
                <td>{displayText(row.recordedValidityDisplay)}</td>
                <td>{displayText(row.actualValidityDisplay)}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.remarks || <span className="muted">No remarks</span>}</td>
                <td>{row.createdByName || <span className="muted">Blank</span>}</td>
                <td>{displayText(row.createdAt)}</td>
                <td>{row.editedByName || <span className="muted">Blank</span>}</td>
                <td>{displayText(row.editedAt)}</td>
                <td><div className="actions compact-actions"><Link className="button secondary" href={`/ptt/applications/${row.id}`}>View</Link><button className="button secondary" type="button" onClick={() => openEdit(row)}>Edit</button><button className="button danger" type="button" onClick={() => setDeleting(row)}>Delete</button></div></td>
              </tr>
            ))}
            {visible.length === 0 ? <tr><td colSpan={tableColSpan}>No PTT records found.</td></tr> : null}
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
          <div className="modal wide-modal">
            <h2>Edit PTT Application</h2>
            <form ref={formRef} action={updatePttApplicationRecordAction} className="form" onSubmit={submitEdit}>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="field"><label>Name</label><input name="transporterName" defaultValue={editing.transporterName} /></div>
              <PttRecordFields defaults={editing} officeChoices={officeChoices} transportTypes={transportTypes} validityRules={validityRules} versionOptions={versionOptions} checkerAccess={checkerAccess} onGeneratedFindingsChange={setFindings} />
              <div className="field"><label>Remarks</label><textarea name="remarks" value={manualRemarks} onChange={(event) => setManualRemarks(event.target.value)} rows={4} /></div>
              <div className="actions"><SubmitButton pendingText="Saving changes...">Save Changes</SubmitButton><button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {reviewOpen ? <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal"><h2>Review Generated Findings</h2><p className="muted">These PTT system findings will be shown together with the manual remarks after saving.</p><div className="field"><label>Generated findings</label><div className="readonly-summary">{findings.map((finding) => <p key={finding}>{finding}</p>)}</div></div><div className="field"><label>Final merged remarks</label><textarea readOnly value={mergedRemarks} rows={6} /></div><div className="actions"><button className="button" type="button" onClick={confirmSave}>Confirm and Save</button><button className="button secondary" type="button" onClick={() => setReviewOpen(false)}>Back to Form</button></div></div></div> : null}

      {deleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal"><h2>Delete PTT Application</h2><p>Delete <strong>{previewLabel(deleting)}</strong>? This removes the PTT application record.</p><form action={deletePttApplicationRecordAction} className="actions" onSubmit={() => setDeleting(null)}><input type="hidden" name="id" value={deleting.id} /><SubmitButton className="button danger" pendingText="Deleting...">Delete</SubmitButton><button className="button secondary" type="button" onClick={() => setDeleting(null)}>Cancel</button></form></div></div>
      ) : null}

      {bulkAssigning ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal compact-modal">
            <h2>Assign PTT Version</h2>
            <p>Assign <strong>{selectedRows.length}</strong> selected PTT application{selectedRows.length === 1 ? "" : "s"} to a Version.</p>
            <form action={bulkAssignPttApplicationVersionAction} className="form" onSubmit={() => setBulkAssigning(false)}>
              <div className="field"><label>Version</label><select name="versionId" value={bulkVersionId} onChange={(event) => setBulkVersionId(event.target.value)}>{activeAssignmentOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}</select></div>
              <input type="hidden" name="returnTo" value={returnTo} />
              {selectedRows.map((row) => <input key={row.id} type="hidden" name="pttApplicationRecordIds" value={row.id} />)}
              <div className="actions"><SubmitButton disabled={selectedRows.length === 0} pendingText="Assigning Version...">Assign Version</SubmitButton><button className="button secondary" type="button" onClick={() => setBulkAssigning(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {bulkDeleting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal compact-modal"><h2>Delete Selected PTT Applications</h2><p>Delete <strong>{selectedRows.length}</strong> selected PTT application{selectedRows.length === 1 ? "" : "s"}? This removes the PTT application records.</p><ul className="compact-list bulk-preview-list">{selectedRows.slice(0, 8).map((row) => <li key={row.id}>{previewLabel(row)}</li>)}</ul>{selectedRows.length > 8 ? <p className="muted">And {selectedRows.length - 8} more.</p> : null}<form action={bulkDeletePttApplicationRecordsAction} className="actions" onSubmit={() => setBulkDeleting(false)}><input type="hidden" name="returnTo" value={returnTo} />{selectedRows.map((row) => <input key={row.id} type="hidden" name="pttApplicationRecordIds" value={row.id} />)}<SubmitButton className="button danger" disabled={selectedRows.length === 0} pendingText="Deleting selected...">Delete Selected</SubmitButton><button className="button secondary" type="button" onClick={() => setBulkDeleting(false)}>Cancel</button></form></div></div>
      ) : null}
    </>
  );
}
