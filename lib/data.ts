import { prisma } from "@/lib/prisma";
import {
  auditRecords,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentSummary
} from "@/lib/reporting";

export async function getApplicationTypesWithDocuments() {
  return prisma.applicationType.findMany({
    where: { active: true },
    include: { documents: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getReportData() {
  const [documents, records] = await Promise.all([
    prisma.requiredDocument.findMany({
      where: { active: true, applicationType: { active: true } },
      include: { applicationType: true },
      orderBy: [{ applicationType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.applicationRecord.findMany({
      include: {
        applicationType: true,
        createdBy: true,
        progressDocuments: { include: { requiredDocument: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const requiredDocuments = documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    applicationTypeId: doc.applicationTypeId,
    applicationTypeName: doc.applicationType.name
  }));

  const recordRefs = records.map((record) => ({
    id: record.id,
    applicantName: record.applicantName,
    applicationTypeId: record.applicationTypeId,
    applicationTypeName: record.applicationType.name,
    selectedDocumentIds: record.progressDocuments.map((doc) => doc.requiredDocumentId),
    remarks: record.remarks || "",
    createdByName: record.createdBy.name
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
