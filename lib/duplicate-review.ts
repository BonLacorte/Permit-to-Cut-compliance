import { createHash } from "node:crypto";
import { FeatureKey, Prisma, Role, type ApplicationCheckType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { duplicateNumberSet, normalizePermitNumber, type PermitGroup } from "@/lib/duplicate-numbers";
import { evaluateMergedRecord, mergeSelectionSchema, selectMergedRecord, type MergeRecord, type MergeSelection } from "@/lib/duplicate-merge";
import { replaceGeneratedRemarks } from "@/lib/ptc-checks";
import { ruleConfig } from "@/lib/ptc-calculation-rules";
import { pttValidityRuleConfig } from "@/lib/ptt-validity-rules";
import { pttCapacityMaxFromCategory } from "@/lib/ptt-checks";
import { pttStatus, type PttDisplayRecord } from "@/lib/ptt";
import { auditRecord, type RequiredDocumentRef, type RecordRef } from "@/lib/reporting";

export function jsonSnapshot<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function previewFingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(jsonSnapshot(value)))).digest("hex"); }
const userSelect = { id: true, name: true };
const ptcInclude = {
  version: true, applicationType: { include: { documents: { orderBy: { id: "asc" as const } } } }, createdBy: { select: userSelect }, editedBy: { select: userSelect },
  progressEntries: { orderBy: { id: "asc" as const } }, progressDocuments: { include: { requiredDocument: true }, orderBy: { id: "asc" as const } },
  checkRuns: { orderBy: { id: "asc" as const } }, checkFindings: { orderBy: { id: "asc" as const } }
};
const pttInclude = { version: true, createdBy: { select: userSelect }, editedBy: { select: userSelect }, checkRuns: { orderBy: { id: "asc" as const } }, checkFindings: { orderBy: { id: "asc" as const } } };

export async function duplicateGroupList(group: PermitGroup) {
  const records = group === "PTC"
    ? (await prisma.applicationRecord.findMany({ where: { group }, select: { id: true, ptcNumber: true, applicantName: true, version: { select: { name: true, active: true } } } })).map((record) => ({ ...record, number: record.ptcNumber, name: record.applicantName }))
    : (await prisma.pttApplicationRecord.findMany({ where: { group }, select: { id: true, pttNumber: true, transporterName: true, version: { select: { name: true, active: true } } } })).map((record) => ({ ...record, number: record.pttNumber, name: record.transporterName }));
  const duplicates = duplicateNumberSet(records.map((record) => record.number));
  return [...duplicates].sort().map((number) => {
    const members = records.filter((record) => normalizePermitNumber(record.number) === number);
    return { number, count: members.length, names: members.map((record) => record.name || "Blank").join("; "), versions: [...new Set(members.map((record) => record.version ? `${record.version.name}${record.version.active ? "" : " (archived)"}` : "Uncategorized"))].join(", ") };
  });
}

