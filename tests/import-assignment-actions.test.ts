import { beforeEach, expect, it, vi } from "vitest";
import { FeatureKey, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), upsert: vi.fn(), log: vi.fn(), transaction: vi.fn(), revalidate: vi.fn()
}));
vi.mock("@/lib/auth", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique }, $transaction: mocks.transaction } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error(url), { digest: "NEXT_REDIRECT" }); } }));
import { updateImportCheckerAccessAction, updateUserFeatureAccessAction } from "@/app/actions/users";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperadmin.mockResolvedValue({ id: "super" });
  mocks.findUnique.mockResolvedValue({ id: "super", role: Role.SUPERADMIN });
  mocks.transaction.mockImplementation(async (fn) => fn({
    userFeatureAccess: { deleteMany: mocks.deleteMany, createMany: mocks.createMany, upsert: mocks.upsert },
    activityLog: { create: mocks.log }
  }));
});

it("lets Superadmin enable their own Import Checker without replacing any other assignment", async () => {
  const form = new FormData(); form.set("userId", "super"); form.set("importChecker", "on");
  await expect(updateImportCheckerAccessAction(form)).rejects.toThrow("Import+Checker+setting+updated");
  expect(mocks.upsert).toHaveBeenCalledWith({ where: { userId_feature: { userId: "super", feature: FeatureKey.IMPORT_CHECKER } }, create: { userId: "super", feature: FeatureKey.IMPORT_CHECKER }, update: {} });
  expect(mocks.deleteMany).not.toHaveBeenCalled();
  expect(mocks.log).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "UPDATE_IMPORT_CHECKER_ACCESS", metadata: { enabled: true } }) });
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/master-data");
});

it("disables only the import assignment for an Admin", async () => {
  mocks.findUnique.mockResolvedValue({ id: "admin", role: Role.ADMIN });
  const form = new FormData(); form.set("userId", "admin");
  await expect(updateImportCheckerAccessAction(form)).rejects.toThrow("Import+Checker+setting+updated");
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin", feature: FeatureKey.IMPORT_CHECKER } });
  expect(mocks.createMany).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
});

it("preserves Import Checker when saving the other checker features", async () => {
  mocks.findUnique.mockResolvedValue({ id: "admin", role: Role.ADMIN });
  const form = new FormData(); form.set("userId", "admin"); form.set("ptcFeesChecker", "on");
  await expect(updateUserFeatureAccessAction(form)).rejects.toThrow("Feature+access+updated");
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin", feature: { not: FeatureKey.IMPORT_CHECKER } } });
  expect(mocks.createMany).toHaveBeenCalledWith({ data: [{ userId: "admin", feature: FeatureKey.PTC_FEES_CHECKER }] });
});

it("rejects assigning Import Checker to Staff", async () => {
  mocks.findUnique.mockResolvedValue({ id: "staff", role: Role.STAFF });
  const form = new FormData(); form.set("userId", "staff"); form.set("importChecker", "on");
  await expect(updateImportCheckerAccessAction(form)).rejects.toThrow("only+be+assigned");
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("does not allow a non-Superadmin to modify assignment", async () => {
  mocks.requireSuperadmin.mockRejectedValue(new Error("Superadmin required"));
  await expect(updateImportCheckerAccessAction(new FormData())).rejects.toThrow("Superadmin required");
  expect(mocks.transaction).not.toHaveBeenCalled();
});
