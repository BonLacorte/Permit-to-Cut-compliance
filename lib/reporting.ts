import { displayPtcField, feesMatchDisplay, formatDate, formatFee, displayReplantedSeedlings, formatSignedFeeDifference, formatValidityDays } from "@/lib/ptc";

export type AuditStatus = "Complete" | "Incomplete" | "Pending";
export type LocExemptionValue = "Owner" | "Others" | null | undefined;
export type DocumentRequirementMode = "Required" | "Optional" | "LocConditional";

export type RequiredDocumentRef = {
  id: string;
  name: string;
  versionId?: string | null;
  applicationTypeId: string;
  applicationTypeName: string;
  requirementMode?: DocumentRequirementMode;
};

export type RecordRef = {
  id: string;
  group?: string;
  versionId?: string | null;
  versionName?: string;
  applicantName: string;
  applicationTypeId: string | null;
  applicationTypeVersionId?: string | null;
  applicationTypeName: string;
  selectedDocumentIds: string[];
  remarks?: string;
  createdByName?: string;
  editedByName?: string;
  ptcNumber?: string | null;
  dateIssued?: Date | string | null;
  regionalOffice?: string | null;
  provincialOffice?: string | null;
  municipality?: string | null;
  barangay?: string | null;
  treesApplied?: number | null;
  treesApproved?: number | null;
  seedlingsReplacement?: number | null;
  recordedValidityDays?: number | null;
  actualValidityDays?: number | null;
  actualFee?: unknown;
  recordedFee?: unknown;
  officialReceiptNumber?: string | null;
  replantedSeedlings?: boolean | null;
  locExemption?: LocExemptionValue;
  recommendingApproval?: string | null;
  approved?: string | null;
  ptcNumberDuplicate?: boolean;
};

export type RecordAudit = RecordRef & {
  requiredCount: number;
  submittedCount: number;
  missingCount: number;
  status: AuditStatus;
  missingDocuments: RequiredDocumentRef[];
  selectedDocuments: RequiredDocumentRef[];
  needsVersionReview: boolean;
  versionReviewMessages: string[];
};

function requirementMode(doc: RequiredDocumentRef) {
  return doc.requirementMode || "Required";
}

export function isDocumentRequiredForRecord(doc: RequiredDocumentRef, record: Pick<RecordRef, "locExemption">) {
  const mode = requirementMode(doc);
  if (mode === "Optional") return false;
  if (mode === "LocConditional") return record.locExemption === "Others";
  return true;
}

export function versionReviewMessages(record: RecordRef, requiredDocuments: RequiredDocumentRef[]) {
  const messages: string[] = [];
  if (!record.versionId) return messages;

  if (!record.applicationTypeId) {
    messages.push("Version is assigned but Type of Application is blank.");
    return messages;
  }

  if (record.applicationTypeVersionId && record.applicationTypeVersionId !== record.versionId) {
    messages.push("Type of Application belongs to a different Version.");
  }

  const documentsForType = requiredDocuments.filter((doc) => doc.versionId === record.versionId && doc.applicationTypeId === record.applicationTypeId);
  const allowedDocumentIds = new Set(documentsForType.map((doc) => doc.id));
  const invalidDocumentCount = record.selectedDocumentIds.filter((documentId) => !allowedDocumentIds.has(documentId)).length;
  if (invalidDocumentCount > 0) {
    messages.push(`${invalidDocumentCount} submitted document${invalidDocumentCount === 1 ? "" : "s"} do not belong to the assigned Version and Type of Application.`);
  }

  return messages;
}

export function auditRecord(record: RecordRef, requiredDocuments: RequiredDocumentRef[]): RecordAudit {
  const reviewMessages = versionReviewMessages(record, requiredDocuments);
  const reviewBase = {
    needsVersionReview: reviewMessages.length > 0,
    versionReviewMessages: reviewMessages
  };

  if (!record.versionId || !record.applicationTypeId || record.applicationTypeVersionId && record.applicationTypeVersionId !== record.versionId) {
    return {
      ...record,
      requiredCount: 0,
      submittedCount: 0,
      missingCount: 0,
      status: "Pending",
      missingDocuments: [],
      selectedDocuments: [],
      ...reviewBase
    };
  }

  const documentsForType = requiredDocuments.filter((doc) => doc.versionId === record.versionId && doc.applicationTypeId === record.applicationTypeId);
  const requiredForType = documentsForType.filter((doc) => isDocumentRequiredForRecord(doc, record));
  const selected = new Set(record.selectedDocumentIds);
  const selectedDocuments = documentsForType.filter((doc) => selected.has(doc.id));
  const submittedRequiredDocuments = requiredForType.filter((doc) => selected.has(doc.id));
  const missingDocuments = requiredForType.filter((doc) => !selected.has(doc.id));

  return {
    ...record,
    requiredCount: requiredForType.length,
    submittedCount: submittedRequiredDocuments.length,
    missingCount: missingDocuments.length,
    status: missingDocuments.length === 0 ? "Complete" : "Incomplete",
    missingDocuments,
    selectedDocuments,
    ...reviewBase
  };
}

export function auditRecords(records: RecordRef[], requiredDocuments: RequiredDocumentRef[]) {
  return records.map((record) => auditRecord(record, requiredDocuments));
}

export function completionSummary(audits: RecordAudit[]) {
  const complete = audits.filter((audit) => audit.status === "Complete").length;
  const incomplete = audits.filter((audit) => audit.status === "Incomplete").length;
  const pending = audits.filter((audit) => audit.status === "Pending").length;
  const total = complete + incomplete + pending;
  return {
    complete,
    incomplete,
    pending,
    total,
    completionRate: total === 0 ? 0 : complete / total
  };
}

