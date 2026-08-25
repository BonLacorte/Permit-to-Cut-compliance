import { prisma } from "@/lib/prisma";
import { mergeRemarks } from "@/lib/ptc-checks";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import {
  auditRecords,
  applicationSummary,
  completionSummary,
  documentCombinations,
  documentSummary
} from "@/lib/reporting";

import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

type VersionScopedOptions = {
  group?: string;
  versionId?: string | null;
};

function firstParam(value?: string | string[] | null) {
  return Array.isArray(value) ? value[0] : value || undefined;
}

export function versionQueryValue(versionId: string | null) {
  return versionId || UNCATEGORIZED_VERSION;
}

export async function getVersionChoices(group = PERMIT_GROUP_PTC, includeInactive = false) {
  return prisma.ptcVersion.findMany({
    where: { group, ...(includeInactive ? {} : { active: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getVersionContext(rawVersion?: string | string[] | null, group = PERMIT_GROUP_PTC) {
  const versions = await getVersionChoices(group, true);
  const activeVersions = versions.filter((version) => version.active);
  const archivedVersions = versions.filter((version) => !version.active);
  const requested = firstParam(rawVersion);
  const requestedVersion = requested ? versions.find((version) => version.id === requested) : null;
  const defaultVersion = activeVersions.length > 0 ? activeVersions[activeVersions.length - 1] : null;
  const selectedVersionId = requested === UNCATEGORIZED_VERSION ? null : requestedVersion?.id ?? defaultVersion?.id ?? null;
  const selectedVersion = selectedVersionId ? versions.find((version) => version.id === selectedVersionId) : null;
  const selectedVersionName = selectedVersion?.name || "Uncategorized";

  return {
    versions,
    activeVersions,
    archivedVersions,
    selectedVersionId,
    selectedVersion,
    selectedVersionName,
    selectedVersionParam: versionQueryValue(selectedVersionId),
    options: [
      ...activeVersions.map((version) => ({ id: version.id, name: version.name, active: version.active })),
      ...archivedVersions.map((version) => ({ id: version.id, name: version.name, active: version.active })),
      { id: UNCATEGORIZED_VERSION, name: "Uncategorized", active: true }
    ]
  };
}

export async function getApplicationTypesWithDocuments(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTC;
  if (options.versionId === null) return [];

  return prisma.applicationType.findMany({
    where: {
      active: true,
      group,
      ...(options.versionId !== undefined ? { versionId: options.versionId } : { version: { active: true } })
    },
    include: { documents: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getDeactivatedMasterData(group = PERMIT_GROUP_PTC) {
  const [versions, applicationTypes, requiredDocuments, regionalOffices, provincialOffices] = await Promise.all([
    prisma.ptcVersion.findMany({
      where: { group, active: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.applicationType.findMany({
      where: { group, active: false },
      include: { version: true },
      orderBy: [{ version: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.requiredDocument.findMany({
      where: { active: false, applicationType: { group } },
      include: { applicationType: { include: { version: true } } },
      orderBy: [{ applicationType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.regionalOffice.findMany({
      where: { group, active: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.provincialOffice.findMany({
      where: { active: false, regionalOffice: { group } },
      include: { regionalOffice: true },
      orderBy: [{ regionalOffice: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    })
  ]);

  return {
    versions,
    applicationTypes,
    requiredDocuments,
    regionalOffices,
    provincialOffices
  };
}

export async function getOfficeChoices(group = PERMIT_GROUP_PTC) {
  return prisma.regionalOffice.findMany({
    where: { active: true, group },
    include: { provincialOffices: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getPttTransportTypes(includeInactive = false) {
  return prisma.pttTransportType.findMany({
    where: {
      group: PERMIT_GROUP_PTT,
      ...(includeInactive ? {} : { active: true, version: { active: true, group: PERMIT_GROUP_PTT } })
    },
    include: { version: true },
    orderBy: [{ version: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getReportData(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTC;
  const versionId = options.versionId;
  const selectedVersion = versionId ? await prisma.ptcVersion.findFirst({ where: { id: versionId, group } }) : null;
  const selectedVersionIsArchived = !!selectedVersion && !selectedVersion.active;
  const recordWhere = { group, ...(versionId !== undefined ? { versionId } : {}) };
  const documentWhere = versionId === null
    ? null
    : {
        ...(selectedVersionIsArchived ? {} : { active: true }),
        applicationType: {
          group,
          ...(selectedVersionIsArchived ? {} : { active: true }),
          ...(versionId !== undefined ? { versionId } : { version: { active: true } })
        }
      };

  const [documents, records] = await Promise.all([
    documentWhere
      ? prisma.requiredDocument.findMany({
          where: documentWhere,
          include: { applicationType: true },
          orderBy: [{ applicationType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
        })
      : Promise.resolve([]),
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
    editedByName: record.editedBy?.name || "",
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
    approved: record.approved,
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

export async function getPttApplicationRecords(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTT;
  const versionId = options.versionId;
  const records = await prisma.pttApplicationRecord.findMany({
    where: { group, ...(versionId !== undefined ? { versionId } : {}) },
    include: {
      version: true,
      createdBy: true,
      editedBy: true
    },
    orderBy: { createdAt: "desc" }
  });

  const duplicatePttNumbers = new Set(
    Array.from(
      records.reduce((map, record) => {
        const pttNumber = String(record.pttNumber || "").trim();
        if (!pttNumber) return map;
        map.set(pttNumber, (map.get(pttNumber) || 0) + 1);
        return map;
      }, new Map<string, number>())
    )
      .filter(([, count]) => count > 1)
      .map(([pttNumber]) => pttNumber)
  );

  return records.map((record) => ({
    ...record,
    versionName: record.version?.name || "Uncategorized",
    createdByName: record.createdBy.name,
    editedByName: record.editedBy?.name || "",
    pttNumberDuplicate: !!record.pttNumber && duplicatePttNumbers.has(record.pttNumber)
  }));
}
