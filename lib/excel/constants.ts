export type ParsedPtcRecord = {
  regionalOffice?: string;
  provincialOffice?: string;
  ptcNumber?: string;
  dateIssued?: Date;
  applicantName?: string;
  barangay?: string;
  municipality?: string;
  treesApplied?: number;
  treesApproved?: number;
  seedlingsReplacement?: number;
  applicationTypeName?: string;
  locExemption?: "Owner" | "Others";
};

export const PTC_IMPORT_COLUMNS = [
  "Regional Office", "Provincial Office", "PTC Number", "Date Issued", "Name of Applicant", "Barangay", "Municipality",
  "No. of trees applied", "No. of trees approved", "No. of Seedlings Replacement", "Type of Application", "LOC Exemption"
] as const;

export const PTT_IMPORT_COLUMNS = [
  "Regional Office", "Provincial Office", "PTT Number", "Date Issued", "Name", "Transporter Address", "PTC Number",
  "PCA Registration Certificate Number", "PCA Registration Certificate Date", "Business Address", "Board Feet Granted",
  "Certificate of Quantity/Volume Attached", "Volume", "Origin", "Destination", "Consignee Name", "Consignee PCA Registration",
  "Type of Transport Used", "Plate/Container/Vessel Number", "Authorized Driver Name", "Authorized Driver Contact", "Recorded Fee",
  "Actual Fee", "OR Number", "Validity Basis", "Recorded Validity", "Actual Validity", "Date Validated/Inspected",
  "Validated/Inspected By", "Issued By Date", "Issued By", "Remarks"
] as const;

export type ParsedPttRecord = {
  regionalOffice?: string;
  provincialOffice?: string;
  pttNumber?: string;
  dateIssued?: Date;
  transporterName?: string;
  transporterAddress?: string;
  ptcNumber?: string;
  pcaRegistrationCertificateNumber?: string;
  pcaRegistrationCertificateDate?: Date;
  businessAddress?: string;
  boardFeetGranted?: string;
  certificateOfQuantityVolumeAttached?: boolean;
  volumeBoardFeet?: string;
  originOfLumber?: string;
  destination?: string;
  consigneeName?: string;
  consigneePcaRegistration?: string;
  transportType?: string;
  vehiclePlateNumber?: string;
  authorizedDriverName?: string;
  authorizedDriverContact?: string;
  amountPaid?: string;
  actualFee?: string;
  officialReceiptNumber?: string;
  recordedValidityDays?: number;
  actualValidityDays?: number;
  validityBasis?: "WithinMunicipality" | "WithinProvince" | "WithinRegion" | "OutsideRegionInterIsland";
  dateValidatedInspected?: Date;
  validatedInspectedBy?: string;
  issuedByDate?: Date;
  issuedBy?: string;
  remarks?: string;
};
