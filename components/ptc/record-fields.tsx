"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FieldHelp } from "@/components/ui/field-help";
import { NumericInput } from "@/components/ui/numeric-input";
import { SignatureFieldGroup } from "@/components/ui/signature-field-group";
import type { OfficeChoice } from "@/lib/ptc";
import { ptcSignatureMessages } from "@/lib/signatures";

type PtcRecordFieldsProps = {
  officeChoices: OfficeChoice[];
  checkerAccess?: { fees: boolean; validity: boolean };
  onGeneratedFindingsChange?: (findings: string[]) => void;
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
    recommendingApprovalSignatureStatus?: string | null;
    recommendingApprovalSignatureForName?: string | null;
    approved?: string | null;
    approvedSignatureStatus?: string | null;
    approvedSignatureForName?: string | null;
  };
};

function feeDefault(value?: string | number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function numberDefault(value?: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function numericValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSavedFee(value?: string | number | null) {
  const parsed = numericValue(value);
  return parsed === null ? "" : `PHP ${parsed.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type FeePreview = { actualFee: number; processingFee: number; applicationFee: number; replantingFee: number; finding: string | null };
type ValidityPreview = { actualValidityDays: number; exceedsSinglePtcLimit: boolean; maxTreesPerPtc: number; finding: string | null };
type AutoCheckStatus = { kind: "idle" | "missing" | "calculating" | "ready" | "error"; message: string };

const PTC_SIGNATURE_FIELD_NAMES = new Set([
  "recommendingApproval",
  "recommendingApprovalSignatureStatus",
  "recommendingApprovalSignatureForName",
  "approved",
  "approvedSignatureStatus",
  "approvedSignatureForName"
]);

function sameFindings(current: string[], next: string[]) {
  return current.length === next.length && current.every((finding, index) => finding === next[index]);
}

export function PtcRecordFields({ defaults, officeChoices, checkerAccess, onGeneratedFindingsChange }: PtcRecordFieldsProps) {
  const hasCalculationChecks = Boolean(checkerAccess?.fees || checkerAccess?.validity);
  const [regionalOffice, setRegionalOffice] = useState(defaults?.regionalOffice || "");
  const [feeApplied, setFeeApplied] = useState(false);
  const [validityApplied, setValidityApplied] = useState(false);
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [validityPreview, setValidityPreview] = useState<ValidityPreview | null>(null);
  const [signatureFindings, setSignatureFindings] = useState<string[]>([]);
  const [autoCheckStatus, setAutoCheckStatus] = useState<AutoCheckStatus>({ kind: "idle", message: "Fill out the checker inputs to start the automatic PTC check." });
  const autoCheckHostRef = useRef<HTMLDivElement | null>(null);
  const signatureFieldsRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);
  const provincialOffices = useMemo(
    () => officeChoices.find((office) => office.name === regionalOffice)?.provincialOffices || [],
    [officeChoices, regionalOffice]
  );
  const savedActualFee = numericValue(defaults?.actualFee);
  const savedFeeWasCorrected = savedActualFee !== null && feePreview !== null && savedActualFee !== feePreview.actualFee;

  useEffect(() => {
    onGeneratedFindingsChange?.([feePreview?.finding, validityPreview?.finding, ...signatureFindings].filter((finding): finding is string => Boolean(finding)));
  }, [feePreview, validityPreview, signatureFindings, onGeneratedFindingsChange]);

  useEffect(() => {
    const form = signatureFieldsRef.current?.closest("form");
    if (!form) return;
    const updateSignatureFindings = () => {
      const data = new FormData(form);
      const nextFindings = ptcSignatureMessages({
        recommendingApproval: data.get("recommendingApproval")?.toString(),
        recommendingApprovalSignatureStatus: data.get("recommendingApprovalSignatureStatus")?.toString(),
        recommendingApprovalSignatureForName: data.get("recommendingApprovalSignatureForName")?.toString(),
        approved: data.get("approved")?.toString(),
        approvedSignatureStatus: data.get("approvedSignatureStatus")?.toString(),
        approvedSignatureForName: data.get("approvedSignatureForName")?.toString()
      });
      setSignatureFindings((current) => sameFindings(current, nextFindings) ? current : nextFindings);
    };
    const updateForSignatureField = (event: Event) => {
      const target = event.target;
      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && PTC_SIGNATURE_FIELD_NAMES.has(target.name)) {
        updateSignatureFindings();
      }
    };
    updateSignatureFindings();
    form.addEventListener("input", updateForSignatureField);
    form.addEventListener("change", updateForSignatureField);
    return () => {
      form.removeEventListener("input", updateForSignatureField);
      form.removeEventListener("change", updateForSignatureField);
    };
  }, []);

  useEffect(() => {
    if (!checkerAccess?.fees && !checkerAccess?.validity) return;
    const form = autoCheckHostRef.current?.closest("form");
    if (!form) return;

    const readInput = (name: string) => {
      const field = form.elements.namedItem(name);
      return field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? field.value : "";
    };
    const resetAutoResult = () => {
      setFeeApplied(false);
      setValidityApplied(false);
      setFeePreview(null);
      setValidityPreview(null);
    };
    const runAutoCheck = async () => {
      const versionId = readInput("versionId");
      const applicationTypeId = readInput("applicationTypeId");
      const treesApproved = readInput("treesApproved");
      const replantedSeedlings = readInput("replantedSeedlings");
      const missing: string[] = [];
      const trees = Number(treesApproved);

      if (!versionId) missing.push("Choose a Version.");
      if (!applicationTypeId) missing.push("Choose a Type of Application.");
      if (!treesApproved || !Number.isFinite(trees) || trees <= 0) missing.push("Enter approved trees greater than zero.");
      if (checkerAccess.fees && replantedSeedlings !== "true" && replantedSeedlings !== "false") missing.push("Choose Yes or No for Replanted Seedlings.");
      if (missing.length > 0) {
        resetAutoResult();
        setAutoCheckStatus({ kind: "missing", message: missing.join(" ") });
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setAutoCheckStatus({ kind: "calculating", message: "Calculating PTC fee and validity from the current form values..." });
      const data = new FormData(form);
      try {
        const replanted = String(data.get("replantedSeedlings") || "");
        const response = await fetch("/api/ptc-checks/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: data.get("versionId"),
            applicationTypeId: data.get("applicationTypeId"),
            treesApproved: data.get("treesApproved"),
            replantedSeedlings: replanted === "true" ? true : replanted === "false" ? false : null,
            recordedFee: data.get("recordedFee"),
            recordedValidityDays: data.get("recordedValidityDays"),
            checkFees: Boolean(checkerAccess.fees),
            checkValidity: Boolean(checkerAccess.validity)
          })
        });
        const result = await response.json() as { error?: string; fee?: FeePreview; validity?: ValidityPreview };
        if (requestIdRef.current !== requestId) return;
        if (!response.ok || result.error) throw new Error(result.error || "Could not calculate the PTC check.");

        if (result.fee) {
          const actualFee = form.elements.namedItem("actualFee");
          if (actualFee instanceof HTMLInputElement) actualFee.value = String(result.fee.actualFee);
          setFeePreview(result.fee);
          setFeeApplied(true);
        } else {
          setFeePreview(null);
          setFeeApplied(false);
        }
        if (result.validity) {
          const actualValidity = form.elements.namedItem("actualValidityDays");
          if (actualValidity instanceof HTMLInputElement) actualValidity.value = String(result.validity.actualValidityDays);
          setValidityPreview(result.validity);
          setValidityApplied(true);
        } else {
          setValidityPreview(null);
          setValidityApplied(false);
        }
        setAutoCheckStatus({ kind: "ready", message: "Automatic PTC check is using the current form values." });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        resetAutoResult();
        setAutoCheckStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not calculate the PTC check." });
      }
    };

    let timeoutId = window.setTimeout(runAutoCheck, 0);
    const schedule = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(runAutoCheck, 350);
    };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    return () => {
      window.clearTimeout(timeoutId);
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
    };
  }, [checkerAccess?.fees, checkerAccess?.validity]);

  return (
    <section ref={signatureFieldsRef} className="form-section">
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
          <NumericInput id="treesApplied" name="treesApplied" min="0" defaultValue={defaults?.treesApplied ?? ""} integer />
        </div>
        <div className="field">
          <label htmlFor="treesApproved">Number of trees approved</label>
          <NumericInput id="treesApproved" name="treesApproved" min="0" defaultValue={defaults?.treesApproved ?? ""} integer />
        </div>
        <div className="field">
          <label htmlFor="seedlingsReplacement">Number of Seedlings Replacement</label>
          <NumericInput id="seedlingsReplacement" name="seedlingsReplacement" min="0" defaultValue={defaults?.seedlingsReplacement ?? ""} integer />
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
          <label htmlFor="recordedFee">Recorded Fee <FieldHelp label="Recorded Fee guide" text="Recorded Fee is the amount written on the permit or source document. The checker compares this against Actual Fee but does not change what was recorded." /></label>
          <NumericInput id="recordedFee" name="recordedFee" min="0" step="0.01" defaultValue={feeDefault(defaults?.recordedFee)} />
        </div>
        <div className="field">
          <label htmlFor="actualFee">Actual Fee <FieldHelp label="PTC fee formula" text="PTC Actual Fee = processing fee + application fee per approved tree + replanting/replacement fee. Replanted Seedlings = Yes means no replanting fee; No means apply the configured per-tree replacement fee." /></label>
          <NumericInput id="actualFee" name="actualFee" min="0" step="0.01" defaultValue={feeDefault(defaults?.actualFee)} readOnly={feeApplied} />
          {savedFeeWasCorrected ? <span className="warning-text">Saved value before auto-check: {formatSavedFee(defaults?.actualFee)}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="recordedValidityDays">Recorded Validity <FieldHelp label="Recorded Validity guide" text="Recorded Validity is the number of days written on the permit. The checker compares this against Actual Validity but does not change what was recorded." /></label>
          <NumericInput id="recordedValidityDays" name="recordedValidityDays" min="0" step="1" defaultValue={numberDefault(defaults?.recordedValidityDays)} integer />
        </div>
        <div className="field">
          <label htmlFor="actualValidityDays">Actual Validity <FieldHelp label="PTC validity rules" text="PTC validity uses approved trees: 1 to 20 trees = 3 days, 21 to 50 trees = 10 days, 51 to 100 trees = 15 days. More than 100 trees is flagged because each individual PTC is capped at 100 trees." /></label>
          <NumericInput id="actualValidityDays" name="actualValidityDays" min="0" step="1" defaultValue={numberDefault(defaults?.actualValidityDays)} readOnly={validityApplied} integer />
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
        <SignatureFieldGroup label="Recommending Approval Signature" statusName="recommendingApprovalSignatureStatus" forNameName="recommendingApprovalSignatureForName" defaultStatus={defaults?.recommendingApprovalSignatureStatus} defaultForName={defaults?.recommendingApprovalSignatureForName} fallbackLabel="Approved" />
        <SignatureFieldGroup label="Approved Signature" statusName="approvedSignatureStatus" forNameName="approvedSignatureForName" defaultStatus={defaults?.approvedSignatureStatus} defaultForName={defaults?.approvedSignatureForName} fallbackLabel="Recommending Approval" />
        <div className="field full-width-field">
          <label htmlFor="agriculturist">Agriculturist</label>
          <input id="agriculturist" name="agriculturist" defaultValue={defaults?.agriculturist || ""} />
        </div>
      </div>
      {hasCalculationChecks ? <>
        <input type="hidden" name="applyFeeCheck" value={feeApplied ? "true" : "false"} />
        <input type="hidden" name="applyValidityCheck" value={validityApplied ? "true" : "false"} />
      </> : null}
      <aside ref={autoCheckHostRef} className="form-section calculation-panel">
        <div className="section-heading-row"><div><h3>PTC Auto Check</h3><p className="muted">Checks the selected Version, Type of Application, approved trees, Replanted Seedlings, recorded values, and signatures.</p></div></div>
        {hasCalculationChecks ? <>
          {autoCheckStatus.kind === "missing" || autoCheckStatus.kind === "error" ? <p className="error-text" role="alert">{autoCheckStatus.message}</p> : <p className={autoCheckStatus.kind === "ready" ? "success-text" : "muted"}>{autoCheckStatus.message}</p>}
          {feePreview ? <div className="calculation-result"><strong>Actual Fee: {feePreview.actualFee.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>Processing {feePreview.processingFee.toLocaleString("en-PH")} + application {feePreview.applicationFee.toLocaleString("en-PH")} + replanting {feePreview.replantingFee.toLocaleString("en-PH")}</span>{feePreview.finding ? <p className="warning-text">{feePreview.finding}</p> : <p className="success-text">Fees match.</p>}</div> : null}
          {validityPreview ? <div className="calculation-result"><strong>Actual Validity: {validityPreview.actualValidityDays} day{validityPreview.actualValidityDays === 1 ? "" : "s"}</strong>{validityPreview.finding ? <p className="warning-text">{validityPreview.finding}</p> : <p className="success-text">Validity matches.</p>}</div> : null}
        </> : null}
        <div className="calculation-result"><strong>Signature Check</strong>{signatureFindings.length > 0 ? signatureFindings.map((finding) => <p className="warning-text" key={finding}>{finding}</p>) : <p className="success-text">Recommending Approval and Approved signatures are signed.</p>}</div>
      </aside>
    </section>
  );
}
