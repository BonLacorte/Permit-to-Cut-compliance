"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FieldHelp } from "@/components/ui/field-help";
import { NumericInput } from "@/components/ui/numeric-input";
import { SignatureFieldGroup } from "@/components/ui/signature-field-group";
import type { VersionOption } from "@/components/ptc/document-picker";
import type { OfficeChoice } from "@/lib/ptc";
import { DEFAULT_PTT_VALIDITY_RULE_CONFIG, PTT_VEHICLE_CAPACITY_OPTIONS, normalizePttValidityRuleConfig, pttCapacityCategoryLabel, pttOutsideRegionValidityDays, pttValidityBasisLabel, pttValidityBasisOptions, type PttValidityRuleConfig } from "@/lib/ptt-checks";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

export type PttValidityRuleOption = PttValidityRuleConfig & { versionId: string };

export type PttTransportTypeOption = {
  id: string;
  versionId: string;
  name: string;
  active?: boolean;
  capacityCategory?: string | null;
  maxBoardFeet?: string | number | null;
};

type PttRecordFieldsProps = {
  versionOptions: VersionOption[];
  officeChoices: OfficeChoice[];
  transportTypes: PttTransportTypeOption[];
  validityRules: PttValidityRuleOption[];
  checkerAccess?: { fees: boolean; validity: boolean; vehicle: boolean };
  onGeneratedFindingsChange?: (findings: string[]) => void;
  defaults?: {
    versionId?: string | null;
    pttNumber?: string | null;
    dateIssued?: string | null;
    regionalOffice?: string | null;
    provincialOffice?: string | null;
    transporterAddress?: string | null;
    ptcNumber?: string | null;
    pcaRegistrationCertificateNumber?: string | null;
    pcaRegistrationCertificateDate?: string | null;
    businessAddress?: string | null;
    boardFeetGranted?: string | number | null;
    certificateOfQuantityVolumeAttached?: boolean | null;
    volumeBoardFeet?: string | number | null;
    originOfLumber?: string | null;
    destination?: string | null;
    consigneeName?: string | null;
    consigneePcaRegistration?: string | null;
    transportType?: string | null;
    actualTransportCategory?: string | null;
    vehiclePlateNumber?: string | null;
    authorizedDriverName?: string | null;
    authorizedDriverContact?: string | null;
    amountPaid?: string | number | null;
    actualFee?: string | number | null;
    officialReceiptNumber?: string | null;
    recordedValidityDays?: string | number | null;
    actualValidityDays?: string | number | null;
    validityBasis?: string | null;
    dateValidatedInspected?: string | null;
    validatedInspectedBy?: string | null;
    validatedInspectedBySignatureStatus?: string | null;
    validatedInspectedBySignatureForName?: string | null;
    issuedByDate?: string | null;
    issuedBy?: string | null;
    issuedBySignatureStatus?: string | null;
    issuedBySignatureForName?: string | null;
  };
};

