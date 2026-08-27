"use client";

import { useEffect, useMemo, useState } from "react";
import { resetPtcApplicationTypeRuleAction, savePtcCalculationRuleAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_PTC_CALCULATION_CONFIG, type PtcCalculationConfig } from "@/lib/ptc-checks";

type Rule = { applicationTypeId: string | null; config: PtcCalculationConfig };

export function PtcCalculationRulesManager({ versionId, versionName, applicationTypes, rules, returnTo }: {
  versionId: string;
  versionName: string;
  applicationTypes: { id: string; name: string }[];
  rules: Rule[];
  returnTo?: string;
}) {
  const [applicationTypeId, setApplicationTypeId] = useState("");
  const baseRule = rules.find((rule) => rule.applicationTypeId === null)?.config || DEFAULT_PTC_CALCULATION_CONFIG;
  const selectedRule = useMemo(() => rules.find((rule) => rule.applicationTypeId === applicationTypeId)?.config || baseRule, [applicationTypeId, baseRule, rules]);
  const hasOverride = rules.some((rule) => rule.applicationTypeId === applicationTypeId);
  const [tiers, setTiers] = useState(selectedRule.processingTiers);
  const [brackets, setBrackets] = useState(selectedRule.validityBrackets);

  useEffect(() => {
    setTiers(selectedRule.processingTiers);
    setBrackets(selectedRule.validityBrackets);
  }, [selectedRule]);

  return <section className="panel form">
    <div className="section-heading-row"><div><h2>PTC Calculation Rules</h2><p className="muted">Configure the baseline for {versionName}, or select a Type of Application to save an override.</p></div></div>
    <form action={savePtcCalculationRuleAction} className="form" key={applicationTypeId || "version-default"}>
      <input type="hidden" name="versionId" value={versionId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div className="field">
        <label htmlFor="calculationApplicationType">Rule scope</label>
        <select id="calculationApplicationType" name="applicationTypeId" value={applicationTypeId} onChange={(event) => setApplicationTypeId(event.target.value)}>
          <option value="">Version default</option>
          {applicationTypes.map((type) => <option key={type.id} value={type.id}>{type.name}{rules.some((rule) => rule.applicationTypeId === type.id) ? " (override)" : " (inherits default)"}</option>)}
        </select>
      </div>
      <div className="form-section"><h3>Processing Fee Tiers</h3>
        {tiers.map((tier, index) => <div className="grid cols-2 inline-rule-row" key={`${index}-${tier.upTo}`}>
          <div className="field"><label>Up to approved trees</label><input name="tierUpTo" type="number" min="1" value={tier.upTo} onChange={(event) => setTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, upTo: Number(event.target.value) } : item))} required /></div>
          <div className="field"><label>Processing fee</label><input name="tierFee" type="number" min="0" step="0.01" value={tier.fee} onChange={(event) => setTiers((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, fee: Number(event.target.value) } : item))} required /></div>
        </div>)}
        <div className="actions"><button className="button secondary" type="button" onClick={() => setTiers((items) => [...items, { upTo: (items[items.length - 1]?.upTo || 0) + 1, fee: items[items.length - 1]?.fee || 0 }])}>Add Processing Tier</button>{tiers.length > 1 ? <button className="button secondary" type="button" onClick={() => setTiers((items) => items.slice(0, -1))}>Remove Last Tier</button> : null}</div>
      </div>
      <div className="grid cols-4">
        <div className="field"><label>Additional tree step</label><input name="additionalProcessingStep" type="number" min="1" defaultValue={selectedRule.additionalProcessingStep} required /></div>
        <div className="field"><label>Additional processing fee</label><input name="additionalProcessingFee" type="number" min="0" step="0.01" defaultValue={selectedRule.additionalProcessingFee} required /></div>
        <div className="field"><label>Application fee per tree</label><input name="applicationFeePerTree" type="number" min="0" step="0.01" defaultValue={selectedRule.applicationFeePerTree} required /></div>
        <div className="field"><label>Replanting fee per tree</label><input name="replantingFeePerTree" type="number" min="0" step="0.01" defaultValue={selectedRule.replantingFeePerTree} required /></div>
      </div>
      <div className="form-section"><h3>Validity Rules</h3>
        <div className="field"><label>Maximum trees per individual PTC</label><input name="maxTreesPerPtc" type="number" min="1" defaultValue={selectedRule.maxTreesPerPtc} required /></div>
        {brackets.map((bracket, index) => <div className="grid cols-2 inline-rule-row" key={`${index}-${bracket.upTo}`}>
          <div className="field"><label>Up to approved trees</label><input name="validityUpTo" type="number" min="1" value={bracket.upTo} onChange={(event) => setBrackets((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, upTo: Number(event.target.value) } : item))} required /></div>
          <div className="field"><label>Validity days</label><input name="validityDays" type="number" min="1" value={bracket.days} onChange={(event) => setBrackets((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, days: Number(event.target.value) } : item))} required /></div>
        </div>)}
        <div className="actions"><button className="button secondary" type="button" onClick={() => setBrackets((items) => [...items, { upTo: (items[items.length - 1]?.upTo || 0) + 1, days: items[items.length - 1]?.days || 1 }])}>Add Validity Bracket</button>{brackets.length > 1 ? <button className="button secondary" type="button" onClick={() => setBrackets((items) => items.slice(0, -1))}>Remove Last Bracket</button> : null}</div>
      </div>
      <div className="actions"><SubmitButton pendingText="Saving rules...">Save Rules</SubmitButton></div>
    </form>
    {applicationTypeId && hasOverride ? <form action={resetPtcApplicationTypeRuleAction} className="actions"><input type="hidden" name="versionId" value={versionId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}<input type="hidden" name="applicationTypeId" value={applicationTypeId} /><SubmitButton className="button secondary" pendingText="Resetting...">Reset Override to Version Default</SubmitButton></form> : null}
  </section>;
}
