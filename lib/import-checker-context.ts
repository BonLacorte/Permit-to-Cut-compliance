import { prisma } from "@/lib/prisma";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import type { OfficeImportChoice, PtcImportCheckContext, PttImportCheckContext } from "@/lib/import-checker";

async function activeOfficeChoices(): Promise<OfficeImportChoice[]> {
  return prisma.regionalOffice.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      name: true,
      provincialOffices: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { name: true }
      }
    }
  });
}

export async function ptcImportCheckContext(versionId: string | null): Promise<PtcImportCheckContext> {
  const [officeChoices, applicationTypes, existingRecords] = await Promise.all([
    activeOfficeChoices(),
    versionId
      ? prisma.applicationType.findMany({
          where: { group: PERMIT_GROUP_PTC, versionId, active: true },
          select: { name: true }
        })
      : Promise.resolve([]),
    prisma.applicationRecord.findMany({
      where: { group: PERMIT_GROUP_PTC, ptcNumber: { not: null } },
      select: { ptcNumber: true }
    })
  ]);

  return {
    versionId,
    applicationTypeNames: applicationTypes.map((type) => type.name),
    existingPtcNumbers: existingRecords.map((record) => record.ptcNumber || ""),
    officeChoices
  };
}

export async function pttImportCheckContext(versionId: string | null): Promise<PttImportCheckContext> {
  const [officeChoices, transportTypes, existingRecords] = await Promise.all([
    activeOfficeChoices(),
    versionId
      ? prisma.pttTransportType.findMany({
          where: { group: PERMIT_GROUP_PTT, versionId, active: true },
          select: { name: true }
        })
      : Promise.resolve([]),
    prisma.pttApplicationRecord.findMany({
      where: { group: PERMIT_GROUP_PTT, pttNumber: { not: null } },
      select: { pttNumber: true }
    })
  ]);

  return {
    versionId,
    transportTypes: transportTypes.map((type) => type.name),
    existingPttNumbers: existingRecords.map((record) => record.pttNumber || ""),
    officeChoices
  };
}
