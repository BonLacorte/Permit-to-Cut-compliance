import { prisma } from "@/lib/prisma";
import { mergeRemarks } from "@/lib/ptc-checks";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import type { VersionScopedOptions } from "@/lib/data/master-data";

export async function getPttApplicationRecords(options: VersionScopedOptions = {}) {
  const group = options.group ?? PERMIT_GROUP_PTT;
  const versionId = options.versionId;
  const records = await prisma.pttApplicationRecord.findMany({
    where: { group, ...(versionId !== undefined ? { versionId } : {}) },
    include: { version: true, createdBy: true, editedBy: true, checkFindings: { where: { active: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  const duplicatePttNumbers = new Set(Array.from(records.reduce((map, record) => {
    const pttNumber = String(record.pttNumber || "").trim();
    if (!pttNumber) return map;
    map.set(pttNumber, (map.get(pttNumber) || 0) + 1);
    return map;
  }, new Map<string, number>())).filter(([, count]) => count > 1).map(([pttNumber]) => pttNumber));
  return records.map((record) => ({
    ...record,
    versionName: record.version?.name || "Uncategorized",
    createdByName: record.createdBy.name,
    editedByName: record.editedBy?.name || "",
    manualRemarks: record.remarks || "",
    activeFindingMessages: record.checkFindings.map((finding) => finding.message),
    remarks: mergeRemarks(record.remarks, record.checkFindings.map((finding) => finding.message)),
    pttNumberDuplicate: !!record.pttNumber && duplicatePttNumbers.has(record.pttNumber)
  }));
}
