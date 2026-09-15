import { prisma } from "@/lib/prisma";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";

export type VersionScopedOptions = {
  group?: string;
  versionId?: string | null;
};

export async function getApplicationTypesWithDocuments(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTC;
  if (options.versionId === null) return [];
  return prisma.applicationType.findMany({
    where: { active: true, group, ...(options.versionId !== undefined ? { versionId: options.versionId } : { version: { active: true } }) },
    include: { documents: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getDeactivatedMasterData(group = PERMIT_GROUP_PTC) {
  const [versions, applicationTypes, requiredDocuments, regionalOffices, provincialOffices, pttVersions, pttTransportTypes] = await Promise.all([
    prisma.ptcVersion.findMany({ where: { group, active: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.applicationType.findMany({ where: { group, active: false }, include: { version: true }, orderBy: [{ version: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.requiredDocument.findMany({ where: { active: false, applicationType: { group } }, include: { applicationType: { include: { version: true } } }, orderBy: [{ applicationType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.regionalOffice.findMany({ where: { group, active: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.provincialOffice.findMany({ where: { active: false, regionalOffice: { group } }, include: { regionalOffice: true }, orderBy: [{ regionalOffice: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.ptcVersion.findMany({ where: { group: PERMIT_GROUP_PTT, active: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.pttTransportType.findMany({ where: { group: PERMIT_GROUP_PTT, active: false }, include: { version: true }, orderBy: [{ version: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] })
  ]);
  return { versions, applicationTypes, requiredDocuments, regionalOffices, provincialOffices, pttVersions, pttTransportTypes };
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
    where: { group: PERMIT_GROUP_PTT, ...(includeInactive ? {} : { active: true, version: { active: true, group: PERMIT_GROUP_PTT } }) },
    include: { version: true },
    orderBy: [{ version: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
  });
}

export async function getPttValidityRules(includeInactiveVersions = false) {
  return prisma.pttValidityRule.findMany({
    where: { version: { group: PERMIT_GROUP_PTT, ...(includeInactiveVersions ? {} : { active: true }) } },
    include: { version: true },
    orderBy: [{ version: { sortOrder: "asc" } }, { version: { name: "asc" } }]
  });
}
