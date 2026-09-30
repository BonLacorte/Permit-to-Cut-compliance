import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activityCreate: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  clearSession: vi.fn(),
  requireAdmin: mocks.requireAdmin,
  requireSuperadmin: vi.fn(),
  requireUser: vi.fn(),
  setSession: vi.fn(),
  userHasFeature: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pttApplicationRecord: { findMany: mocks.findMany },
    ptcVersion: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction
  }
}));

import { bulkAssignPttApplicationVersionAction, bulkDeletePttApplicationRecordsAction } from "@/app/actions/ptt-records";

function formData(values: Record<string, string | string[]>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(key, item);
  }
  return form;
}

describe("PTT bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
    mocks.transaction.mockImplementation(async (callback) => callback({
      activityLog: { create: mocks.activityCreate },
      pttApplicationRecord: { deleteMany: mocks.deleteMany, update: mocks.update }
    }));
  });

  it("rejects an empty bulk deletion selection", async () => {
    await expect(bulkDeletePttApplicationRecordsAction(formData({ returnTo: "/ptt/applications?region=Region+VIII" })))
      .rejects.toThrow("REDIRECT:");
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("message=Select+at+least+one+PTT+application+to+delete."));
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejects bulk deletion when a selected record is missing or not PTT", async () => {
    mocks.findMany.mockResolvedValue([{ id: "ptt-1" }]);

    await expect(bulkDeletePttApplicationRecordsAction(formData({ pttApplicationRecordIds: ["ptt-1", "ptc-1"] })))
      .rejects.toThrow("REDIRECT:");
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("message=Some+selected+PTT+applications+were+already+deleted+or+are+not+PTT+records."));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an inactive or wrong-group PTT Version", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(bulkAssignPttApplicationVersionAction(formData({ pttApplicationRecordIds: "ptt-1", versionId: "archived-or-ptc" })))
      .rejects.toThrow("REDIRECT:");
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("message=Selected+PTT+Version+was+not+found+or+is+archived."));
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("deletes every verified selected PTT record and logs one bulk event", async () => {
    mocks.findMany.mockResolvedValue([{ id: "ptt-1" }, { id: "ptt-2" }]);

    await expect(bulkDeletePttApplicationRecordsAction(formData({
      pttApplicationRecordIds: ["ptt-1", "ptt-2", "ptt-1"],
      returnTo: "/ptt/applications?region=Region+VIII"
    }))).rejects.toThrow("REDIRECT:");

    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("message=Deleted+2+PTT+applications."));
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["ptt-1", "ptt-2"] }, group: "PTT" } });
    expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "BULK_DELETE_PTT_RECORDS", userId: "admin-1" })
    }));
  });

  it("assigns the selected active PTT Version, records the editor, and logs each record", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ptt-version-2", name: "PTT 2026" });
    mocks.findMany.mockResolvedValue([{ id: "ptt-1", versionId: "ptt-version-1" }, { id: "ptt-2", versionId: null }]);

    await expect(bulkAssignPttApplicationVersionAction(formData({
      pttApplicationRecordIds: ["ptt-1", "ptt-2"],
      versionId: "ptt-version-2"
    }))).rejects.toThrow("REDIRECT:");

    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("message=Assigned+Version+to+2+PTT+applications."));
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      where: { id: "ptt-1" },
      data: { versionId: "ptt-version-2", editedById: "admin-1" }
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      where: { id: "ptt-2" },
      data: { versionId: "ptt-version-2", editedById: "admin-1" }
    });
    expect(mocks.activityCreate).toHaveBeenCalledTimes(2);
  });
});
