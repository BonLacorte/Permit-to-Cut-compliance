import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), transaction: vi.fn(), permission: vi.fn(), preview: vi.fn(), commit: vi.fn(), revalidate: vi.fn(), reports: vi.fn(), ptt: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/duplicate-review", () => ({ assertDuplicatePermission: mocks.permission, buildMergePreview: mocks.preview, commitDuplicateMerge: mocks.commit, jsonSnapshot: (value: unknown) => value, displayMergeRecord: (value: unknown) => value }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/app/actions/_shared", () => ({ revalidateReports: mocks.reports, revalidatePttApplications: mocks.ptt }));
import { previewDuplicateMergeAction, mergeDuplicateRecordsAction } from "@/app/actions/duplicates";
const selection = { group: "PTT", keeperId: "keep", deleteIds: ["donor"], transfers: [] };
beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ id: "actor" }); mocks.transaction.mockImplementation(async (callback) => callback({})); mocks.permission.mockResolvedValue(undefined); mocks.preview.mockResolvedValue({ digest: "fresh", final: { id: "keep" }, evaluated: { checks: [] } }); mocks.commit.mockResolvedValue({ keeperId: "keep", group: "PTT", deleteIds: ["donor"] }); });
it("requires authentication on both direct server actions", async () => {
  mocks.requireUser.mockRejectedValue(new Error("Login required"));
  await expect(previewDuplicateMergeAction(selection)).rejects.toThrow("Login required");
  await expect(mergeDuplicateRecordsAction(selection, "fresh")).rejects.toThrow("Login required");
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("rechecks preview authorization instead of trusting browser visibility", async () => {
  mocks.permission.mockRejectedValue(new Error("Not assigned"));
  expect(await previewDuplicateMergeAction(selection)).toEqual({ error: "Not assigned" }); expect(mocks.preview).not.toHaveBeenCalled();
});
it("validates selection before opening a transaction", async () => {
  expect(await mergeDuplicateRecordsAction({ ...selection, deleteIds: [] }, "fresh")).toHaveProperty("error");
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("commits with serializable isolation and revalidates all affected views and details", async () => {
  expect(await mergeDuplicateRecordsAction(selection, "fresh")).toEqual({ success: true, keeperId: "keep" });
  expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  expect(mocks.commit).toHaveBeenCalledWith({}, "actor", selection, "fresh");
  expect(mocks.reports).toHaveBeenCalled(); expect(mocks.ptt).toHaveBeenCalled(); expect(mocks.revalidate).toHaveBeenCalledWith("/ptt/dashboard");
  expect(mocks.revalidate).toHaveBeenCalledWith("/ptt/applications/donor", "layout");
});
it("returns a reload instruction after a serialization conflict without retrying deletions", async () => {
  mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "5.22.0" }));
  const result = await mergeDuplicateRecordsAction(selection, "fresh"); expect(result.error).toContain("Reload"); expect(mocks.transaction).toHaveBeenCalledTimes(1); expect(mocks.revalidate).not.toHaveBeenCalled();
});
