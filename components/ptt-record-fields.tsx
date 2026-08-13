"use client";

import { useMemo, useState } from "react";
import type { VersionOption } from "@/components/document-picker";
import type { OfficeChoice } from "@/lib/ptc";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

export type PttTransportTypeOption = {
  id: string;
  versionId: string;
  name: string;
  active?: boolean;
};

type PttRecordFieldsProps = {
  versionOptions: VersionOption[];
  officeChoices: OfficeChoice[];
  transportTypes: PttTransportTypeOption[];
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
    vehiclePlateNumber?: string | null;
    authorizedDriverName?: string | null;
    authorizedDriverContact?: string | null;
    amountPaid?: string | number | null;
    officialReceiptNumber?: string | null;
    validUntil?: string | null;
    dateValidatedInspected?: string | null;
    validatedInspectedBy?: string | null;
    issuedBy?: string | null;
  };
};

function numberDefault(value?: string | number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function optionWithSavedValue(options: string[], savedValue?: string | null) {
  const saved = String(savedValue || "").trim();
  if (!saved || options.includes(saved)) return options;
  return [saved, ...options];
}

export function PttRecordFields({ defaults, officeChoices, transportTypes, versionOptions }: PttRecordFieldsProps) {
  const activeOptions = versionOptions.filter((version) => version.id === UNCATEGORIZED_VERSION || version.active !== false);
  const [versionId, setVersionId] = useState(defaults?.versionId || UNCATEGORIZED_VERSION);
  const [regionalOffice, setRegionalOffice] = useState(defaults?.regionalOffice || "");
  const [provincialOffice, setProvincialOffice] = useState(defaults?.provincialOffice || "");
  const [transportType, setTransportType] = useState(defaults?.transportType || "");

  const provincialOffices = useMemo(
    () => officeChoices.find((office) => office.name === regionalOffice)?.provincialOffices.map((office) => office.name) || [],
    [officeChoices, regionalOffice]
  );
  const provincialOptions = optionWithSavedValue(provincialOffices, defaults?.provincialOffice);
  const transportTypeOptions = optionWithSavedValue(
    transportTypes.filter((type) => type.versionId === versionId).map((type) => type.name),
    defaults?.transportType
  );

  function changeVersion(nextVersionId: string) {
    setVersionId(nextVersionId);
    const nextTypeNames = new Set(transportTypes.filter((type) => type.versionId === nextVersionId).map((type) => type.name));
    if (!nextTypeNames.has(transportType)) setTransportType("");
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
          <div className="field">
            <label htmlFor="dateIssued">Date Issued</label>
            <input id="dateIssued" name="dateIssued" type="date" defaultValue={defaults?.dateIssued || ""} />
          </div>
          <div className="field">
            <label htmlFor="pttNumber">PTT Number</label>
            <input id="pttNumber" name="pttNumber" defaultValue={defaults?.pttNumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="regionalOffice">Regional Office</label>
            <select id="regionalOffice" name="regionalOffice" value={regionalOffice} onChange={(event) => changeRegionalOffice(event.target.value)}>
              <option value="">Choose regional office</option>
              {optionWithSavedValue(officeChoices.map((office) => office.name), defaults?.regionalOffice).map((office) => <option key={office} value={office}>{office}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="provincialOffice">Provincial Office</label>
            <select id="provincialOffice" name="provincialOffice" value={provincialOffice} onChange={(event) => setProvincialOffice(event.target.value)}>
              <option value="">Choose provincial office</option>
              {provincialOptions.map((office) => <option key={office} value={office}>{office}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="transporterAddress">Transporter Address</label>
            <input id="transporterAddress" name="transporterAddress" defaultValue={defaults?.transporterAddress || ""} />
          </div>
          <div className="field">
            <label htmlFor="ptcNumber">PTC Number</label>
            <input id="ptcNumber" name="ptcNumber" defaultValue={defaults?.ptcNumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="pcaRegistrationCertificateNumber">PCA Registration Certificate Number</label>
            <input id="pcaRegistrationCertificateNumber" name="pcaRegistrationCertificateNumber" defaultValue={defaults?.pcaRegistrationCertificateNumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="pcaRegistrationCertificateDate">PCA Registration Certificate Date</label>
            <input id="pcaRegistrationCertificateDate" name="pcaRegistrationCertificateDate" type="date" defaultValue={defaults?.pcaRegistrationCertificateDate || ""} />
          </div>
          <div className="field">
            <label htmlFor="businessAddress">Business Address</label>
            <input id="businessAddress" name="businessAddress" defaultValue={defaults?.businessAddress || ""} />
          </div>
          <div className="field">
            <label htmlFor="boardFeetGranted">Board Feet Granted</label>
            <input id="boardFeetGranted" name="boardFeetGranted" type="number" min="0" step="0.01" defaultValue={numberDefault(defaults?.boardFeetGranted)} />
          </div>
          <div className="field">
            <label htmlFor="certificateOfQuantityVolumeAttached">Certificate of Quantity/Volume Attached</label>
            <select id="certificateOfQuantityVolumeAttached" name="certificateOfQuantityVolumeAttached" defaultValue={defaults?.certificateOfQuantityVolumeAttached === true ? "true" : defaults?.certificateOfQuantityVolumeAttached === false ? "false" : ""}>
              <option value="">Blank</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="volumeBoardFeet">Volume of Lumber to be Transported</label>
            <input id="volumeBoardFeet" name="volumeBoardFeet" type="number" min="0" step="0.01" defaultValue={numberDefault(defaults?.volumeBoardFeet)} />
          </div>
          <div className="field">
            <label htmlFor="originOfLumber">Origin of Lumber</label>
            <input id="originOfLumber" name="originOfLumber" defaultValue={defaults?.originOfLumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="destination">Destination/s</label>
            <input id="destination" name="destination" defaultValue={defaults?.destination || ""} />
          </div>
          <div className="field">
            <label htmlFor="consigneeName">Consignee Name / Business Name</label>
            <input id="consigneeName" name="consigneeName" defaultValue={defaults?.consigneeName || ""} />
          </div>
          <div className="field">
            <label htmlFor="consigneePcaRegistration">PCA Registration of Consignee</label>
            <input id="consigneePcaRegistration" name="consigneePcaRegistration" defaultValue={defaults?.consigneePcaRegistration || ""} />
          </div>
          <div className="field">
            <label htmlFor="transportType">Type of Transport Used</label>
            <select id="transportType" name="transportType" value={transportType} onChange={(event) => setTransportType(event.target.value)}>
              <option value="">Choose transport type</option>
              {transportTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vehiclePlateNumber">Plate / Container / Vessel Number</label>
            <input id="vehiclePlateNumber" name="vehiclePlateNumber" defaultValue={defaults?.vehiclePlateNumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="authorizedDriverName">Authorized Driver Name</label>
            <input id="authorizedDriverName" name="authorizedDriverName" defaultValue={defaults?.authorizedDriverName || ""} />
          </div>
          <div className="field">
            <label htmlFor="authorizedDriverContact">Authorized Driver Contact</label>
            <input id="authorizedDriverContact" name="authorizedDriverContact" defaultValue={defaults?.authorizedDriverContact || ""} />
          </div>
          <div className="field">
            <label htmlFor="amountPaid">Amount Paid</label>
            <input id="amountPaid" name="amountPaid" type="number" min="0" step="0.01" defaultValue={numberDefault(defaults?.amountPaid)} />
          </div>
          <div className="field">
            <label htmlFor="officialReceiptNumber">Official Receipt Number</label>
            <input id="officialReceiptNumber" name="officialReceiptNumber" defaultValue={defaults?.officialReceiptNumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="validUntil">Valid Until</label>
            <input id="validUntil" name="validUntil" type="date" defaultValue={defaults?.validUntil || ""} />
          </div>
          <div className="field">
            <label htmlFor="dateValidatedInspected">Date Validated/Inspected</label>
            <input id="dateValidatedInspected" name="dateValidatedInspected" type="date" defaultValue={defaults?.dateValidatedInspected || ""} />
          </div>
          <div className="field">
            <label htmlFor="validatedInspectedBy">Validated/Inspected By</label>
            <input id="validatedInspectedBy" name="validatedInspectedBy" defaultValue={defaults?.validatedInspectedBy || ""} />
          </div>
          <div className="field">
            <label htmlFor="issuedBy">Issued By</label>
            <input id="issuedBy" name="issuedBy" defaultValue={defaults?.issuedBy || ""} />
          </div>
        </div>
      </section>
    </>
  );
}
