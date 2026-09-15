import { prisma } from "@/lib/prisma";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

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
