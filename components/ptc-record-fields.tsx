"use client";

import { useMemo, useState } from "react";
import { PROVINCIAL_OFFICES_BY_REGION, REGIONAL_OFFICES } from "@/lib/ptc";

type PtcRecordFieldsProps = {
  defaults?: {
    dateIssued?: string | null;
    ptcNumber?: string | null;
    regionalOffice?: string | null;
    provincialOffice?: string | null;
    municipality?: string | null;
    barangay?: string | null;
    treesApplied?: number | null;
    treesApproved?: number | null;
    seedlingsReplacement?: number | null;
  };
};

export function PtcRecordFields({ defaults }: PtcRecordFieldsProps) {
  const [regionalOffice, setRegionalOffice] = useState(defaults?.regionalOffice || "");
  const provincialOffices = useMemo(() => PROVINCIAL_OFFICES_BY_REGION[regionalOffice] || [], [regionalOffice]);

  return (
    <section className="form-section">
      <h3>PTC Details</h3>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="dateIssued">Date Issued</label>
          <input id="dateIssued" name="dateIssued" type="date" defaultValue={defaults?.dateIssued || ""} />
        </div>
        <div className="field">
          <label htmlFor="ptcNumber">PTC Number</label>
          <input id="ptcNumber" name="ptcNumber" defaultValue={defaults?.ptcNumber || ""} />
        </div>
        <div className="field">
          <label htmlFor="regionalOffice">Regional Office</label>
          <select
            id="regionalOffice"
            name="regionalOffice"
            value={regionalOffice}
            onChange={(event) => setRegionalOffice(event.target.value)}
          >
            <option value="">Choose regional office</option>
            {REGIONAL_OFFICES.map((office) => <option key={office} value={office}>{office}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="provincialOffice">Provincial Office</label>
          <select id="provincialOffice" name="provincialOffice" defaultValue={defaults?.provincialOffice || ""}>
            <option value="">Choose provincial office</option>
            {provincialOffices.map((office) => <option key={office} value={office}>{office}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="municipality">Municipality</label>
          <input id="municipality" name="municipality" defaultValue={defaults?.municipality || ""} />
        </div>
        <div className="field">
          <label htmlFor="barangay">Barangay</label>
          <input id="barangay" name="barangay" defaultValue={defaults?.barangay || ""} />
        </div>
        <div className="field">
          <label htmlFor="treesApplied">Number of trees applied</label>
          <input id="treesApplied" name="treesApplied" type="number" min="0" defaultValue={defaults?.treesApplied ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="treesApproved">Number of trees approved</label>
          <input id="treesApproved" name="treesApproved" type="number" min="0" defaultValue={defaults?.treesApproved ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="seedlingsReplacement">Number of Seedlings Replacement</label>
          <input id="seedlingsReplacement" name="seedlingsReplacement" type="number" min="0" defaultValue={defaults?.seedlingsReplacement ?? ""} />
        </div>
      </div>
    </section>
  );
}