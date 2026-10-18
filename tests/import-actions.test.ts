import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureKey, Role } from "@prisma/client";
import * as XLSX from "xlsx";
import { PTC_IMPORT_COLUMNS, PTT_IMPORT_COLUMNS } from "@/lib/excel/constants";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), userHasFeature: vi.fn(), getCurrentUser: vi.fn(),
  version: vi.fn(), types: vi.fn(), createPtc: vi.fn(), createPtt: vi.fn(),
  ptcContext: vi.fn(), pttContext: vi.fn(), revalidate: vi.fn()
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin, userHasFeature: mocks.userHasFeature, getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  ptcVersion: { findFirst: mocks.version }, applicationType: { findMany: mocks.types },
  applicationRecord: { createMany: mocks.createPtc }, pttApplicationRecord: { createMany: mocks.createPtt }
} }));
vi.mock("@/lib/import-checker-context", () => ({ ptcImportCheckContext: mocks.ptcContext, pttImportCheckContext: mocks.pttContext }));
vi.mock("@/lib/import-checker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/import-checker")>();
  return { ...actual, checkPtcImportWorkbook: vi.fn(actual.checkPtcImportWorkbook), checkPttImportWorkbook: vi.fn(actual.checkPttImportWorkbook) };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error(url), { digest: "NEXT_REDIRECT" }); } }));
import { importPtcRecordsAction, importPttRecordsAction } from "@/app/actions/imports";
import { checkPtcImportWorkbook, checkPttImportWorkbook } from "@/lib/import-checker";
import { POST } from "@/app/api/import-preview/route";

function workbook(group: "PTC" | "PTT", { bad = false, empty = false } = {}) {
  const headers: string[] = [...(group === "PTC" ? PTC_IMPORT_COLUMNS : PTT_IMPORT_COLUMNS)];
  if (bad) headers[0] = "Wrong header";
  const row: unknown[] = Array(headers.length).fill("");
  row[0] = "Region VIII"; row[1] = "Leyte"; row[2] = "DUP-1"; row[3] = bad ? "invalid date" : "2026-10-18"; row[4] = "Import Test";
  if (group === "PTC") { row[7] = bad ? "invalid number" : 10; row[11] = bad ? "unknown" : "Owner"; }
  else { row[10] = bad ? "invalid number" : 10; row[11] = bad ? "unknown" : "Yes"; row[24] = bad ? "unknown" : "WithinRegion"; row[31] = "Retain remarks"; }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(empty ? [headers] : [headers, row]), "Import");
  return new File([XLSX.write(book, { type: "buffer", bookType: "xlsx" })], "import.xlsx");
}

function submission(group: "PTC" | "PTT", options: { bad?: boolean; empty?: boolean; force?: boolean } = {}) {
  const form = new FormData();
  form.set("file", workbook(group, options)); form.set("versionId", "version-1");
  if (options.force) form.set("forceImport", "true");
  return form;
}

function action(group: "PTC" | "PTT") { return group === "PTC" ? importPtcRecordsAction : importPttRecordsAction; }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin", role: Role.ADMIN });
  mocks.getCurrentUser.mockResolvedValue({ id: "admin", role: Role.ADMIN });
  mocks.userHasFeature.mockResolvedValue(false);
  mocks.version.mockResolvedValue({ id: "version-1", name: "Test Version" });
  mocks.types.mockResolvedValue([]);
  mocks.ptcContext.mockResolvedValue({ versionId: "version-1", applicationTypeNames: [], existingPtcNumbers: ["DUP-1"], officeChoices: [] });
  mocks.pttContext.mockResolvedValue({ versionId: "version-1", transportTypes: [], existingPttNumbers: ["DUP-1"], officeChoices: [] });
});

