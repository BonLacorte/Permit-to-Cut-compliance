"use client";

import { useEffect, useMemo, useState } from "react";
import { savePttValidityRuleAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_PTT_VALIDITY_RULE_CONFIG, normalizePttValidityRuleConfig, type PttValidityRuleConfig } from "@/lib/ptt-checks";

export type PttValidityRuleOption = PttValidityRuleConfig & { versionId: string };

type VersionOption = { id: string; name: string; active?: boolean };

export function PttValidityRulesManager({ versions, rules, returnTo }: { versions: VersionOption[]; rules: PttValidityRuleOption[]; returnTo?: string }) {
  const activeVersions = versions.filter((version) => version.active !== false);
  const selectableVersions = activeVersions.length > 0 ? activeVersions : versions;
  const [versionId, setVersionId] = useState(selectableVersions[0]?.id || "");
  const selectedRule = useMemo(
    () => normalizePttValidityRuleConfig(rules.find((rule) => rule.versionId === versionId) || DEFAULT_PTT_VALIDITY_RULE_CONFIG),
    [rules, versionId]
  );
  const [outsideDays, setOutsideDays] = useState(selectedRule.outsideRegionAllowedDays);

  useEffect(() => {
    setOutsideDays(selectedRule.outsideRegionAllowedDays);
  }, [selectedRule]);

  if (selectableVersions.length === 0) {
    return <section className="panel form"><h2>PTT Validity Rules</h2><p className="muted">Create a PTT Version before configuring validity rules.</p></section>;
  }

  return <section className="panel form">
    <div className="section-heading-row">
      <div>
        <h2>PTT Validity Rules</h2>
        <p className="muted">Configure destination-bound validity days by PTT Version. PTT auto checks use these values.</p>
      </div>
    </div>
    <form action={savePttValidityRuleAction} className="form" key={versionId}>
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div className="field">
        <label htmlFor="pttValidityVersionId">PTT Version</label>
        <select id="pttValidityVersionId" name="versionId" value={versionId} onChange={(event) => setVersionId(event.target.value)} required>
          {selectableVersions.map((version) => <option key={version.id} value={version.id}>{version.name}{version.active === false ? " (Archived)" : ""}</option>)}
        </select>
      </div>
      <div className="grid cols-3">
        <div className="field"><label htmlFor="withinMunicipalityDays">Within Municipality</label><input id="withinMunicipalityDays" name="withinMunicipalityDays" type="number" min="1" step="1" defaultValue={selectedRule.withinMunicipalityDays} required /></div>
        <div className="field"><label htmlFor="withinProvinceDays">Within Province</label><input id="withinProvinceDays" name="withinProvinceDays" type="number" min="1" step="1" defaultValue={selectedRule.withinProvinceDays} required /></div>
        <div className="field"><label htmlFor="withinRegionDays">Within Region</label><input id="withinRegionDays" name="withinRegionDays" type="number" min="1" step="1" defaultValue={selectedRule.withinRegionDays} required /></div>
      </div>
      <div className="form-section">
        <h3>Outside Region / Inter-Island Allowed Days</h3>
        {outsideDays.map((days, index) => <div className="grid cols-2 inline-rule-row" key={`${index}-${days}`}>
          <div className="field"><label>Allowed days</label><input name="outsideRegionAllowedDays" type="number" min="1" step="1" value={days} onChange={(event) => setOutsideDays((items) => items.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} required /></div>
        </div>)}
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => setOutsideDays((items) => [...items, (items[items.length - 1] || 0) + 1])}>Add Allowed Day</button>
          {outsideDays.length > 1 ? <button className="button secondary" type="button" onClick={() => setOutsideDays((items) => items.slice(0, -1))}>Remove Last Day</button> : null}
        </div>
      </div>
      <div className="actions"><SubmitButton pendingText="Saving validity rules...">Save Validity Rules</SubmitButton></div>
    </form>
  </section>;
}