"use client";

import { useMemo, useState } from "react";
import type { OfficeChoice } from "@/lib/ptc";

type PtcRecordFieldsProps = {
  officeChoices: OfficeChoice[];
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
    recordedValidityDays?: number | null;
    actualValidityDays?: number | null;
    actualFee?: string | number | null;
    recordedFee?: string | number | null;
    officialReceiptNumber?: string | null;
    replantedSeedlings?: boolean | null;
    locExemption?: "Owner" | "Others" | null;
    agriculturist?: string | null;
    recommendingApproval?: string | null;
    approved?: string | null;
  };
};

function feeDefault(value?: string | number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function numberDefault(value?: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

export function PtcRecordFields({ defaults, officeChoices }: PtcRecordFieldsProps) {
  const [regionalOffice, setRegionalOffice] = useState(defaults?.regionalOffice || "");
  const provincialOffices = useMemo(
    () => officeChoices.find((office) => office.name === regionalOffice)?.provincialOffices || [],
    [officeChoices, regionalOffice]
  );

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
            {officeChoices.map((office) => <option key={office.id} value={office.name}>{office.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="provincialOffice">Provincial Office</label>
          <select id="provincialOffice" name="provincialOffice" defaultValue={defaults?.provincialOffice || ""}>
            <option value="">Choose provincial office</option>
            {provincialOffices.map((office) => <option key={office.id} value={office.name}>{office.name}</option>)}
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
        <div className="field">
          <label htmlFor="replantedSeedlings">Replanted Seedlings</label>
          <select id="replantedSeedlings" name="replantedSeedlings" defaultValue={defaults?.replantedSeedlings === true ? "true" : defaults?.replantedSeedlings === false ? "false" : ""}>
            <option value="">Blank</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="recordedFee">Recorded Fee</label>
          <input id="recordedFee" name="recordedFee" type="number" min="0" step="0.01" defaultValue={feeDefault(defaults?.recordedFee)} />
        </div>
        <div className="field">
          <label htmlFor="actualFee">Actual Fee</label>
          <input id="actualFee" name="actualFee" type="number" min="0" step="0.01" defaultValue={feeDefault(defaults?.actualFee)} />
        </div>
        <div className="field">
          <label htmlFor="recordedValidityDays">Recorded Validity</label>
          <input id="recordedValidityDays" name="recordedValidityDays" type="number" min="0" step="1" defaultValue={numberDefault(defaults?.recordedValidityDays)} />
        </div>
        <div className="field">
          <label htmlFor="actualValidityDays">Actual Validity</label>
          <input id="actualValidityDays" name="actualValidityDays" type="number" min="0" step="1" defaultValue={numberDefault(defaults?.actualValidityDays)} />
        </div>
        <div className="field">
          <label htmlFor="locExemption">LOC Exemption</label>
          <select id="locExemption" name="locExemption" defaultValue={defaults?.locExemption || ""}>
            <option value="">Blank</option>
            <option value="Owner">Owner</option>
            <option value="Others">Others</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="officialReceiptNumber">Official Receipt No.</label>
          <input id="officialReceiptNumber" name="officialReceiptNumber" defaultValue={defaults?.officialReceiptNumber || ""} />
        </div>
        <div className="field">
          <label htmlFor="recommendingApproval">Recommending Approval</label>
          <input id="recommendingApproval" name="recommendingApproval" defaultValue={defaults?.recommendingApproval || ""} />
        </div>
        <div className="field">
          <label htmlFor="approved">Approved</label>
          <input id="approved" name="approved" defaultValue={defaults?.approved || ""} />
        </div>
        <div className="field full-width-field">
          <label htmlFor="agriculturist">Agriculturist</label>
          <input id="agriculturist" name="agriculturist" defaultValue={defaults?.agriculturist || ""} />
        </div>
      </div>
    </section>
  );
}