async function loadGroup(tx: Prisma.TransactionClient, group: PermitGroup, number: string) {
  const allNumbers = group === "PTC"
    ? (await tx.applicationRecord.findMany({ where: { group }, select: { id: true, ptcNumber: true } })).map((record) => ({ id: record.id, number: record.ptcNumber }))
    : (await tx.pttApplicationRecord.findMany({ where: { group }, select: { id: true, pttNumber: true } })).map((record) => ({ id: record.id, number: record.pttNumber }));
  const key = normalizePermitNumber(number);
  const ids = key ? allNumbers.filter((record) => normalizePermitNumber(record.number) === key).map((record) => record.id) : [];
  const records = group === "PTC"
    ? await tx.applicationRecord.findMany({ where: { id: { in: ids }, group }, include: ptcInclude, orderBy: { id: "asc" } })
    : await tx.pttApplicationRecord.findMany({ where: { id: { in: ids }, group }, include: pttInclude, orderBy: { id: "asc" } });
  return records;
}
function manualRecord(record: MergeRecord & { checkFindings: Array<{ message: string }> }): MergeRecord {
  return { ...record, remarks: replaceGeneratedRemarks(String(record.remarks || ""), record.checkFindings.map((finding) => finding.message), []) };
}
export function displayMergeRecord(record: MergeRecord): MergeRecord {
  const { checkRuns: _runs, checkFindings: _findings, progressEntries: _progress, ...display } = record;
  return jsonSnapshot(display) as MergeRecord;
}
function recordStatus(group: PermitGroup, record: MergeRecord) {
  if (group === "PTT") return pttStatus(record as PttDisplayRecord);
  const type = record.applicationType as { id: string; versionId: string; name: string; active: boolean; documents: Array<{ id: string; name: string; active: boolean; requirementMode: RequiredDocumentRef["requirementMode"] }> } | null;
  const version = record.version as { active: boolean } | null;
  const documents = (type?.documents || []).filter((doc) => version?.active === false || type?.active && doc.active).map((doc) => ({ ...doc, versionId: type!.versionId, applicationTypeId: type!.id, applicationTypeName: type!.name }));
  return auditRecord({ ...record, applicantName: String(record.applicantName || ""), applicationTypeName: type?.name || "Pending", applicationTypeVersionId: type?.versionId, selectedDocumentIds: (record.progressDocuments as Array<{ requiredDocumentId: string }> || []).map((doc) => doc.requiredDocumentId) } as RecordRef, documents).status;
}
export async function duplicateComparison(group: PermitGroup, number: string) {
  return prisma.$transaction(async (tx) => {
    const records = await loadGroup(tx, group, number);
    const versions = [...new Set(records.map((record) => record.versionId).filter((id): id is string => Boolean(id)))];
    const rules = group === "PTT" ? await tx.pttValidityRule.findMany({ where: { versionId: { in: versions } } }) : [];
    // Only send scalar form values and safe display metadata to the browser. Full history remains server-side.
    return records.map((record) => {
      const display = displayMergeRecord(manualRecord(record));
      return jsonSnapshot({ ...display, status: recordStatus(group, record), outsideRegionAllowedDays: pttValidityRuleConfig(rules.find((rule) => rule.versionId === record.versionId)).outsideRegionAllowedDays });
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function assertDuplicatePermission(tx: Prisma.TransactionClient, actorId: string) {
  const user = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, featureAccess: { where: { feature: FeatureKey.DUPLICATE_MANAGEMENT } } } });
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) || !user.featureAccess.length) throw new Error("Duplicate Management is not enabled for your account.");
}

export async function buildMergePreview(tx: Prisma.TransactionClient, rawSelection: MergeSelection) {
  const selection = mergeSelectionSchema.parse(rawSelection);
  const keeper = selection.group === "PTC" ? await tx.applicationRecord.findUnique({ where: { id: selection.keeperId } }) : await tx.pttApplicationRecord.findUnique({ where: { id: selection.keeperId } });
  if (!keeper || keeper.group !== selection.group) throw new Error("The retained record no longer exists in this permit group.");
  const number = selection.group === "PTC" ? (keeper as { ptcNumber: string | null }).ptcNumber : (keeper as { pttNumber: string | null }).pttNumber;
  const originals = await loadGroup(tx, selection.group, number || "");
  const selected = selectMergedRecord(originals.map(manualRecord), selection);
  const versionId = keeper.versionId;
  const ptcRules = selection.group === "PTC" && versionId ? await tx.ptcCalculationRule.findMany({ where: { versionId }, orderBy: { id: "asc" } }) : [];
  const compatibleType = selection.group === "PTC" && "applicationType" in selected.keeper ? selected.keeper.applicationType as { versionId: string } | null : null;
  const ptcRule = compatibleType?.versionId === versionId ? ptcRules.find((rule) => rule.applicationTypeId === selected.keeper.applicationTypeId) || ptcRules.find((rule) => !rule.applicationTypeId) : undefined;
  const pttRule = selection.group === "PTT" && versionId ? await tx.pttValidityRule.findUnique({ where: { versionId } }) : null;
  const transport = selection.group === "PTT" && versionId && selected.merged.transportType ? await tx.pttTransportType.findFirst({ where: { versionId, group: "PTT", name: String(selected.merged.transportType) } }) : null;
  const rules = { ptcConfig: ptcRule ? ruleConfig(ptcRule) : undefined, pttConfig: pttValidityRuleConfig(pttRule), maxBoardFeet: transport?.maxBoardFeet ?? pttCapacityMaxFromCategory(transport?.capacityCategory || null) };
  if (selection.group === "PTT" && selected.merged.validityBasis === "OutsideRegionInterIsland" && selection.outsideRegionDays != null && !rules.pttConfig.outsideRegionAllowedDays.includes(selection.outsideRegionDays)) throw new Error("Choose an allowed outside-region validity duration for the retained Version.");
  const evaluated = evaluateMergedRecord(selection.group, selected.merged, rules, selection.outsideRegionDays);
  const final: MergeRecord = { ...selected.merged, ...evaluated.calculated, remarks: evaluated.remarks };
  final.status = recordStatus(selection.group, final);
  const digest = previewFingerprint({ selection, originals, ptcRules, pttRule, transport, evaluated });
  return { selection, originals, selected, evaluated, final, digest };
}

