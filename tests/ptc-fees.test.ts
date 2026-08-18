import { calculatePtcFees, processingFee, validityDaysForTrees } from "@/lib/ptc-fees";
import { describe, expect, it } from "vitest";

describe("standalone PTC fee calculator", () => {
  it("uses the RA 8048 processing fee boundaries", () => {
    expect([1, 5, 6, 50, 51, 100, 101, 500, 501, 1000, 1050].map(processingFee))
      .toEqual([100, 100, 200, 200, 500, 500, 1000, 1000, 2000, 2000, 2200]);
  });

  it("does not charge replanting when seedlings were replanted", () => {
    const result = calculatePtcFees({ trees: 20, replantedSeedlings: true, damagedByNaturalCalamity: false, powerLineCorridor: false });
    expect(result).toMatchObject({ processingFee: 200, applicationFee: 2000, replantingFee: 0, total: 2200 });
  });

  it("charges replanting when seedlings were not replanted", () => {
    const result = calculatePtcFees({ trees: 20, replantedSeedlings: false, damagedByNaturalCalamity: false, powerLineCorridor: false });
    expect(result).toMatchObject({ replantingFee: 2000, total: 4200 });
  });

  it("uses validity brackets and warns when the PTC limit is exceeded", () => {
    expect([1, 20, 21, 50, 51, 100].map(validityDaysForTrees)).toEqual([3, 3, 10, 10, 15, 15]);
    expect(calculatePtcFees({ trees: 101, replantedSeedlings: false, damagedByNaturalCalamity: false, powerLineCorridor: false }))
      .toMatchObject({ ptcCount: 2, validityDays: 15, exceedsSinglePtcLimit: true });
  });

  it("honors the PTC fee exemptions", () => {
    expect(calculatePtcFees({ trees: 10, replantedSeedlings: false, damagedByNaturalCalamity: true, powerLineCorridor: false }))
      .toMatchObject({ exempt: true, total: 0 });
    expect(calculatePtcFees({ trees: 11, replantedSeedlings: false, damagedByNaturalCalamity: true, powerLineCorridor: false }))
      .toMatchObject({ exempt: false });
  });
});
