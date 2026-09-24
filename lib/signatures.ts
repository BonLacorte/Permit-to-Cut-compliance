export type SignatureStatusValue = "Signed" | "Blank" | "For";

export const SIGNATURE_STATUS_VALUES: SignatureStatusValue[] = ["Signed", "Blank", "For"];

export function normalizeSignatureStatus(value: unknown): SignatureStatusValue {
  return value === "Blank" || value === "For" ? value : "Signed";
}
export function signatureStatusLabel(value: unknown) {
  return normalizeSignatureStatus(value);
}

function cleanName(value: unknown) {
  return String(value || "").trim();
}

function signatureRemark(fieldLabel: string, status: unknown, forName: unknown, fallbackName: unknown) {
  const normalized = normalizeSignatureStatus(status);
  if (normalized === "Signed") return null;
  if (normalized === "Blank") return `There's no signature in ${fieldLabel} field.`;
  const signer = cleanName(forName) || cleanName(fallbackName) || "Blank";
  return `The signature in ${fieldLabel} field was signed ‘For’ by ${signer} on behalf of the authorized signatory.`;
}

export type PtcSignatureSource = {
  recommendingApproval?: string | null;
  recommendingApprovalSignatureStatus?: string | null;
  recommendingApprovalSignatureForName?: string | null;
  approved?: string | null;
  approvedSignatureStatus?: string | null;
  approvedSignatureForName?: string | null;
};

export type PttSignatureSource = {
  validatedInspectedBy?: string | null;
  validatedInspectedBySignatureStatus?: string | null;
  validatedInspectedBySignatureForName?: string | null;
  issuedBy?: string | null;
  issuedBySignatureStatus?: string | null;
  issuedBySignatureForName?: string | null;
};

export function ptcSignatureMessages(record: PtcSignatureSource) {
  return [
    signatureRemark("Recommending Approval", record.recommendingApprovalSignatureStatus, record.recommendingApprovalSignatureForName, record.approved),
    signatureRemark("Approved", record.approvedSignatureStatus, record.approvedSignatureForName, record.recommendingApproval)
  ].filter((message): message is string => Boolean(message));
}

export function pttSignatureMessages(record: PttSignatureSource) {
  return [
    signatureRemark("Validated/Inspected By", record.validatedInspectedBySignatureStatus, record.validatedInspectedBySignatureForName, record.issuedBy),
    signatureRemark("Issued By", record.issuedBySignatureStatus, record.issuedBySignatureForName, record.validatedInspectedBy)
  ].filter((message): message is string => Boolean(message));
}

export function ptcSignatureFinding(record: PtcSignatureSource) {
  const messages = ptcSignatureMessages(record);
  return messages.length > 0 ? messages.join("\n") : null;
}

export function pttSignatureFinding(record: PttSignatureSource) {
  const messages = pttSignatureMessages(record);
  return messages.length > 0 ? messages.join("\n") : null;
}

