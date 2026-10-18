import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureKey, Role } from "@prisma/client";

const db = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { userFeatureAccess: db } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { getUserFeatureKeys, userHasFeature } from "@/lib/auth";

beforeEach(() => { vi.clearAllMocks(); db.count.mockResolvedValue(0); db.findMany.mockResolvedValue([]); });

describe("assignable Import Checker", () => {
  it.each([Role.ADMIN, Role.SUPERADMIN])("requires explicit Duplicate Management assignment for %s", async (role) => {
    const user = { id: "user", role };
    expect(await userHasFeature(user, FeatureKey.DUPLICATE_MANAGEMENT)).toBe(false);
    db.count.mockResolvedValue(1);
    expect(await userHasFeature(user, FeatureKey.DUPLICATE_MANAGEMENT)).toBe(true);
    expect((await getUserFeatureKeys(user.id, role)).has(FeatureKey.DUPLICATE_MANAGEMENT)).toBe(false);
  });
  it("denies Duplicate Management to Staff despite an assignment", async () => {
    db.count.mockResolvedValue(1); db.findMany.mockResolvedValue([{ feature: FeatureKey.DUPLICATE_MANAGEMENT }]);
    expect(await userHasFeature({ id: "staff", role: Role.STAFF }, FeatureKey.DUPLICATE_MANAGEMENT)).toBe(false);
    expect((await getUserFeatureKeys("staff", Role.STAFF)).has(FeatureKey.DUPLICATE_MANAGEMENT)).toBe(false);
  });
  it.each([Role.ADMIN, Role.SUPERADMIN])("is off by default and requires an explicit assignment for %s", async (role) => {
    const user = { id: "user-1", role };
    expect(await userHasFeature(user, FeatureKey.IMPORT_CHECKER)).toBe(false);
    db.count.mockResolvedValue(1);
    expect(await userHasFeature(user, FeatureKey.IMPORT_CHECKER)).toBe(true);
    expect(db.count).toHaveBeenLastCalledWith({ where: { userId: user.id, feature: FeatureKey.IMPORT_CHECKER } });
  });

  it("preserves automatic Superadmin access to the other checkers", async () => {
    const user = { id: "super", role: Role.SUPERADMIN };
    for (const feature of Object.values(FeatureKey).filter((key) => key !== FeatureKey.IMPORT_CHECKER && key !== FeatureKey.DUPLICATE_MANAGEMENT)) {
      expect(await userHasFeature(user, feature)).toBe(true);
    }
    expect(db.count).not.toHaveBeenCalled();
    const features = await getUserFeatureKeys(user.id, user.role);
    expect(features.has(FeatureKey.PTT_FEES_CHECKER)).toBe(true);
    expect(features.has(FeatureKey.IMPORT_CHECKER)).toBe(false);
    db.findMany.mockResolvedValue([{ feature: FeatureKey.IMPORT_CHECKER }]);
    expect((await getUserFeatureKeys(user.id, user.role)).has(FeatureKey.IMPORT_CHECKER)).toBe(true);
  });

  it("never enables Import Checker for Staff, even if a stale assignment exists", async () => {
    db.count.mockResolvedValue(1);
    db.findMany.mockResolvedValue([{ feature: FeatureKey.IMPORT_CHECKER }]);
    expect(await userHasFeature({ id: "staff", role: Role.STAFF }, FeatureKey.IMPORT_CHECKER)).toBe(false);
    expect(db.count).not.toHaveBeenCalled();
    expect((await getUserFeatureKeys("staff", Role.STAFF)).has(FeatureKey.IMPORT_CHECKER)).toBe(false);
  });
});