function jsonInput(value: unknown) { return jsonSnapshot(value == null ? {} : value) as Prisma.InputJsonValue; }
export async function commitDuplicateMerge(tx: Prisma.TransactionClient, actorId: string, selection: MergeSelection, expectedDigest: string) {
  await assertDuplicatePermission(tx, actorId);
  const preview = await buildMergePreview(tx, selection);
  if (preview.digest !== expectedDigest) throw new Error("This preview is stale: records, related history, or calculation rules changed. Reload the group and review a new preview.");
  const { keeperId, group, deleteIds } = preview.selection;
  const data = { ...preview.selected.data, ...preview.evaluated.calculated, remarks: preview.evaluated.remarks, editedById: actorId };
  if (group === "PTC") await tx.applicationRecord.update({ where: { id: keeperId }, data: data as Prisma.ApplicationRecordUncheckedUpdateInput });
  else await tx.pttApplicationRecord.update({ where: { id: keeperId }, data: data as Prisma.PttApplicationRecordUncheckedUpdateInput });
  for (const check of preview.evaluated.checks) {
    const comparisonSnapshot = jsonInput({ evaluation: check.state, matches: check.state === "matched", message: check.message });
    const run = { appliedById: actorId, inputSnapshot: jsonInput(check.input), ruleSnapshot: jsonInput(check.rule), outputSnapshot: jsonInput({ evaluation: check.state, result: check.output }), comparisonSnapshot };
    const finding = { message: check.message, active: check.state === "issue", comparisonSnapshot, resolvedAt: check.state === "matched" ? new Date() : null };
    if (group === "PTC") {
      const checkType = check.type as ApplicationCheckType;
      await tx.applicationCheckRun.create({ data: { ...run, applicationRecordId: keeperId, checkType } });
      await tx.applicationCheckFinding.upsert({ where: { applicationRecordId_checkType: { applicationRecordId: keeperId, checkType } }, create: { ...finding, applicationRecordId: keeperId, checkType }, update: finding });
    } else {
      await tx.pttApplicationCheckRun.create({ data: { ...run, pttApplicationRecordId: keeperId, checkType: check.type } });
      await tx.pttApplicationCheckFinding.upsert({ where: { pttApplicationRecordId_checkType: { pttApplicationRecordId: keeperId, checkType: check.type } }, create: { ...finding, pttApplicationRecordId: keeperId, checkType: check.type }, update: finding });
    }
  }
  const after = group === "PTC" ? await tx.applicationRecord.findUnique({ where: { id: keeperId }, include: ptcInclude }) : await tx.pttApplicationRecord.findUnique({ where: { id: keeperId }, include: pttInclude });
  // The log has no record foreign key, so complete snapshots survive the cascading deletions below.
  await tx.activityLog.create({ data: { userId: actorId, action: "MERGE_DUPLICATE_RECORDS", targetType: group, targetId: keeperId, metadata: jsonInput({ schemaVersion: 1, actorId, selection: preview.selection, previewDigest: preview.digest, before: preview.originals.filter((record) => record.id === keeperId || deleteIds.includes(record.id)), after, checks: preview.evaluated.checks, deletedIds: deleteIds }) } });
  const deleted = group === "PTC" ? await tx.applicationRecord.deleteMany({ where: { id: { in: deleteIds }, group } }) : await tx.pttApplicationRecord.deleteMany({ where: { id: { in: deleteIds }, group } });
  if (deleted.count !== deleteIds.length) throw new Error("A selected duplicate changed during the merge. Nothing was saved.");
  return { keeperId, group, deleteIds };
}
