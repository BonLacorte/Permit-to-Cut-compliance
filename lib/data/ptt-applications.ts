import { prisma } from "@/lib/prisma";
import { mergeRemarks } from "@/lib/ptc-checks";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import type { VersionScopedOptions } from "@/lib/data/master-data";
import { duplicateNumberSet, normalizePermitNumber } from "@/lib/duplicate-numbers";

export async function getPttApplicationRecords(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTT;
  const versionId = options.versionId;
  const records = await prisma.pttApplicationRecord.findMany({
    where: { group, ...(versionId !== undefined ? { versionId } : {}) },
    include: { version: true, createdBy: true, editedBy: true, checkFindings: { where: { active: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  const allNumbers = versionId === undefined ? records : await prisma.pttApplicationRecord.findMany({ where: { group }, select: { pttNumber: true } });
  const duplicatePttNumbers = duplicateNumberSet(allNumbers.map((record) => record.pttNumber));
  return records.map((record) => ({
    ...record,
    versionName: record.version?.name || "Uncategorized",
    createdByName: record.createdBy.name,
    editedByName: record.editedBy?.name || "",
    manualRemarks: record.remarks || "",
    activeFindingMessages: record.checkFindings.map((finding) => finding.message),
    remarks: mergeRemarks(record.remarks, record.checkFindings.map((finding) => finding.message)),
    pttNumberDuplicate: duplicatePttNumbers.has(normalizePermitNumber(record.pttNumber))
  }));
}
