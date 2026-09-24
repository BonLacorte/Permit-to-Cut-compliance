import { prisma } from "@/lib/prisma";
import { mergeRemarks } from "@/lib/ptc-checks";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { auditRecords, applicationSummary, completionSummary, documentCombinations, documentSummary } from "@/lib/reporting";
import type { VersionScopedOptions } from "@/lib/data/master-data";

export async function getReportData(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTC;
  const versionId = options.versionId;
  const selectedVersion = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group } }) : null;
  const selectedVersionIsArchived = !!selectedVersion && !selectedVersion.active;
  const recordWhere = { group, ...(versionId !== undefined ? { versionId } : {}) };
  const documentWhere = versionId === null ? null : {
    ...(selectedVersionIsArchived ? {} : { active: true }),
    applicationType: { group, ...(selectedVersionIsArchived ? {} : { active: true }), ...(versionId !== undefined ? { versionId } : { version: { active: true } }) }
  };
  const [documents, records] = await Promise.all([
    documentWhere ? prisma.requiredDocument.findMany({
      where: documentWhere,
      include: { applicationType: true },
      orderBy: [{ applicationType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    }) : Promise.resolve([]),
    prisma.applicationRecord.findMany({
      where: recordWhere,
      include: {
        version: true,
        applicationType: true,
        createdBy: true,
        editedBy: true,
        checkFindings: { where: { active: true }, select: { message: true } },
        progressDocuments: { include: { requiredDocument: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);
  const duplicatePtcNumbers = new Set(Array.from(records.reduce((map, record) => {
    const ptcNumber = String(record.ptcNumber || "").trim();
    if (!ptcNumber) return map;
    map.set(ptcNumber, (map.get(ptcNumber) || 0) + 1);
    return map;
  }, new Map<string, number>())).filter(([, count]) => count > 1).map(([ptcNumber]) => ptcNumber));
  const requiredDocuments = documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    versionId: doc.applicationType.versionId,
    applicationTypeId: doc.applicationTypeId,
    applicationTypeName: doc.applicationType.name,
    requirementMode: doc.requirementMode
  }));
  const recordRefs = records.map((record) => ({
    id: record.id,
    group: record.group,
    versionId: record.versionId,
    versionName: record.version?.name || "Uncategorized",
    applicantName: record.applicantName || "",
    applicationTypeId: record.versionId ? record.applicationTypeId : null,
    applicationTypeVersionId: record.applicationType?.versionId || null,
    applicationTypeName: record.versionId ? record.applicationType?.name || "Pending" : "Pending",
    selectedDocumentIds: record.progressDocuments.map((doc) => doc.requiredDocumentId),
    manualRemarks: record.remarks || "",
    remarks: mergeRemarks(record.remarks, record.checkFindings.map((finding) => finding.message)),
    createdByName: record.createdBy.name,
    createdAt: record.createdAt,
    editedByName: record.editedBy?.name || "",
    updatedAt: record.updatedAt,
    ptcNumber: record.ptcNumber,
    dateIssued: record.dateIssued,
    regionalOffice: record.regionalOffice,
    provincialOffice: record.provincialOffice,
    municipality: record.municipality,
    barangay: record.barangay,
    treesApplied: record.treesApplied,
    treesApproved: record.treesApproved,
    seedlingsReplacement: record.seedlingsReplacement,
    recordedValidityDays: record.recordedValidityDays,
    actualValidityDays: record.actualValidityDays,
    actualFee: record.actualFee,
    recordedFee: record.recordedFee,
    officialReceiptNumber: record.officialReceiptNumber,
    replantedSeedlings: record.replantedSeedlings,
    locExemption: record.locExemption,
    agriculturist: record.agriculturist,
    recommendingApproval: record.recommendingApproval,
    recommendingApprovalSignatureStatus: record.recommendingApprovalSignatureStatus,
    recommendingApprovalSignatureForName: record.recommendingApprovalSignatureForName,
    approved: record.approved,
    approvedSignatureStatus: record.approvedSignatureStatus,
    approvedSignatureForName: record.approvedSignatureForName,
    ptcNumberDuplicate: !!record.ptcNumber && duplicatePtcNumbers.has(record.ptcNumber)
  }));
  const audits = auditRecords(recordRefs, requiredDocuments);
  return {
    audits,
    requiredDocuments,
    completion: completionSummary(audits),
    applications: applicationSummary(audits, requiredDocuments),
    documents: documentSummary(audits, requiredDocuments),
    combinations: documentCombinations(audits)
  };
}
