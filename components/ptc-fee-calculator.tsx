"use client";

import { useEffect, useMemo, useState } from "react";
import { calculatePtcFees, DEFAULT_REPLACEMENT_FEE_RATE, type PtcFeeResult, type ReplacementFeeRate } from "@/lib/ptc-fees";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const REPLACEMENT_FEE_STORAGE_KEY = "ra8048-calculator-replacement-fee";

type CalculatorState = {
  error: string;
  result: PtcFeeResult | null;
};

export function PtcFeeCalculator() {
  const [trees, setTrees] = useState("");
  const [replantedSeedlings, setReplantedSeedlings] = useState<"" | "yes" | "no">("");
  const [replacementFeeRate, setReplacementFeeRate] = useState<ReplacementFeeRate>(DEFAULT_REPLACEMENT_FEE_RATE);
  const [damagedByNaturalCalamity, setDamagedByNaturalCalamity] = useState(false);
  const [powerLineCorridor, setPowerLineCorridor] = useState(false);

  useEffect(() => {
    try {
      const savedRate = window.localStorage.getItem(REPLACEMENT_FEE_STORAGE_KEY);
      if (savedRate === "50" || savedRate === "100") {
        setReplacementFeeRate(Number(savedRate) as ReplacementFeeRate);
      }
    } catch {
      // The calculator remains usable when browser storage is unavailable.
    }
  }, []);

  const calculation = useMemo<CalculatorState>(() => {
    const approvedTrees = Number(trees);
    if (!Number.isInteger(approvedTrees) || approvedTrees < 1) {
      return { error: "Enter a whole number of approved trees greater than zero.", result: null };
    }
    if (!replantedSeedlings) {
      return { error: "Choose whether seedlings were replanted to calculate the PTC fee.", result: null };
    }

    return {
      error: "",
      result: calculatePtcFees({
        trees: approvedTrees,
        replantedSeedlings: replantedSeedlings === "yes",
        replacementFeeRate,
        damagedByNaturalCalamity,
        powerLineCorridor
      })
    };
  }, [damagedByNaturalCalamity, powerLineCorridor, replacementFeeRate, replantedSeedlings, trees]);

  function setSavedReplacementFeeRate(value: string) {
    const nextRate = Number(value) as ReplacementFeeRate;
    setReplacementFeeRate(nextRate);
    try {
      window.localStorage.setItem(REPLACEMENT_FEE_STORAGE_KEY, String(nextRate));
    } catch {
      // The in-memory choice still applies to the current calculation.
    }
  }

  function clear() {
    setTrees("");
    setReplantedSeedlings("");
    setDamagedByNaturalCalamity(false);
    setPowerLineCorridor(false);
  }

  return <section className="panel form calculator-panel">
    <div className="grid cols-3">
      <div className="field">
        <label htmlFor="approved-trees">Number of Trees Approved</label>
        <input id="approved-trees" type="number" min="1" step="1" value={trees} onChange={(event) => setTrees(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="replanted-seedlings">Replanted Seedlings</label>
        <select id="replanted-seedlings" value={replantedSeedlings} onChange={(event) => setReplantedSeedlings(event.target.value as "" | "yes" | "no")}>
          <option value="">Choose Yes or No</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="replacement-fee">Replacement Fee</label>
        <select id="replacement-fee" value={replacementFeeRate} onChange={(event) => setSavedReplacementFeeRate(event.target.value)}>
          <option value="50">PHP 50 per tree</option>
          <option value="100">PHP 100 per tree</option>
        </select>
      </div>
    </div>
    <div className="checklist" aria-label="PTC fee conditions">
      <label className="check"><input type="checkbox" checked={damagedByNaturalCalamity} onChange={(event) => setDamagedByNaturalCalamity(event.target.checked)} />Damaged by natural calamity</label>
      <label className="check"><input type="checkbox" checked={powerLineCorridor} onChange={(event) => setPowerLineCorridor(event.target.checked)} />Power Line Corridor</label>
    </div>
    <p className="muted">The replacement fee is PHP {replacementFeeRate} per approved tree when Replanted Seedlings is set to No. It is not charged when set to Yes. This choice is remembered in this browser.</p>
    <div className="actions">
      <button className="button secondary" type="button" onClick={clear}>Clear</button>
    </div>
    {calculation.error ? <div className="warning-panel calculation-result" role="alert"><h2>Calculator needs information</h2><p>{calculation.error}</p></div> : null}
    {calculation.result ? <FeeResult result={calculation.result} /> : null}
  </section>;
}

function FeeResult({ result }: { result: PtcFeeResult }) {
  return <div className="calculation-result">
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
  </div>;
}