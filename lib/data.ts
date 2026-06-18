import { prisma } from "@/lib/prisma";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import {
  auditRecords,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentSummary
} from "@/lib/reporting";

export async function getApplicationTypesWithDocuments(group = PERMIT_GROUP_PTC) {
  return prisma.applicationType.findMany({
    where: { active: true, group },
    include: { documents: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getReportData(group = PERMIT_GROUP_PTC) {
  const [documents, records] = await Promise.all([
    prisma.requiredDocument.findMany({
      where: { active: true, applicationType: { active: true, group } },
      include: { applicationType: true },
      orderBy: [{ applicationType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.applicationRecord.findMany({
      where: { group },
      include: {
        applicationType: true,
        createdBy: true,
        progressDocuments: { include: { requiredDocument: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const duplicatePtcNumbers = new Set(
    Array.from(
      records.reduce((map, record) => {
        const ptcNumber = String(record.ptcNumber || "").trim();
        if (!ptcNumber) return map;
        map.set(ptcNumber, (map.get(ptcNumber) || 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .filter(([, count]) => count > 1)
      .map(([ptcNumber]) => ptcNumber)
  );

  const requiredDocuments = documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    applicationTypeId: doc.applicationTypeId,
    applicationTypeName: doc.applicationType.name
  }));

  const recordRefs = records.map((record) => ({
    id: record.id,
    group: record.group,
    applicantName: record.applicantName || "",
    applicationTypeId: record.applicationTypeId,
    applicationTypeName: record.applicationType?.name || "Unclassified",
    selectedDocumentIds: record.progressDocuments.map((doc) => doc.requiredDocumentId),
    remarks: record.remarks || "",
    createdByName: record.createdBy.name,
    ptcNumber: record.ptcNumber,
    dateIssued: record.dateIssued,
    regionalOffice: record.regionalOffice,
    provincialOffice: record.provincialOffice,
    municipality: record.municipality,
    barangay: record.barangay,
    treesApplied: record.treesApplied,
    treesApproved: record.treesApproved,
    seedlingsReplacement: record.seedlingsReplacement,
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
