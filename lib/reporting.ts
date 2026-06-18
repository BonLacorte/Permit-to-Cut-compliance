import { displayPtcField, formatDate } from "@/lib/ptc";

export type RequiredDocumentRef = {
  id: string;
  name: string;
  applicationTypeId: string;
  applicationTypeName: string;
};

export type RecordRef = {
  id: string;
  group?: string;
  applicantName: string;
  applicationTypeId: string | null;
  applicationTypeName: string;
  selectedDocumentIds: string[];
  remarks?: string;
  createdByName?: string;
  ptcNumber?: string | null;
  dateIssued?: Date | string | null;
  regionalOffice?: string | null;
  provincialOffice?: string | null;
  municipality?: string | null;
  barangay?: string | null;
  treesApplied?: number | null;
  treesApproved?: number | null;
  seedlingsReplacement?: number | null;
  ptcNumberDuplicate?: boolean;
};

export type RecordAudit = RecordRef & {
  requiredCount: number;
  submittedCount: number;
  missingCount: number;
  status: "Complete" | "Incomplete";
  missingDocuments: RequiredDocumentRef[];
  selectedDocuments: RequiredDocumentRef[];
};

export function auditRecord(record: RecordRef, requiredDocuments: RequiredDocumentRef[]): RecordAudit {
  if (!record.applicationTypeId) {
    return {
      ...record,
      requiredCount: 0,
      submittedCount: 0,
      missingCount: 0,
      status: "Incomplete",
      missingDocuments: [],
      selectedDocuments: []
    };
  }

  const requiredForType = requiredDocuments.filter((doc) => doc.applicationTypeId === record.applicationTypeId);
  const selected = new Set(record.selectedDocumentIds);
  const selectedDocuments = requiredForType.filter((doc) => selected.has(doc.id));
  const missingDocuments = requiredForType.filter((doc) => !selected.has(doc.id));

  return {
    ...record,
    requiredCount: requiredForType.length,
    submittedCount: selectedDocuments.length,
    missingCount: missingDocuments.length,
    status: missingDocuments.length === 0 ? "Complete" : "Incomplete",
    missingDocuments,
    selectedDocuments
  };
}

export function auditRecords(records: RecordRef[], requiredDocuments: RequiredDocumentRef[]) {
  return records.map((record) => auditRecord(record, requiredDocuments));
}

export function completionSummary(audits: RecordAudit[]) {
  const complete = audits.filter((audit) => audit.status === "Complete").length;
  const incomplete = audits.filter((audit) => audit.status === "Incomplete").length;
  const total = complete + incomplete;
  return {
    complete,
    incomplete,
    total,
    completionRate: total === 0 ? 0 : complete / total
  };
}

export function applicationSummary(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]) {
  const applicationNames = Array.from(new Map(requiredDocuments.map((doc) => [doc.applicationTypeId, doc.applicationTypeName])));
  const summaries = applicationNames.map(([applicationTypeId, applicationTypeName]) => {
    const scoped = audits.filter((audit) => audit.applicationTypeId === applicationTypeId);
    const complete = scoped.filter((audit) => audit.status === "Complete").length;
    const incomplete = scoped.length - complete;
    return {
      applicationTypeId,
      applicationTypeName,
      totalRecords: scoped.length,
      completeRecords: complete,
      incompleteRecords: incomplete,
      completionRate: scoped.length === 0 ? 0 : complete / scoped.length,
      requiredDocumentCount: requiredDocuments.filter((doc) => doc.applicationTypeId === applicationTypeId).length,
      missingDocumentInstances: scoped.reduce((sum, audit) => sum + audit.missingCount, 0)
    };
  });

  const unclassified = audits.filter((audit) => !audit.applicationTypeId);
  if (unclassified.length > 0) {
    summaries.unshift({
      applicationTypeId: "",
      applicationTypeName: "Unclassified",
      totalRecords: unclassified.length,
      completeRecords: 0,
      incompleteRecords: unclassified.length,
      completionRate: 0,
      requiredDocumentCount: 0,
      missingDocumentInstances: 0
    });
  }

  return summaries;
}

export function documentSummary(audits: RecordAudit[], requiredDocuments: RequiredDocumentRef[]) {
  return requiredDocuments.map((doc) => {
    const scoped = audits.filter((audit) => audit.applicationTypeId === doc.applicationTypeId);
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
    "PTC Number": audit.ptcNumber || "",
    "Duplicate PTC Number": audit.ptcNumberDuplicate ? "Yes" : "No",
    "Name of Applicant": audit.applicantName,
    "Type of application": audit.applicationTypeName,
    "Regional Office": displayPtcField(audit, "regionalOffice"),
    "Provincial Office": displayPtcField(audit, "provincialOffice"),
    Barangay: displayPtcField(audit, "barangay"),
    Municipality: displayPtcField(audit, "municipality"),
    "No. of trees applied": displayPtcField(audit, "treesApplied"),
    "No. of trees approved": displayPtcField(audit, "treesApproved"),
    "No. of Seedlings Replacement": displayPtcField(audit, "seedlingsReplacement"),
    "Selected Documents": audit.selectedDocuments.map((doc) => doc.name).join(", "),
    "Missing Count": audit.missingCount,
    "Missing Documents": audit.missingDocuments.map((doc) => doc.name).join(", "),
    Status: audit.status
  }));
}