function numberDefault(value?: string | number | null) {
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

function optionWithSavedValue(options: string[], savedValue?: string | null) {
  const saved = String(savedValue || "").trim();
  if (!saved || options.includes(saved)) return options;
  return [saved, ...options];
}

type FeePreview = { actualFee: number; ratePerBoardFoot: number; volumeBoardFeet: number; finding: string | null };
type ValidityPreview = { actualValidityDays: number; validityBasis: string; basisLabel: string; finding: string | null };
type VehiclePreview = { volumeBoardFeet: number; transportType: string; actualTransportCategory: string | null; actualTransportLabel: string; actualTransportMaxBoardFeet: number | null; maxBoardFeet: number | null; withinCapacity: boolean | null; warning: string | null; finding: string | null };
type AutoCheckStatus = { kind: "idle" | "missing" | "calculating" | "ready" | "error"; message: string };

export function PttRecordFields({ defaults, officeChoices, transportTypes, validityRules, versionOptions, checkerAccess, onGeneratedFindingsChange }: PttRecordFieldsProps) {
  const activeOptions = versionOptions.filter((version) => version.id === UNCATEGORIZED_VERSION || version.active !== false);
  const initialVersionId = defaults?.versionId || UNCATEGORIZED_VERSION;
  const initialTransportType = defaults?.transportType || "";
  const initialTransportTypeNames = new Set(transportTypes.filter((type) => type.versionId === initialVersionId).map((type) => type.name));
  const initialTransportIsOther = Boolean(initialTransportType && !initialTransportTypeNames.has(initialTransportType));
  const [versionId, setVersionId] = useState(initialVersionId);
  const [regionalOffice, setRegionalOffice] = useState(defaults?.regionalOffice || "");
  const [provincialOffice, setProvincialOffice] = useState(defaults?.provincialOffice || "");
  const [transportType, setTransportType] = useState(initialTransportIsOther ? "" : initialTransportType);
  const [transportIsOther, setTransportIsOther] = useState(initialTransportIsOther);
  const [customTransportType, setCustomTransportType] = useState(initialTransportIsOther ? initialTransportType : "");
  const savedActualTransportCategory = defaults?.actualTransportCategory || "";
  const [actualTransportCategory, setActualTransportCategory] = useState(savedActualTransportCategory);
  const [validityBasis, setValidityBasis] = useState(defaults?.validityBasis || "");
  const [outsideRegionValidityDays, setOutsideRegionValidityDays] = useState("");
  const [feeApplied, setFeeApplied] = useState(false);
  const [validityApplied, setValidityApplied] = useState(false);
  const [vehicleApplied, setVehicleApplied] = useState(false);
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [validityPreview, setValidityPreview] = useState<ValidityPreview | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<VehiclePreview | null>(null);
  const [autoCheckStatus, setAutoCheckStatus] = useState<AutoCheckStatus>({ kind: "idle", message: "Fill out checker inputs to start the automatic PTT check." });
  const autoCheckHostRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  const provincialOffices = useMemo(
    () => officeChoices.find((office) => office.name === regionalOffice)?.provincialOffices.map((office) => office.name) || [],
    [officeChoices, regionalOffice]
  );
  const provincialOptions = optionWithSavedValue(provincialOffices, defaults?.provincialOffice);
  const transportTypeOptions = optionWithSavedValue(
    transportTypes.filter((type) => type.versionId === versionId).map((type) => type.name),
    transportIsOther ? null : defaults?.transportType
  );
  const actualTransportDisplay = pttCapacityCategoryLabel(actualTransportCategory) || "";
  const savedActualFee = numericValue(defaults?.actualFee);
  const savedFeeWasCorrected = savedActualFee !== null && feePreview !== null && savedActualFee !== feePreview.actualFee;

  const selectedValidityRule = useMemo(
    () => normalizePttValidityRuleConfig(validityRules.find((rule) => rule.versionId === versionId) || DEFAULT_PTT_VALIDITY_RULE_CONFIG),
    [validityRules, versionId]
  );
  const outsideValidityDayOptions = useMemo(() => pttOutsideRegionValidityDays(selectedValidityRule), [selectedValidityRule]);

  useEffect(() => {
    onGeneratedFindingsChange?.([feePreview?.finding, validityPreview?.finding, vehiclePreview?.finding].filter((finding): finding is string => Boolean(finding)));
  }, [feePreview, validityPreview, vehiclePreview, onGeneratedFindingsChange]);

  useEffect(() => {
    if (!checkerAccess?.fees && !checkerAccess?.validity && !checkerAccess?.vehicle) return;
    const form = autoCheckHostRef.current?.closest("form");
    if (!form) return;

    const readInput = (name: string) => {
      const field = form.elements.namedItem(name);
      return field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? field.value : "";
    };
    const resetAutoResult = () => {
      setFeeApplied(false);
      setValidityApplied(false);
      setVehicleApplied(false);
      setFeePreview(null);
      setValidityPreview(null);
      setVehiclePreview(null);
      setActualTransportCategory(savedActualTransportCategory);
    };
    const runAutoCheck = async () => {
      const currentVersionId = readInput("versionId");
      const currentTransportType = readInput("transportType");
      const volumeText = readInput("volumeBoardFeet");
      const basis = readInput("validityBasis");
      const outsideDays = readInput("outsideRegionValidityDays");
      const volume = Number(volumeText);
      const missing: string[] = [];
      if (!currentVersionId) missing.push("Choose a PTT Version.");
      if ((checkerAccess.fees || checkerAccess.vehicle) && (!volumeText || !Number.isFinite(volume) || volume <= 0)) missing.push("Enter transported volume greater than zero.");
      if (checkerAccess.vehicle && !currentTransportType) missing.push("Choose a Recorded Type of Transport Used.");
      if (checkerAccess.validity && !basis) missing.push("Choose a Validity Basis.");
      if (checkerAccess.validity && basis === "OutsideRegionInterIsland" && !outsideValidityDayOptions.includes(Number(outsideDays))) missing.push(`Choose ${outsideValidityDayOptions.join(", ")} days for Outside the Region / Inter-Island.`);
      if (missing.length > 0) {
        resetAutoResult();
        setAutoCheckStatus({ kind: "missing", message: missing.join(" ") });
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setAutoCheckStatus({ kind: "calculating", message: "Calculating PTT fee, validity, and vehicle capacity from the current form values..." });
      const data = new FormData(form);
      try {
        const response = await fetch("/api/ptt-checks/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: data.get("versionId"),
            volumeBoardFeet: data.get("volumeBoardFeet"),
            recordedFee: data.get("amountPaid"),
            recordedValidityDays: data.get("recordedValidityDays"),
            validityBasis: data.get("validityBasis"),
            outsideRegionValidityDays: data.get("outsideRegionValidityDays"),
            transportType: data.get("transportType"),
            checkFees: Boolean(checkerAccess.fees),
            checkValidity: Boolean(checkerAccess.validity),
            checkVehicle: Boolean(checkerAccess.vehicle)
          })
        });
        const result = await response.json() as { error?: string; fee?: FeePreview; validity?: ValidityPreview; vehicle?: VehiclePreview };
        if (requestIdRef.current !== requestId) return;
        if (!response.ok || result.error) throw new Error(result.error || "Could not calculate the PTT check.");
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
        if (result.vehicle) {
          setVehiclePreview(result.vehicle);
          setActualTransportCategory(result.vehicle.actualTransportCategory || "");
          setVehicleApplied(true);
        } else {
          setVehiclePreview(null);
          setActualTransportCategory(savedActualTransportCategory);
          setVehicleApplied(false);
        }
        setAutoCheckStatus({ kind: "ready", message: "Automatic PTT check is using the current form values." });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        resetAutoResult();
        setAutoCheckStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not calculate the PTT check." });
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
  }, [checkerAccess?.fees, checkerAccess?.validity, checkerAccess?.vehicle, outsideValidityDayOptions, savedActualTransportCategory]);

  function changeVersion(nextVersionId: string) {
    setVersionId(nextVersionId);
    const nextTypeNames = new Set(transportTypes.filter((type) => type.versionId === nextVersionId).map((type) => type.name));
    if (!transportIsOther && !nextTypeNames.has(transportType)) setTransportType("");
    const nextRule = normalizePttValidityRuleConfig(validityRules.find((rule) => rule.versionId === nextVersionId) || DEFAULT_PTT_VALIDITY_RULE_CONFIG);
    if (!pttOutsideRegionValidityDays(nextRule).includes(Number(outsideRegionValidityDays))) setOutsideRegionValidityDays("");
  }

  function changeRegionalOffice(nextRegionalOffice: string) {
    setRegionalOffice(nextRegionalOffice);
    const nextProvincialNames = new Set(officeChoices.find((office) => office.name === nextRegionalOffice)?.provincialOffices.map((office) => office.name) || []);
    if (!nextProvincialNames.has(provincialOffice)) setProvincialOffice("");
  }

  return (
    <>
      <div className="field">
        <label htmlFor="versionId">Version</label>
        <select id="versionId" name="versionId" value={versionId} onChange={(event) => changeVersion(event.target.value)}>
          {activeOptions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
        </select>
      </div>

      <section className="form-section">
        <h3>PTT Details</h3>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="dateIssued">Date Issued</label><input id="dateIssued" name="dateIssued" type="date" defaultValue={defaults?.dateIssued || ""} /></div>
          <div className="field"><label htmlFor="pttNumber">PTT Number</label><input id="pttNumber" name="pttNumber" defaultValue={defaults?.pttNumber || ""} /></div>
          <div className="field"><label htmlFor="regionalOffice">Regional Office</label><select id="regionalOffice" name="regionalOffice" value={regionalOffice} onChange={(event) => changeRegionalOffice(event.target.value)}><option value="">Choose regional office</option>{optionWithSavedValue(officeChoices.map((office) => office.name), defaults?.regionalOffice).map((office) => <option key={office} value={office}>{office}</option>)}</select></div>
          <div className="field"><label htmlFor="provincialOffice">Provincial Office</label><select id="provincialOffice" name="provincialOffice" value={provincialOffice} onChange={(event) => setProvincialOffice(event.target.value)}><option value="">Choose provincial office</option>{provincialOptions.map((office) => <option key={office} value={office}>{office}</option>)}</select></div>
          <div className="field"><label htmlFor="transporterAddress">Transporter Address</label><input id="transporterAddress" name="transporterAddress" defaultValue={defaults?.transporterAddress || ""} /></div>
          <div className="field"><label htmlFor="ptcNumber">PTC Number</label><input id="ptcNumber" name="ptcNumber" defaultValue={defaults?.ptcNumber || ""} /></div>
          <div className="field"><label htmlFor="pcaRegistrationCertificateNumber">PCA Registration Certificate Number</label><input id="pcaRegistrationCertificateNumber" name="pcaRegistrationCertificateNumber" defaultValue={defaults?.pcaRegistrationCertificateNumber || ""} /></div>
          <div className="field"><label htmlFor="pcaRegistrationCertificateDate">PCA Registration Certificate Date</label><input id="pcaRegistrationCertificateDate" name="pcaRegistrationCertificateDate" type="date" defaultValue={defaults?.pcaRegistrationCertificateDate || ""} /></div>
          <div className="field"><label htmlFor="businessAddress">Business Address</label><input id="businessAddress" name="businessAddress" defaultValue={defaults?.businessAddress || ""} /></div>
          <div className="field"><label htmlFor="boardFeetGranted">Board Feet Granted</label><NumericInput id="boardFeetGranted" name="boardFeetGranted" min="0" step="0.01" defaultValue={numberDefault(defaults?.boardFeetGranted)} /></div>
          <div className="field"><label htmlFor="certificateOfQuantityVolumeAttached">Certificate of Quantity/Volume Attached</label><select id="certificateOfQuantityVolumeAttached" name="certificateOfQuantityVolumeAttached" defaultValue={defaults?.certificateOfQuantityVolumeAttached === true ? "true" : defaults?.certificateOfQuantityVolumeAttached === false ? "false" : ""}><option value="">Blank</option><option value="true">Yes</option><option value="false">No</option></select></div>
          <div className="field"><label htmlFor="volumeBoardFeet">Volume of Lumber to be Transported</label><NumericInput id="volumeBoardFeet" name="volumeBoardFeet" min="0" step="0.01" defaultValue={numberDefault(defaults?.volumeBoardFeet)} /></div>
          <div className="field"><label htmlFor="originOfLumber">Origin of Lumber</label><input id="originOfLumber" name="originOfLumber" defaultValue={defaults?.originOfLumber || ""} /></div>
          <div className="field"><label htmlFor="destination">Destination/s</label><input id="destination" name="destination" defaultValue={defaults?.destination || ""} /></div>
          <div className="field"><label htmlFor="consigneeName">Consignee Name / Business Name</label><input id="consigneeName" name="consigneeName" defaultValue={defaults?.consigneeName || ""} /></div>
          <div className="field"><label htmlFor="consigneePcaRegistration">PCA Registration of Consignee</label><input id="consigneePcaRegistration" name="consigneePcaRegistration" defaultValue={defaults?.consigneePcaRegistration || ""} /></div>
          <div className="field"><label htmlFor="transportType">Recorded Type of Transport Used <FieldHelp label="Recorded transport guide" text="Recorded Type of Transport Used is the vehicle type written on the permit. Choose Others when the permit text is not available in the transport list." /></label>{transportIsOther ? <input id="transportType" name="transportType" value={customTransportType} onChange={(event) => setCustomTransportType(event.target.value)} placeholder="Enter recorded transport type" /> : <select id="transportType" name="transportType" value={transportType} onChange={(event) => setTransportType(event.target.value)}><option value="">Choose transport type</option>{transportTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>}<label className="checkbox-row"><input type="checkbox" checked={transportIsOther} onChange={(event) => { setTransportIsOther(event.target.checked); if (event.target.checked) setCustomTransportType(transportType); else setTransportType(""); }} /> Others</label></div>
          <div className="field"><label htmlFor="actualTransportCategoryDisplay">Actual Type of Transport Used <FieldHelp label="Actual transport guide" text="Actual Type of Transport Used is the minimum legal vehicle category selected automatically from the transported board feet volume." /></label><input id="actualTransportCategoryDisplay" value={actualTransportDisplay} readOnly placeholder="Auto selected from volume" /><input type="hidden" name="actualTransportCategory" value={actualTransportCategory} /></div>
          <div className="field"><label htmlFor="authorizedDriverName">Authorized Driver Name</label><input id="authorizedDriverName" name="authorizedDriverName" defaultValue={defaults?.authorizedDriverName || ""} /></div>
          <div className="field"><label htmlFor="vehiclePlateNumber">Plate / Container / Vessel Number</label><input id="vehiclePlateNumber" name="vehiclePlateNumber" defaultValue={defaults?.vehiclePlateNumber || ""} /></div>
          <div className="field"><label htmlFor="amountPaid">Recorded Fee <FieldHelp label="Recorded Fee guide" text="Recorded Fee is the amount written on the PTT. The checker compares this against Actual Fee but does not change what was recorded." /></label><NumericInput id="amountPaid" name="amountPaid" min="0" step="0.01" defaultValue={numberDefault(defaults?.amountPaid)} /></div>
          <div className="field"><label htmlFor="actualFee">Actual Fee <FieldHelp label="PTT fee formula" text="PTT Actual Fee = Volume of Lumber to be Transported x PHP 0.30 per board foot." /></label><NumericInput id="actualFee" name="actualFee" min="0" step="0.01" defaultValue={numberDefault(defaults?.actualFee)} readOnly={feeApplied} />{savedFeeWasCorrected ? <span className="warning-text">Saved value before auto-check: {formatSavedFee(defaults?.actualFee)}</span> : null}</div>
          <div className="field"><label htmlFor="officialReceiptNumber">Official Receipt Number</label><input id="officialReceiptNumber" name="officialReceiptNumber" defaultValue={defaults?.officialReceiptNumber || ""} /></div>
          <div className="field"><label htmlFor="validityBasis">Validity Basis</label><select id="validityBasis" name="validityBasis" value={validityBasis} onChange={(event) => setValidityBasis(event.target.value)}><option value="">Choose validity basis</option>{pttValidityBasisOptions(selectedValidityRule).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label htmlFor="recordedValidityDays">Recorded Validity <FieldHelp label="Recorded Validity guide" text="Recorded Validity is the number of days written on the PTT. The checker compares this against Actual Validity based on the selected validity basis." /></label><NumericInput id="recordedValidityDays" name="recordedValidityDays" min="0" step="1" defaultValue={numberDefault(defaults?.recordedValidityDays)} integer /></div>
          <div className="field"><label htmlFor="actualValidityDays">Actual Validity <FieldHelp label="PTT validity rules" text="PTT validity uses the selected basis: within municipality, province, region, or configured Outside Region / Inter-Island allowed days." /></label><NumericInput id="actualValidityDays" name="actualValidityDays" min="0" step="1" defaultValue={numberDefault(defaults?.actualValidityDays)} readOnly={validityApplied} integer /></div>
          {validityBasis === "OutsideRegionInterIsland" ? <div className="field full-width-field"><label htmlFor="outsideRegionValidityDays">Outside Region / Inter-Island Days</label><select id="outsideRegionValidityDays" name="outsideRegionValidityDays" value={outsideRegionValidityDays} onChange={(event) => setOutsideRegionValidityDays(event.target.value)}><option value="">Choose days</option>{outsideValidityDayOptions.map((days) => <option key={days} value={days}>{days} days</option>)}</select></div> : null}
          <div className="field"><label htmlFor="dateValidatedInspected">Date Validated/Inspected</label><input id="dateValidatedInspected" name="dateValidatedInspected" type="date" defaultValue={defaults?.dateValidatedInspected || ""} /></div>
          <div className="field"><label htmlFor="issuedByDate">Issued By Date</label><input id="issuedByDate" name="issuedByDate" type="date" defaultValue={defaults?.issuedByDate || ""} /></div>
          <div className="field"><label htmlFor="validatedInspectedBy">Validated/Inspected By</label><input id="validatedInspectedBy" name="validatedInspectedBy" defaultValue={defaults?.validatedInspectedBy || ""} /></div>
          <SignatureFieldGroup label="Validated/Inspected By Signature" statusName="validatedInspectedBySignatureStatus" forNameName="validatedInspectedBySignatureForName" defaultStatus={defaults?.validatedInspectedBySignatureStatus} defaultForName={defaults?.validatedInspectedBySignatureForName} fallbackLabel="Issued By" />
          <div className="field"><label htmlFor="issuedBy">Issued By</label><input id="issuedBy" name="issuedBy" defaultValue={defaults?.issuedBy || ""} /></div>
          <SignatureFieldGroup label="Issued By Signature" statusName="issuedBySignatureStatus" forNameName="issuedBySignatureForName" defaultStatus={defaults?.issuedBySignatureStatus} defaultForName={defaults?.issuedBySignatureForName} fallbackLabel="Validated/Inspected By" />
        </div>
        {checkerAccess?.fees || checkerAccess?.validity || checkerAccess?.vehicle ? <>
          <input type="hidden" name="applyPttFeeCheck" value={feeApplied ? "true" : "false"} />
          <input type="hidden" name="applyPttValidityCheck" value={validityApplied ? "true" : "false"} />
          <input type="hidden" name="applyPttVehicleCheck" value={vehicleApplied ? "true" : "false"} />
          <aside ref={autoCheckHostRef} className="form-section calculation-panel">
            <div className="section-heading-row"><div><h3>PTT Auto Check</h3><p className="muted">Automatically uses volume, recorded values, validity basis, and mapped transport capacity.</p></div></div>
            {autoCheckStatus.kind === "missing" || autoCheckStatus.kind === "error" ? <p className="error-text" role="alert">{autoCheckStatus.message}</p> : <p className={autoCheckStatus.kind === "ready" ? "success-text" : "muted"}>{autoCheckStatus.message}</p>}
            {feePreview ? <div className="calculation-result"><strong>Actual Fee: {feePreview.actualFee.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>{feePreview.volumeBoardFeet.toLocaleString("en-PH")} bd. ft. x PHP {feePreview.ratePerBoardFoot.toFixed(2)}</span>{feePreview.finding ? <p className="warning-text">{feePreview.finding}</p> : <p className="success-text">Fees match.</p>}</div> : null}
            {validityPreview ? <div className="calculation-result"><strong>Actual Validity: {validityPreview.actualValidityDays} day{validityPreview.actualValidityDays === 1 ? "" : "s"}</strong><span>{validityPreview.basisLabel || pttValidityBasisLabel(validityPreview.validityBasis, selectedValidityRule)}</span>{validityPreview.finding ? <p className="warning-text">{validityPreview.finding}</p> : <p className="success-text">Validity matches.</p>}</div> : null}
            {vehiclePreview ? <div className="calculation-result"><strong>Vehicle Capacity Check</strong><span>Actual type: {vehiclePreview.actualTransportLabel}</span>{vehiclePreview.maxBoardFeet === null ? <p className="warning-text">{vehiclePreview.warning}</p> : <span>Recorded limit: {vehiclePreview.maxBoardFeet.toLocaleString("en-PH")} bd. ft.</span>}{vehiclePreview.finding ? <p className="warning-text">{vehiclePreview.finding}</p> : vehiclePreview.maxBoardFeet !== null ? <p className="success-text">Recorded transport capacity covers the volume.</p> : null}</div> : null}
          </aside>
        </> : null}
      </section>
    </>
  );
}

export { PTT_VEHICLE_CAPACITY_OPTIONS, pttCapacityCategoryLabel };
