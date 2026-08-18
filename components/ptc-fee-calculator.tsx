"use client";

import { useState } from "react";
import { calculatePtcFees, type PtcFeeResult } from "@/lib/ptc-fees";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function PtcFeeCalculator() {
  const [trees, setTrees] = useState("");
  const [replantedSeedlings, setReplantedSeedlings] = useState<"" | "yes" | "no">("");
  const [damagedByNaturalCalamity, setDamagedByNaturalCalamity] = useState(false);
  const [powerLineCorridor, setPowerLineCorridor] = useState(false);
  const [result, setResult] = useState<PtcFeeResult | null>(null);
  const [error, setError] = useState("");

  function calculate() {
    const approvedTrees = Number(trees);
    if (!Number.isInteger(approvedTrees) || approvedTrees < 1) {
      setError("Enter a whole number of approved trees greater than zero.");
      setResult(null);
      return;
    }
    if (!replantedSeedlings) {
      setError("Choose whether seedlings were replanted before calculating the PTC fee.");
      setResult(null);
      return;
    }

    setError("");
    setResult(calculatePtcFees({
      trees: approvedTrees,
      replantedSeedlings: replantedSeedlings === "yes",
      damagedByNaturalCalamity,
      powerLineCorridor
    }));
  }

  function clear() {
    setTrees("");
    setReplantedSeedlings("");
    setDamagedByNaturalCalamity(false);
    setPowerLineCorridor(false);
    setResult(null);
    setError("");
  }

  return <section className="panel form calculator-panel">
    <div className="grid cols-2">
      <div className="field">
        <label htmlFor="approved-trees">Number of Trees Approved</label>
        <input id="approved-trees" type="number" min="1" step="1" value={trees} onChange={(event) => { setTrees(event.target.value); setResult(null); }} />
      </div>
      <div className="field">
        <label htmlFor="replanted-seedlings">Replanted Seedlings</label>
        <select id="replanted-seedlings" value={replantedSeedlings} onChange={(event) => { setReplantedSeedlings(event.target.value as "" | "yes" | "no"); setResult(null); }}>
          <option value="">Choose Yes or No</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
    </div>
    <div className="checklist" aria-label="PTC fee conditions">
      <label className="check"><input type="checkbox" checked={damagedByNaturalCalamity} onChange={(event) => { setDamagedByNaturalCalamity(event.target.checked); setResult(null); }} />Damaged by natural calamity</label>
      <label className="check"><input type="checkbox" checked={powerLineCorridor} onChange={(event) => { setPowerLineCorridor(event.target.checked); setResult(null); }} />Power Line Corridor</label>
    </div>
    <p className="muted">Replanting Fee is PHP 100 per approved tree when Replanted Seedlings is set to No. It is not charged when set to Yes.</p>
    <div className="actions">
      <button className="button" type="button" onClick={calculate}>Calculate</button>
      <button className="button secondary" type="button" onClick={clear}>Clear</button>
    </div>
    {error ? <p className="error-text" role="alert">{error}</p> : null}
    {result ? <div className="calculation-result">
      <h2>PTC Fee Result</h2>
      {result.exempt ? <p className="warning-text">{result.exemptionReason}</p> : null}
      <div className="grid cols-4 fee-results">
        <div><span>Processing Fee</span><strong>{peso.format(result.processingFee)}</strong></div>
        <div><span>Application Fee</span><strong>{peso.format(result.applicationFee)}</strong></div>
        <div><span>Replanting Fee</span><strong>{peso.format(result.replantingFee)}</strong></div>
        <div><span>Total PTC Fee</span><strong>{peso.format(result.total)}</strong></div>
      </div>
      <div className="grid cols-2 calculator-guidance">
        <p><strong>PTCs Required:</strong> {result.ptcCount || "Blank"}</p>
        <p><strong>Validity:</strong> {result.validityDays ? `${result.validityDays} days` : "Indefinite / exempt"}</p>
        <p><strong>Recommending Authority:</strong> {result.recommendingAuthority}</p>
        <p><strong>Approving Authority:</strong> {result.approvingAuthority}</p>
      </div>
      {result.exceedsSinglePtcLimit ? <p className="warning-text">An individual PTC can cover a maximum of 100 trees. This calculation represents {result.ptcCount} PTCs; each permit should be issued and reviewed separately.</p> : null}
    </div> : null}
  </section>;
}