export function applicationSummary(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]) {
  const countedDocuments = requiredDocuments.filter((doc) => requirementMode(doc) !== "Optional");
  const applicationNames = Array.from(new Map([...countedDocuments.map((doc) => [doc.applicationTypeId, doc.applicationTypeName] as const), ...audits.filter((audit) => audit.applicationTypeId).map((audit) => [audit.applicationTypeId!, audit.applicationTypeName] as const)]));
  const summaries = applicationNames.map(([applicationTypeId, applicationTypeName]) => {
    const scoped = audits.filter((audit) => audit.applicationTypeId === applicationTypeId);
    const complete = scoped.filter((audit) => audit.status === "Complete").length;
    const incomplete = scoped.filter((audit) => audit.status === "Incomplete").length;
    const pending = scoped.filter((audit) => audit.status === "Pending").length;
    return {
      applicationTypeId,
      applicationTypeName,
      totalRecords: scoped.length,
      completeRecords: complete,
      incompleteRecords: incomplete,
      pendingRecords: pending,
      completionRate: scoped.length === 0 ? 0 : complete / scoped.length,
      requiredDocumentCount: countedDocuments.filter((doc) => doc.applicationTypeId === applicationTypeId).length,
      missingDocumentInstances: scoped.reduce((sum, audit) => sum + audit.missingCount, 0)
    };
  });

  const pending = audits.filter((audit) => !audit.applicationTypeId);
  if (pending.length > 0) {
    summaries.unshift({
      applicationTypeId: "",
      applicationTypeName: "Pending",
      totalRecords: pending.length,
      completeRecords: 0,
      incompleteRecords: 0,
      pendingRecords: pending.length,
      completionRate: 0,
      requiredDocumentCount: 0,
      missingDocumentInstances: 0
    });
  }

  return summaries;
}

export function documentSummary(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]) {
  return requiredDocuments.filter((doc) => requirementMode(doc) !== "Optional").map((doc) => {
    const scoped = audits.filter((audit) => audit.applicationTypeId === doc.applicationTypeId && isDocumentRequiredForRecord(doc, audit));
    const submittedCount = scoped.filter((audit) => audit.selectedDocumentIds.includes(doc.id)).length;
    const missingCount = scoped.length - submittedCount;
    return {
      applicationTypeId: doc.applicationTypeId,
      applicationTypeName: doc.applicationTypeName,
      requiredDocumentId: doc.id,
      requiredDocumentName: doc.name,
      applicationRecords: scoped.length,
      submittedCount,
      missingCount,
      submittedRate: scoped.length === 0 ? 0 : submittedCount / scoped.length,
      missingRate: scoped.length === 0 ? 0 : missingCount / scoped.length
    };
  });
}

export function documentCombinations(audits: RecordAudit[]) {
  const counts = new Map<string, { applicationTypeName: string; combination: string; documents: string[]; size: number; count: number; appTotal: number }>();
  const totals = new Map<string, number>();

  for (const audit of audits) {
    totals.set(audit.applicationTypeName, (totals.get(audit.applicationTypeName) || 0) + 1);
  }

  for (const audit of audits) {
    const names = audit.selectedDocuments.map((doc) => doc.name).sort();
    const combination = names.length ? names.join(", ") : "No documents selected";
    const key = `${audit.applicationTypeName}::${combination}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, {
        applicationTypeName: audit.applicationTypeName,
        combination,
        documents: names,
        size: names.length,
        count: 1,
        appTotal: totals.get(audit.applicationTypeName) || 0
      });
    }
  }

  return Array.from(counts.values())
    .map((row) => ({ ...row, share: row.appTotal === 0 ? 0 : row.count / row.appTotal }))
    .sort((a, b) => a.applicationTypeName.localeCompare(b.applicationTypeName) || b.count - a.count);
}

export function applicationExportRows(audits: RecordAudit[]) {
  return audits.map((audit) => ({
    "Date Issued": formatDate(audit.dateIssued),
    "Recorded Validity": formatValidityDays(audit.recordedValidityDays),
    "Actual Validity": formatValidityDays(audit.actualValidityDays),
    "PTC Number": audit.ptcNumber || "",
    "Duplicate PTC Number": audit.ptcNumberDuplicate ? "Yes" : "No",
    "Name of Applicant": audit.applicantName,
    "Version": audit.versionName || "Uncategorized",
    "Needs Version Review": audit.needsVersionReview ? "Yes" : "No",
    "Version Review Notes": audit.versionReviewMessages.join(" "),
    "Regional Office": displayPtcField(audit, "regionalOffice"),
    "Provincial Office": displayPtcField(audit, "provincialOffice"),
    Barangay: displayPtcField(audit, "barangay"),
    Municipality: displayPtcField(audit, "municipality"),
    "Type of application": audit.applicationTypeName,
    "LOC Exemption": audit.locExemption || "",
    "Selected Documents": audit.selectedDocuments.map((doc) => doc.name).join(", "),
    Submitted: audit.submittedCount,
    Missing: audit.missingCount,
    "Actual Fee": formatFee(audit.actualFee),
    "Recorded Fee": formatFee(audit.recordedFee),
    "Official Receipt No.": audit.officialReceiptNumber || "",
    "Fee Difference": formatSignedFeeDifference(audit),
    "Fees Match": feesMatchDisplay(audit),
    "Replanted Seedlings": displayReplantedSeedlings(audit.replantedSeedlings),
    "Recommending Approval": audit.recommendingApproval || "",
    Approved: audit.approved || "",
    Status: audit.status,
    Remarks: audit.remarks || "",
    "Edited By": audit.editedByName || ""
  }));
}