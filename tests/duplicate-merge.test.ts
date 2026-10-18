import { describe, expect, it } from "vitest";
import { duplicateNumberSet, normalizePermitNumber } from "@/lib/duplicate-numbers";
import { duplicateMergeFields, evaluateMergedRecord, mergeSelectionSchema, selectMergedRecord, type MergeRecord, type MergeSelection } from "@/lib/duplicate-merge";
import { DEFAULT_PTC_CALCULATION_CONFIG, replaceGeneratedRemarks } from "@/lib/ptc-checks";
import { DEFAULT_PTT_VALIDITY_RULE_CONFIG } from "@/lib/ptt-checks";

const rules = { ptcConfig: DEFAULT_PTC_CALCULATION_CONFIG, pttConfig: DEFAULT_PTT_VALIDITY_RULE_CONFIG, maxBoardFeet: 3500 };
const records: MergeRecord[] = [
  { id: "keep", group: "PTC", ptcNumber: " 0012 a-1 ", versionId: "new", applicationTypeId: "keeper-type", remarks: "Manual note", treesApproved: 10, replantedSeedlings: true, recordedFee: 1500, createdById: "original", createdAt: "2020-01-01", progressDocuments: ["keeper-doc"] },
  { id: "donor1", group: "PTC", ptcNumber: "0012 A-1", versionId: "archived", applicationTypeId: "donor-type", remarks: "Manual note\n\nExtra note", treesApproved: 20, recordedFee: 2000, applicantName: null, progressDocuments: ["donor-doc"] },
  { id: "donor2", group: "PTC", ptcNumber: "0012   A-1", versionId: null, approved: "Other approver", remarks: "Other note" }
];
const selection: MergeSelection = { group: "PTC", keeperId: "keep", deleteIds: ["donor1", "donor2"], transfers: [] };
describe("duplicate number normalization", () => {
  it("normalizes whitespace and case but preserves punctuation and leading zeros", () => {
    expect(normalizePermitNumber(" \t00ab   c-1 \n")).toBe("00AB C-1");
    expect(duplicateNumberSet([null, "", "  ", "001", "1", "A-1", "a-1", " A  B", "a b", "A1"])).toEqual(new Set(["A-1", "A B"]));
  });
});
describe("selective multi-record merge", () => {
  it("defaults to survivor values, preserves protected metadata and documents", () => {
    expect(selectMergedRecord(records, selection).data).toEqual({});
    expect(selectMergedRecord(records, selection).merged).toEqual(records[0]);
  });
  it("copies separate fields from multiple selected donors and deliberately clears blanks", () => {
    const result = selectMergedRecord(records, { ...selection, transfers: [{ field: "recordedFee", sourceId: "donor1" }, { field: "approved", sourceId: "donor2" }, { field: "applicantName", sourceId: "donor1" }] });
    expect(result.data).toEqual({ recordedFee: 2000, approved: "Other approver", applicantName: null });
    expect(result.merged.applicationTypeId).toBe("keeper-type");
    expect(result.merged.progressDocuments).toEqual(["keeper-doc"]);
    expect(result.merged.createdById).toBe("original");
  });
  it("allows retaining a different member and deleting only some members", () => {
    const result = selectMergedRecord(records, { ...selection, keeperId: "donor1", deleteIds: ["keep"], transfers: [{ field: "treesApproved", sourceId: "keep" }] });
    expect(result.merged.id).toBe("donor1"); expect(result.merged.versionId).toBe("archived"); expect(result.merged.treesApproved).toBe(10);
  });
  it("appends manual remarks once", () => {
    expect(selectMergedRecord(records, { ...selection, transfers: [{ field: "remarks", sourceId: "donor1" }] }).data.remarks).toBe("Manual note\n\nExtra note");
  });
  it.each(["id", "ptcNumber", "versionId", "applicationTypeId", "progressDocuments", "actualFee", "createdAt", "createdById", "status"]) ("rejects protected field %s", (field) => {
    expect(() => selectMergedRecord(records, { ...selection, transfers: [{ field, sourceId: "donor1" }] })).toThrow("Protected fields");
  });
  it("rejects competing donors and donors not selected for deletion", () => {
    expect(() => selectMergedRecord(records, { ...selection, transfers: [{ field: "remarks", sourceId: "donor1" }, { field: "remarks", sourceId: "donor2" }] })).toThrow("only one source");
    expect(() => selectMergedRecord(records, { ...selection, deleteIds: ["donor1"], transfers: [{ field: "approved", sourceId: "donor2" }] })).toThrow("selected for deletion");
  });
  it("rejects missing, wrong-group, different-number, blank-number and repeated deletion members", () => {
    for (const donor of [{ ...records[1], group: "PTT" }, { ...records[1], ptcNumber: "different" }, { ...records[1], ptcNumber: "" }]) expect(() => selectMergedRecord([records[0], donor], { ...selection, deleteIds: ["donor1"] })).toThrow("same duplicate permit group");
    for (const deleteIds of [["missing"], ["keep"], ["donor1", "donor1"]]) expect(() => selectMergedRecord(records, { ...selection, deleteIds })).toThrow();
    expect(() => selectMergedRecord([{ ...records[0], ptcNumber: "" }, records[1]], selection)).toThrow();
    expect(mergeSelectionSchema.safeParse({ ...selection, deleteIds: [] }).success).toBe(false);
  });
  it("uses PTT Number, never linked PTC Number, and permits PTT source-reference transfers", () => {
    const ptt = [{ id: "a", group: "PTT", pttNumber: "T1", ptcNumber: "P1" }, { id: "b", group: "PTT", pttNumber: "t1", ptcNumber: "P2" }];
    expect(selectMergedRecord(ptt, { group: "PTT", keeperId: "a", deleteIds: ["b"], transfers: [{ field: "ptcNumber", sourceId: "b" }] }).data).toEqual({ ptcNumber: "P2" });
    expect(duplicateMergeFields("PTT").map((field) => field.key)).not.toContain("pttNumber");
  });
});
describe("automatic merge recalculation", () => {
  it("recalculates PTC using the retained rule and signature counterpart fallback", () => {
    const result = evaluateMergedRecord("PTC", { ...records[0], recommendingApprovalSignatureStatus: "For", approved: "Approver", approvedSignatureStatus: "Blank" }, rules);
    expect(result.calculated.actualFee).toBeGreaterThan(0);
    expect(result.calculated.actualValidityDays).toBeGreaterThan(0);
    expect(result.checks.find((check) => check.type === "Signature")?.message).toContain("by Approver");
    expect(result.remarks).toContain("There's no signature in Approved field.");
  });
  it("clears unavailable stale PTC outputs and records not-checked rather than passed", () => {
    const result = evaluateMergedRecord("PTC", { ...records[0], treesApproved: null, actualFee: 999, actualValidityDays: 999 }, rules);
    expect(result.calculated).toEqual({ actualFee: null, actualValidityDays: null });
    expect(result.checks.slice(0, 2).every((check) => check.state === "not-checked" && check.output === null)).toBe(true);
    expect(result.remarks).toContain("Auto Check not run: PTC Fee.");
    expect(replaceGeneratedRemarks(result.remarks, [], [])).toBe("Manual note");
  });
  it("does not fall back to stale outputs or default PTC rules for Uncategorized", () => {
    const result = evaluateMergedRecord("PTC", { ...records[0], versionId: null }, rules);
    expect(result.checks[0].state).toBe("not-checked"); expect(result.calculated.actualFee).toBeNull();
  });
  const ptt: MergeRecord = { id: "p", group: "PTT", versionId: "ptt", volumeBoardFeet: 3000, amountPaid: 900, transportType: "Jeep", validityBasis: "OutsideRegionInterIsland", recordedValidityDays: 9, validatedInspectedBySignatureStatus: "Blank", issuedBySignatureStatus: "For", validatedInspectedBy: "Inspector" };
  it("uses retained PTT allowed days and automatically runs all five check types", () => {
    const result = evaluateMergedRecord("PTT", ptt, { ...rules, pttConfig: { ...rules.pttConfig, outsideRegionAllowedDays: [9, 10] } }, 9);
    expect(result.calculated).toEqual({ actualFee: 900, actualValidityDays: 9, actualTransportCategory: "Jeep" });
    expect(result.checks.map((check) => check.type)).toEqual(["Fee", "Validity", "Vehicle", "Signature", "RequiredFields"]);
    expect(result.checks.find((check) => check.type === "Fee")?.state).toBe("matched");
    expect(result.remarks).toContain("by Inspector"); expect(result.remarks).toContain("There's no date in Date Issued field.");
  });
  it("leaves missing outside days unavailable and clears stale validity", () => {
    const result = evaluateMergedRecord("PTT", { ...ptt, actualValidityDays: 7 }, rules);
    expect(result.calculated.actualValidityDays).toBeNull(); expect(result.checks[1].state).toBe("not-checked");
  });
  it("clears unavailable PTT fee/vehicle results while keeping independent validity available", () => {
    const result = evaluateMergedRecord("PTT", { ...ptt, volumeBoardFeet: null, validityBasis: "WithinRegion" }, rules);
    expect(result.calculated).toEqual({ actualFee: null, actualValidityDays: 3, actualTransportCategory: null });
    expect(result.checks[0].state).toBe("not-checked"); expect(result.checks[2].state).toBe("not-checked");
  });
});
