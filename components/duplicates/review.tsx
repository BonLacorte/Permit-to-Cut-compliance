"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { previewDuplicateMergeAction, mergeDuplicateRecordsAction } from "@/app/actions/duplicates";
import { duplicateMergeFields, selectMergedRecord, type MergeRecord, type MergeSelection } from "@/lib/duplicate-merge";
import { type PermitGroup } from "@/lib/duplicate-numbers";
import { formatAuditTimestamp } from "@/lib/ptc";
import { PtcContextRows, type PtcContextRecord } from "@/components/duplicates/ptc-context-rows";

export type ComparisonRecord = MergeRecord & PtcContextRecord & { version?: { name: string; active: boolean } | null; createdBy?: { name: string }; editedBy?: { name: string } | null; outsideRegionAllowedDays?: number[] };
function valueText(value: unknown): string {
  if (value == null || value === "") return "Blank";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
export function DuplicateGroupList({ group, groups }: { group: PermitGroup; groups: Array<{ number: string; count: number; names: string; versions: string }> }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = groups.filter((item) => `${item.number} ${item.names} ${item.versions}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages);
  return <section className="panel grid">
    <label className="field">Search duplicate groups<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
    <p className="muted">{filtered.length} duplicate groups across active, archived, and Uncategorized Versions.</p>
    <div className="table-wrap"><table><thead><tr><th>{group} Number</th><th>Records</th><th>Versions</th><th>Names</th><th>Review</th></tr></thead><tbody>
      {filtered.slice((current - 1) * 20, current * 20).map((item) => <tr key={item.number}><td>{item.number}</td><td>{item.count}</td><td>{item.versions}</td><td>{item.names}</td><td><Link href={`/${group.toLowerCase()}/applications/duplicates?number=${encodeURIComponent(item.number)}`}>Compare records</Link></td></tr>)}
      {!filtered.length && <tr><td colSpan={5}>No matching duplicate groups.</td></tr>}
    </tbody></table></div>
    <div className="actions"><button className="button secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current} of {pages}</span><button className="button secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button></div>
  </section>;
}

type Preview = NonNullable<Awaited<ReturnType<typeof previewDuplicateMergeAction>>["preview"]>;
export function DuplicateComparison({ group, records }: { group: PermitGroup; records: ComparisonRecord[] }) {
  const router = useRouter();
  const [keeperId, setKeeperId] = useState("");
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<MergeSelection["transfers"]>([]);
  const [outsideRegionDays, setOutsideRegionDays] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fields = duplicateMergeFields(group);
  const selection: MergeSelection = { group, keeperId, deleteIds, transfers, outsideRegionDays };
  const keeper = records.find((record) => record.id === keeperId);
  const combined = keeper ? selectMergedRecord(records, selection).merged : null;
  const final = preview?.final || combined;
  function clearPreview() { setPreview(null); setError(""); }
  function changeKeeper(id: string) { setKeeperId(id); setDeleteIds([]); setTransfers([]); setOutsideRegionDays(null); clearPreview(); }
  function toggleDelete(id: string, checked: boolean) { setDeleteIds(checked ? [...deleteIds, id] : deleteIds.filter((item) => item !== id)); if (!checked) setTransfers(transfers.filter((item) => item.sourceId !== id)); clearPreview(); }
  function toggleTransfer(field: string, sourceId: string, checked: boolean) { setTransfers([...transfers.filter((item) => item.field !== field), ...(checked ? [{ field, sourceId }] : [])]); clearPreview(); }
  async function review() {
    setBusy(true); setError("");
    try { const result = await previewDuplicateMergeAction(selection); if (result.error) setError(result.error); else if (result.preview) setPreview(result.preview); }
    catch { setError("Could not load the preview. Your records have not changed."); }
    finally { setBusy(false); }
  }
  async function merge() {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const result = await mergeDuplicateRecordsAction(selection, preview.digest);
      if (result.error) { setError(result.error); setPreview(null); dialog.current?.close(); }
      else { dialog.current?.close(); router.push(`/${group.toLowerCase()}/applications/duplicates?toast=success&message=${encodeURIComponent(`Merged records; retained ${result.keeperId}.` )}`); router.refresh(); }
    } catch { setError("The request could not be completed. Reload before trying again to verify the saved state."); dialog.current?.close(); setPreview(null); }
    finally { setBusy(false); }
  }
  const label = (record: ComparisonRecord) => `${valueText(record[group === "PTC" ? "applicantName" : "transporterName"])} — ${record.version?.name || "Uncategorized"} — ${record.id}`;
  const readonlyRows = [
    { label: "Record ID", read: (record: ComparisonRecord) => record.id },
    { label: `${group} Number`, read: (record: ComparisonRecord) => valueText(record[group === "PTC" ? "ptcNumber" : "pttNumber"]) },
    { label: "Version", read: (record: ComparisonRecord) => record.version ? `${record.version.name}${record.version.active ? "" : " (archived)"}` : "Uncategorized" },
    { label: "Status (read-only)", read: (record: ComparisonRecord) => valueText(record.status) },
    { label: "Created By / At", read: (record: ComparisonRecord) => `${record.createdBy?.name || "Blank"} / ${formatAuditTimestamp(record.createdAt as string)}` },
    { label: "Edited By / At", read: (record: ComparisonRecord) => record.editedBy ? `${record.editedBy.name} / ${formatAuditTimestamp(record.updatedAt as string)}` : "Blank" }
  ];
  return <div className="grid duplicate-review">
    <section className="panel"><h2>Choose what to keep</h2><p>Choose one retained record, then explicitly select duplicates to delete. Copy individual fields from selected deletions; only one donor is allowed per field. Unselected records remain unchanged.</p><p className="muted">Blank transfers clear the field. Manual Remarks are appended once. Version, permit identity, creation metadata, and {group === "PTC" ? "Type and document/progress history stay with the retained record." : "record identity are not transferred."}</p></section>
    {error && <p role="alert" className="warning-text">{error}</p>}
    <div className="table-wrap duplicate-comparison" tabIndex={0} role="region" aria-label="Side-by-side duplicate comparison">
      <table><caption>Duplicate {group} records — all Versions</caption><thead><tr><th scope="col">Field</th>{records.map((record, index) => <th scope="col" key={record.id}><span>Record {index + 1}</span><p>{label(record)}</p><label><input type="radio" name="retainedRecord" aria-label={`Keep record ${index + 1}`} checked={keeperId === record.id} disabled={busy} onChange={() => changeKeeper(record.id)} /> Keep this record</label><br /><label><input type="checkbox" aria-label={`Delete record ${index + 1}`} checked={deleteIds.includes(record.id)} disabled={!keeper || keeperId === record.id || busy} onChange={(event) => toggleDelete(record.id, event.target.checked)} /> Delete this duplicate</label></th>)}<th scope="col" className="merge-result">Final retained result{preview ? " (server checked)" : " (selection only)"}</th></tr></thead><tbody>
        {readonlyRows.map((row) => <Fragment key={row.label}><tr><th scope="row">{row.label}</th>{records.map((record) => <td key={record.id}>{row.read(record)}</td>)}<td className="merge-result">{keeper ? row.label === "Status (read-only)" && preview ? valueText(preview.final.status) : row.read(keeper) : "Choose a retained record"}</td></tr>{group === "PTC" && row.label === "PTC Number" && <PtcContextRows records={records} keeperId={keeperId} />}</Fragment>)}
        {fields.map((field) => {
          const donor = transfers.find((transfer) => transfer.field === field.key);
          return <tr key={field.key}><th scope="row">{field.label}</th>{records.map((record, index) => <td key={record.id}><div className="merge-cell">{valueText(record[field.key])}{record.id !== keeperId && <label><input type="checkbox" aria-label={`Copy ${field.label} from record ${index + 1}`} checked={donor?.sourceId === record.id} disabled={busy || !deleteIds.includes(record.id) || Boolean(donor && donor.sourceId !== record.id)} onChange={(event) => toggleTransfer(field.key, record.id, event.target.checked)} /> Copy{record[field.key] == null || record[field.key] === "" ? " blank (clears field)" : ""}</label>}</div></td>)}<td className="merge-result">{final ? valueText(final[field.key]) : "—"}{donor && <small>From record {records.findIndex((record) => record.id === donor.sourceId) + 1}{field.key === "remarks" ? " (append)" : ""}</small>}</td></tr>;
        })}
        {["actualFee", "actualValidityDays", ...(group === "PTT" ? ["actualTransportCategory"] : [])].map((field) => <tr key={field}><th scope="row">{field} (recalculated)</th>{records.map((record) => <td key={record.id}>{valueText(record[field])}</td>)}<td className="merge-result">{preview ? valueText(preview.final[field]) : "Generate server preview"}</td></tr>)}
      </tbody></table>
    </div>
    <section className="panel grid">
      {group === "PTT" && combined?.validityBasis === "OutsideRegionInterIsland" && <label className="field">Outside Region / Inter-Island days (retained Version)<select value={outsideRegionDays ?? ""} disabled={busy} onChange={(event) => { setOutsideRegionDays(event.target.value ? Number(event.target.value) : null); clearPreview(); }}><option value="">Not selected — validity will not be checked</option>{keeper?.outsideRegionAllowedDays?.map((day) => <option key={day} value={day}>{day} days</option>)}</select></label>}
      <p>{deleteIds.length} selected for deletion; {transfers.length} field transfers. All checks run automatically during a merge, even if individual checker tools are not assigned.</p>
      <div className="actions"><button className="button secondary" disabled={busy || !keeper || !deleteIds.length} onClick={review}>{busy ? "Working..." : "Generate final preview"}</button>{preview && <button className="button danger" disabled={busy} onClick={() => dialog.current?.showModal()}>Review and merge</button>}</div>
      {preview && <div aria-live="polite"><h3>Checker results</h3>{preview.checks.map((check) => <p key={check.type} className={check.state !== "matched" ? "warning-text" : ""}>{check.type}: {check.state} — {check.message}</p>)}<h3>Final Remarks</h3><div className="readonly-summary">{valueText(preview.final.remarks)}</div></div>}
    </section>
    <dialog ref={dialog} className="modal merge-dialog" aria-labelledby="merge-confirm-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <h2 id="merge-confirm-title">Confirm duplicate merge and deletion</h2>
      <p>Keep: {keeper && label(keeper)}</p><p>Delete permanently:</p><ul>{records.filter((record) => deleteIds.includes(record.id)).map((record) => <li key={record.id}>{label(record)}</li>)}</ul>
      <h3>Transferred fields and resulting values</h3>{!transfers.length && <p>No field transfers. The retained form values remain unchanged.</p>}<ul>{transfers.map((transfer) => <li key={transfer.field}>{fields.find((field) => field.key === transfer.field)?.label} from {label(records.find((record) => record.id === transfer.sourceId)!)} → {valueText(preview?.final[transfer.field])}</li>)}</ul>
      <p>Other values remain as shown in the comparison. Calculated results: fee {valueText(preview?.final.actualFee)}, validity {valueText(preview?.final.actualValidityDays)}{group === "PTT" ? `, transport ${valueText(preview?.final.actualTransportCategory)}` : ""}.</p>
      {group === "PTC" && <p className="warning-text">Deleted records’ Type and document/progress history are NOT transferred. The retained record keeps its own Type and document/progress history.</p>}
      <h3>Unavailable checks</h3>{preview?.checks.some((check) => check.state === "not-checked") ? preview.checks.filter((check) => check.state === "not-checked").map((check) => <p key={check.type} className="warning-text">{check.message}</p>) : <p>None.</p>}
      <p>Audit snapshots are saved before deletion. There is no restore screen.</p>
      <div className="actions"><button className="button secondary" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className="button danger" disabled={busy} onClick={merge}>{busy ? "Merging..." : "Confirm merge and delete"}</button></div>
    </dialog>
  </div>;
}
