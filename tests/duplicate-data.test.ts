import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ ptc: vi.fn(), ptt: vi.fn(), documents: vi.fn(), version: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { applicationRecord: { findMany: db.ptc }, pttApplicationRecord: { findMany: db.ptt }, requiredDocument: { findMany: db.documents }, ptcVersion: { findFirst: db.version } } }));
import { getReportData } from "@/lib/data/ptc-reports";
import { getPttApplicationRecords } from "@/lib/data/ptt-applications";
import { applicationExportRows } from "@/lib/reporting";
import { pttExportRows } from "@/lib/ptt";
beforeEach(() => { vi.clearAllMocks(); db.documents.mockResolvedValue([]); db.version.mockResolvedValue({ active: true }); });
it.each(["PTC", "PTT"])("marks version-filtered %s rows against all active/archived/Uncategorized numbers", async (group) => {
  const selected = [{ id: "a", ptcNumber: " 001a  b-1 ", pttNumber: " 001a  b-1 ", versionId: "new", group, version: { name: "New" }, createdBy: { name: "Creator" }, editedBy: null, progressDocuments: [], checkFindings: [] }];
  const allNumbers = [selected[0], { ptcNumber: "001A B-1", pttNumber: "001A B-1", versionId: "archived" }, { ptcNumber: "001A B-1", pttNumber: "001A B-1", versionId: null }, { ptcNumber: "", pttNumber: "" }];
  const mock = group === "PTC" ? db.ptc : db.ptt;
  mock.mockResolvedValueOnce(selected).mockResolvedValueOnce(allNumbers);
  if (group === "PTC") {
    const result = await getReportData({ versionId: "new" }); expect(result.audits[0].ptcNumberDuplicate).toBe(true);
    expect(JSON.stringify(applicationExportRows(result.audits))).toContain('"Duplicate PTC Number":"Yes"');
  } else {
    const result = await getPttApplicationRecords({ versionId: "new" }); expect(result[0].pttNumberDuplicate).toBe(true);
    expect(pttExportRows(result)[0]["Duplicate PTT Number"]).toBe("Yes");
  }
  expect(mock).toHaveBeenLastCalledWith({ where: { group }, select: group === "PTC" ? { ptcNumber: true } : { pttNumber: true } });
});
