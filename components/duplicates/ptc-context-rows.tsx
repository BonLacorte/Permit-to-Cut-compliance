import React from "react";

export type PtcContextRecord = {
  id: string;
  applicationType?: { name?: string | null } | null;
  progressDocuments?: Array<{ requiredDocument?: { name?: string | null } | null }> | null;
};

function typeName(record: PtcContextRecord) {
  return record.applicationType?.name?.trim() || "None";
}

function submittedDocuments(record: PtcContextRecord) {
  const names = (record.progressDocuments || []).map((document) => document.requiredDocument?.name?.trim()).filter((name): name is string => Boolean(name));
  return names.length ? <><span>{names.length} submitted</span><ul className="compact-list">{names.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ul></> : "None";
}

export function PtcContextRows({ records, keeperId }: { records: PtcContextRecord[]; keeperId: string }) {
  const keeper = records.find((record) => record.id === keeperId);
  return <>{[
    { label: "Type of Application", read: typeName },
    { label: "Submitted Documents", read: submittedDocuments }
  ].map((row) => <tr key={row.label}>
    <th scope="row">{row.label}<small className="display-only-label">Display only — not copied</small></th>
    {records.map((record) => <td key={record.id}>{row.read(record)}</td>)}
    <td className="merge-result">{keeper ? <>{row.read(keeper)}<small>Retained record only — unchanged</small></> : "Choose a retained record"}</td>
  </tr>)}</>;
}
