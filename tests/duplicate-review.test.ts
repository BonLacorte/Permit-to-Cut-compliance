import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, Role } from "@prisma/client";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { assertDuplicatePermission, buildMergePreview, commitDuplicateMerge, previewFingerprint } from "@/lib/duplicate-review";
import { defaultRuleData } from "@/lib/ptc-calculation-rules";
import type { MergeSelection } from "@/lib/duplicate-merge";

function fixture(group: "PTC" | "PTT" = "PTC") {
  const records = ["keep", "delete", "leave"].map((id) => ({
    id, group, ptcNumber: " 001 ", pttNumber: "001", versionId: "version", applicationTypeId: "type", remarks: `${id} manual\n\nThere's no signature in Approved field.`,
    applicantName: id, transporterName: id, version: { id: "version", name: "Archived", active: false }, applicationType: { id: "type", versionId: "version", name: "Retained type", active: false, documents: [{ id: "doc", active: false, name: "Document", requirementMode: "Required" }] },
    createdById: "creator", createdAt: new Date("2020-01-01"), updatedAt: new Date("2020-01-02"), progressEntries: [{ id: `progress-${id}`, remarks: "History" }], progressDocuments: [{ id: `pd-${id}`, requiredDocumentId: "doc", requiredDocument: { id: "doc", name: "Document" } }],
    checkRuns: [{ id: `run-${id}`, outputSnapshot: { old: true } }], checkFindings: [{ id: `finding-${id}`, message: "There's no signature in Approved field." }], treesApproved: 10, replantedSeedlings: true,
    volumeBoardFeet: 1000, amountPaid: 300, validityBasis: "WithinRegion", recordedValidityDays: 3, transportType: "Jeep"
  }));
  const rule = { id: "rule", versionId: "version", applicationTypeId: null, ...defaultRuleData(), updatedAt: new Date("2020-01-01") };
  const model = {
    findUnique: vi.fn(async ({ where }) => records.find((record) => record.id === where.id) || null),
    findMany: vi.fn(async ({ select }) => select ? records.map((record) => ({ id: record.id, ptcNumber: record.ptcNumber, pttNumber: record.pttNumber })) : records),
    update: vi.fn(async ({ where, data }) => Object.assign(records.find((record) => record.id === where.id)!, data)),
    deleteMany: vi.fn(async ({ where }) => ({ count: where.id.in.length }))
  };
  const tx = {
    user: { findUnique: vi.fn(async (): Promise<{ role: Role; featureAccess: object[] }> => ({ role: Role.ADMIN, featureAccess: [{}] })) }, applicationRecord: model, pttApplicationRecord: model,
    ptcCalculationRule: { findMany: vi.fn(async () => [rule]) }, pttValidityRule: { findUnique: vi.fn(async () => ({ outsideRegionAllowedDays: [9, 10] })) }, pttTransportType: { findFirst: vi.fn(async () => ({ maxBoardFeet: 3500 })) },
    applicationCheckRun: { create: vi.fn() }, applicationCheckFinding: { upsert: vi.fn() }, pttApplicationCheckRun: { create: vi.fn() }, pttApplicationCheckFinding: { upsert: vi.fn() }, activityLog: { create: vi.fn() }
  };
  const selection: MergeSelection = { group, keeperId: "keep", deleteIds: ["delete"], transfers: [{ field: "remarks", sourceId: "delete" }] };
  return { tx, db: tx as unknown as Prisma.TransactionClient, records, rule, selection, model };
}
describe("duplicate merge server enforcement", () => {
  it.each([Role.ADMIN, Role.SUPERADMIN])("requires an explicit assignment for %s", async (role) => {
    const { tx, db } = fixture();
    tx.user.findUnique.mockResolvedValue({ role, featureAccess: [] });
    await expect(assertDuplicatePermission(db, "actor")).rejects.toThrow("not enabled");
    tx.user.findUnique.mockResolvedValue({ role, featureAccess: [{}] });
    await expect(assertDuplicatePermission(db, "actor")).resolves.toBeUndefined();
  });
  it("denies Staff even with a stale assignment", async () => {
    const { tx, db, selection, model } = fixture();
    tx.user.findUnique.mockResolvedValue({ role: Role.STAFF, featureAccess: [{}] });
    await expect(commitDuplicateMerge(db, "actor", selection, "anything")).rejects.toThrow("not enabled"); expect(model.update).not.toHaveBeenCalled();
  });
  it.each(["record", "history", "rule", "group membership"]) ("rejects stale previews after a %s change", async (change) => {
    const { db, selection, records, rule, model } = fixture();
    const preview = await buildMergePreview(db, selection);
    if (change === "record") records[0].applicantName = "Concurrent edit";
    if (change === "history") records[1].progressEntries.push({ id: "new-history", remarks: "Concurrent history" });
    if (change === "rule") rule.updatedAt = new Date();
    if (change === "group membership") records.pop();
    await expect(commitDuplicateMerge(db, "actor", selection, preview.digest)).rejects.toThrow("stale"); expect(model.update).not.toHaveBeenCalled();
  });
  it.each(["PTC", "PTT"] as const)("writes %s checker refresh and durable snapshots before only selected deletions", async (group) => {
    const { db, tx, selection, model } = fixture(group);
    const preview = await buildMergePreview(db, selection);
    await commitDuplicateMerge(db, "actor", selection, preview.digest);
    expect(model.update).toHaveBeenCalledWith({ where: { id: "keep" }, data: expect.objectContaining({ editedById: "actor" }) });
    const update = model.update.mock.calls[0][0].data;
    expect(update.createdAt).toBeUndefined(); expect(update.createdById).toBeUndefined(); expect(update.applicationTypeId).toBeUndefined(); expect(update.progressDocuments).toBeUndefined();
    expect(update.remarks).toContain("keep manual\n\ndelete manual"); expect(update.remarks).not.toContain("There's no signature in Approved field.");
    const metadata = tx.activityLog.create.mock.calls[0][0].data.metadata;
    expect(metadata.before.map((record: { id: string }) => record.id)).toEqual(["keep", "delete"]);
    expect(metadata.before[1].progressDocuments).toHaveLength(1); expect(metadata.before[1].checkRuns).toHaveLength(1); expect(metadata.before[1].progressEntries).toHaveLength(1);
    expect(metadata.after.createdById).toBe("creator"); expect(metadata.deletedIds).toEqual(["delete"]);
    expect(tx.activityLog.create.mock.invocationCallOrder[0]).toBeLessThan(model.deleteMany.mock.invocationCallOrder[0]);
    expect(model.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["delete"] }, group } });
    expect((group === "PTC" ? tx.applicationCheckRun : tx.pttApplicationCheckRun).create).toHaveBeenCalledTimes(group === "PTC" ? 3 : 5);
  });
  it("never stores unavailable checks as active exceptions or matching results", async () => {
    const { db, tx, selection, records } = fixture(); records[0].treesApproved = null as unknown as number;
    const preview = await buildMergePreview(db, selection); await commitDuplicateMerge(db, "actor", selection, preview.digest);
    expect(tx.applicationCheckFinding.upsert.mock.calls[0][0].create).toEqual(expect.objectContaining({ active: false, resolvedAt: null, comparisonSnapshot: expect.objectContaining({ evaluation: "not-checked", matches: false }) }));
  });
  it("rejects invalid outside-region choices against the retained rule", async () => {
    const { db, selection, records } = fixture("PTT"); records[0].validityBasis = "OutsideRegionInterIsland";
    await expect(buildMergePreview(db, { ...selection, outsideRegionDays: 7 })).rejects.toThrow("allowed outside-region");
    expect((await buildMergePreview(db, { ...selection, outsideRegionDays: 9 })).final.actualValidityDays).toBe(9);
  });
  it("fingerprints stable objects canonically and detects nested changes", () => {
    expect(previewFingerprint({ a: 1, b: [2] })).toBe(previewFingerprint({ b: [2], a: 1 }));
    expect(previewFingerprint({ a: 1, b: [2] })).not.toBe(previewFingerprint({ a: 1, b: [3] }));
  });
});
