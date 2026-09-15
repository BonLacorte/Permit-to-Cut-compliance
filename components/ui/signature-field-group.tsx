"use client";

import { useState } from "react";
import { FieldHelp } from "@/components/ui/field-help";
import { normalizeSignatureStatus, SIGNATURE_STATUS_VALUES, type SignatureStatusValue } from "@/lib/signatures";

type SignatureFieldGroupProps = {
  label: string;
  statusName: string;
  forNameName: string;
  defaultStatus?: string | null;
  defaultForName?: string | null;
  fallbackLabel: string;
};

const helpText = "Signed means the correct named person signed. Blank means there is no signature. For means somebody signed on behalf of the named signatory; leave the For name blank to use the counterpart person automatically.";

export function SignatureFieldGroup({ label, statusName, forNameName, defaultStatus, defaultForName, fallbackLabel }: SignatureFieldGroupProps) {
  const [status, setStatus] = useState<SignatureStatusValue>(normalizeSignatureStatus(defaultStatus));

  return (
    <div className="field signature-field-group">
      <label>{label} <FieldHelp label={label + " guide"} text={helpText} /></label>
      <div className="radio-row">
        {SIGNATURE_STATUS_VALUES.map((value) => (
          <label key={value} className="checkbox-row">
            <input type="radio" name={statusName} value={value} checked={status === value} onChange={() => setStatus(value)} />
            <span>{value}</span>
          </label>
        ))}
      </div>
      {status === "For" ? <input name={forNameName} defaultValue={defaultForName || ""} placeholder={"Leave blank to use " + fallbackLabel} /> : null}
    </div>
  );
}
