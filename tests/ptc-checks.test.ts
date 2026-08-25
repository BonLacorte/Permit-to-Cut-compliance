import { describe, expect, it } from "vitest";
import {
  DEFAULT_PTC_CALCULATION_CONFIG,
  calculatePtcFee,
  calculatePtcValidity,
  feeFinding,
  mergeRemarks,
  normalizePtcCalculationConfig,
  validityFinding
} from "@/lib/ptc-checks";

describe("PTC fee and validity checks", () => {
  it("uses the Version baseline tiers and replanting rule", () => {
    expect(calculatePtcFee({ treesApproved: 50, replantedSeedlings: true, config: DEFAULT_PTC_CALCULATION_CONFIG }))
      .toMatchObject({ processingFee: 200, applicationFee: 5000, replantingFee: 0, actualFee: 5200 });
    expect(calculatePtcFee({ treesApproved: 50, replantedSeedlings: false, config: DEFAULT_PTC_CALCULATION_CONFIG }))
      .toMatchObject({ actualFee: 10200 });
  });

  it("accepts a Type of Application override configuration", () => {
    const override = normalizePtcCalculationConfig({
      ...DEFAULT_PTC_CALCULATION_CONFIG,
      applicationFeePerTree: 75,
      replantingFeePerTree: 25
    });
    expect(calculatePtcFee({ treesApproved: 10, replantedSeedlings: false, config: override }))
      .toMatchObject({ processingFee: 200, applicationFee: 750, replantingFee: 250, actualFee: 1200 });
  });

  it("blocks fee calculation until replanted seedlings is selected", () => {
    expect(() => calculatePtcFee({ treesApproved: 10, replantedSeedlings: null, config: DEFAULT_PTC_CALCULATION_CONFIG }))
      .toThrow("Choose Yes or No for Replanted Seedlings");
  });

  it("uses every validity bracket and flags an individual PTC above the limit", () => {
    expect(calculatePtcValidity({ treesApproved: 20, config: DEFAULT_PTC_CALCULATION_CONFIG })).toMatchObject({ actualValidityDays: 3, exceedsSinglePtcLimit: false });
    expect(calculatePtcValidity({ treesApproved: 50, config: DEFAULT_PTC_CALCULATION_CONFIG })).toMatchObject({ actualValidityDays: 10, exceedsSinglePtcLimit: false });
    expect(calculatePtcValidity({ treesApproved: 100, config: DEFAULT_PTC_CALCULATION_CONFIG })).toMatchObject({ actualValidityDays: 15, exceedsSinglePtcLimit: false });
    expect(calculatePtcValidity({ treesApproved: 101, config: DEFAULT_PTC_CALCULATION_CONFIG })).toMatchObject({ actualValidityDays: 15, exceedsSinglePtcLimit: true });
  });

  it("generates findings only while values do not match and preserves manual remarks separately", () => {
    expect(feeFinding(900, 1200)).toBe("Fees unmatched, the recorded fee of 900 should be 1,200.");
    expect(feeFinding(1200, 1200)).toBeNull();
    const validity = calculatePtcValidity({ treesApproved: 101, config: DEFAULT_PTC_CALCULATION_CONFIG });
    expect(validityFinding(10, validity)).toContain("recorded validity of 10 days should be 15 days");
    expect(validityFinding(10, calculatePtcValidity({ treesApproved: 50, config: DEFAULT_PTC_CALCULATION_CONFIG }))).toBeNull();
    expect(mergeRemarks("Manual note", [feeFinding(900, 1200)])).toContain("Manual note\n\nFees unmatched");
  });
});