describe.each(["PTC", "PTT"] as const)("%s import modes", (group) => {
  const create = () => group === "PTC" ? mocks.createPtc : mocks.createPtt;
  it.each([Role.ADMIN, Role.SUPERADMIN])("imports despite header/typed errors and duplicates when checker is off for %s", async (role) => {
    mocks.requireAdmin.mockResolvedValue({ id: "user", role });
    const form = submission(group, { bad: true });
    form.set("checkerEnabled", "true"); // Browser claims never determine the server mode.
    await expect(action(group)(form)).rejects.toThrow("Imported+1");
    expect(mocks.userHasFeature).toHaveBeenCalledWith({ id: "user", role }, FeatureKey.IMPORT_CHECKER);
    expect(mocks.ptcContext).not.toHaveBeenCalled(); expect(mocks.pttContext).not.toHaveBeenCalled();
    expect(checkPtcImportWorkbook).not.toHaveBeenCalled(); expect(checkPttImportWorkbook).not.toHaveBeenCalled();
    expect(create()).toHaveBeenCalledWith({ data: [expect.objectContaining({ dateIssued: null, createdById: "user", ...(group === "PTC" ? { treesApplied: null, locExemption: null } : { boardFeetGranted: null, certificateOfQuantityVolumeAttached: null, validityBasis: null, remarks: "Retain remarks" }) })] });
  });

  it("rechecks the current assignment at submission and blocks errors without the override", async () => {
    mocks.userHasFeature.mockResolvedValue(true);
    const form = submission(group, { bad: true }); form.set("checkerEnabled", "false");
    await expect(action(group)(form)).rejects.toThrow("blocking+error");
    expect(create()).not.toHaveBeenCalled();
  });

  it("allows the confirmed override when checker is enabled", async () => {
    mocks.userHasFeature.mockResolvedValue(true);
    await expect(action(group)(submission(group, { bad: true, force: true }))).rejects.toThrow("despite");
    expect(create()).toHaveBeenCalledTimes(1);
  });

  it("allows warnings through normal checked import", async () => {
    mocks.userHasFeature.mockResolvedValue(true);
    await expect(action(group)(submission(group))).rejects.toThrow("Imported+1");
    expect(create()).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("rejects an empty workbook with checker enabled=%s", async (enabled) => {
    mocks.userHasFeature.mockResolvedValue(enabled);
    await expect(action(group)(submission(group, { empty: true, force: true }))).rejects.toThrow("No+");
    expect(create()).not.toHaveBeenCalled();
  });

  it("rejects an unreadable workbook even in direct mode", async () => {
    const form = submission(group); form.set("file", new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff])], "broken.xlsx"));
    await expect(action(group)(form)).rejects.toThrow("Could+not+read");
    expect(create()).not.toHaveBeenCalled();
  });

  it("requires a valid active destination even in direct mode", async () => {
    mocks.version.mockResolvedValue(null);
    await expect(action(group)(submission(group))).rejects.toThrow("not+found+or+is+archived");
    expect(create()).not.toHaveBeenCalled();
  });

  it("does not import when the role guard rejects the request", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Staff denied"));
    await expect(action(group)(submission(group))).rejects.toThrow("Staff denied");
    expect(create()).not.toHaveBeenCalled();
  });
});

it("keeps PTC Uncategorized available but requires a PTT Version", async () => {
  const ptc = submission("PTC"); ptc.set("versionId", "uncategorized");
  await expect(importPtcRecordsAction(ptc)).rejects.toThrow("Imported+1");
  expect(mocks.createPtc).toHaveBeenCalledWith({ data: [expect.objectContaining({ versionId: null })] });
  const ptt = submission("PTT"); ptt.set("versionId", "");
  await expect(importPttRecordsAction(ptt)).rejects.toThrow("Choose+a+PTT+Version");
  expect(mocks.createPtt).not.toHaveBeenCalled();
});

describe("preview access", () => {
  it.each([Role.ADMIN, Role.SUPERADMIN, Role.STAFF])("denies a disabled or unauthorized %s request before reading the file", async (role) => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", role });
    const request = { formData: vi.fn() };
    const result = await POST(request as unknown as Request);
    expect(result.status).toBe(403); expect(request.formData).not.toHaveBeenCalled();
  });
  it("allows an assigned Admin to check the workbook", async () => {
    mocks.userHasFeature.mockResolvedValue(true);
    const form = submission("PTC", { bad: true }); form.set("group", "PTC");
    const result = await POST({ formData: async () => form } as unknown as Request);
    expect(result.status).toBe(200);
    expect((await result.json()).errorCount).toBeGreaterThan(0);
  });
});
