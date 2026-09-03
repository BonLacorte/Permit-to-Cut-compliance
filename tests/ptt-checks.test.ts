import { describe, expect, it } from "vitest";
import { calculatePttFee, calculatePttValidity, checkPttVehicleCapacity, normalizePttValidityRuleConfig, pttCapacityMaxFromCategory, pttFeeFinding, pttValidityBasisOptions, pttValidityFinding } from "@/lib/ptt-checks";

describe("PTT assisted checkers", () => {
  it("calculates transport fee from board-foot volume", () => {
    expect(calculatePttFee({ volumeBoardFeet: 10000 })).toMatchObject({
      volumeBoardFeet: 10000,
      ratePerBoardFoot: 0.3,
      actualFee: 3000
    });
  });

  it("blocks fee calculation when volume is blank or invalid", () => {
    expect(() => calculatePttFee({ volumeBoardFeet: null })).toThrow(/volume/i);
    expect(() => calculatePttFee({ volumeBoardFeet: 0 })).toThrow(/volume/i);
  });

  it("creates and clears fee mismatch findings", () => {
    expect(pttFeeFinding(2250, 3000)).toBe("PTT fee unmatched, the recorded fee of 2,250 should be 3,000.");
    expect(pttFeeFinding(3000, 3000)).toBeNull();
  });

  it("calculates validity from destination basis", () => {
    expect(calculatePttValidity({ validityBasis: "WithinMunicipality" }).actualValidityDays).toBe(1);
    expect(calculatePttValidity({ validityBasis: "WithinProvince" }).actualValidityDays).toBe(2);
    expect(calculatePttValidity({ validityBasis: "WithinRegion" }).actualValidityDays).toBe(3);
    expect(calculatePttValidity({ validityBasis: "OutsideRegionInterIsland", outsideRegionValidityDays: 6 }).actualValidityDays).toBe(6);
  });

  it("requires a specific 5, 6, or 7 day choice for outside region validity", () => {
    expect(() => calculatePttValidity({ validityBasis: "OutsideRegionInterIsland" })).toThrow(/5, 6, or 7/);
    expect(() => calculatePttValidity({ validityBasis: "OutsideRegionInterIsland", outsideRegionValidityDays: 8 })).toThrow(/5, 6, or 7/);
  });

  it("uses configurable per-version validity rule values", () => {
    const config = normalizePttValidityRuleConfig({
      withinMunicipalityDays: 2,
      withinProvinceDays: 4,
      withinRegionDays: 6,
      outsideRegionAllowedDays: [8, 10]
    });
    expect(calculatePttValidity({ validityBasis: "WithinMunicipality", config }).actualValidityDays).toBe(2);
    expect(calculatePttValidity({ validityBasis: "WithinProvince", config }).actualValidityDays).toBe(4);
    expect(calculatePttValidity({ validityBasis: "WithinRegion", config }).actualValidityDays).toBe(6);
    expect(calculatePttValidity({ validityBasis: "OutsideRegionInterIsland", outsideRegionValidityDays: 10, config }).actualValidityDays).toBe(10);
    expect(() => calculatePttValidity({ validityBasis: "OutsideRegionInterIsland", outsideRegionValidityDays: 7, config })).toThrow(/8, or 10/);
  });

  it("labels validity basis options from configured rules", () => {
    const labels = pttValidityBasisOptions({ withinMunicipalityDays: 2, withinProvinceDays: 4, withinRegionDays: 6, outsideRegionAllowedDays: [8, 10] }).map((option) => option.label);
    expect(labels).toContain("Within the Municipality (2 days)");
    expect(labels).toContain("Within the Province (4 days)");
    expect(labels).toContain("Within the Region (6 days)");
    expect(labels).toContain("Outside the Region / Inter-Island (8, or 10 days)");
  });

  it("creates and clears validity mismatch findings", () => {
    const result = calculatePttValidity({ validityBasis: "WithinRegion" });
    expect(pttValidityFinding(2, result)).toBe("PTT validity unmatched, the recorded validity of 2 days should be 3 days.");
    expect(pttValidityFinding(3, result)).toBeNull();
  });

  it("checks mapped vehicle capacity and reports excess volume", () => {
    const excess = checkPttVehicleCapacity({ volumeBoardFeet: 4500, transportType: "Six wheeler/forward", maxBoardFeet: 4000 });
    expect(excess.finding).toBe("Volume of boardfeet (4,500) exceeds the maximum capacity of the Type of Transport used (4,000).");
    expect(excess.withinCapacity).toBe(false);

    const ok = checkPttVehicleCapacity({ volumeBoardFeet: 3500, transportType: "Six wheeler/forward", maxBoardFeet: 4000 });
    expect(ok.finding).toBeNull();
    expect(ok.withinCapacity).toBe(true);
  });

  it("uses a custom max board-foot value over the category default", () => {
    expect(pttCapacityMaxFromCategory("Jeep")).toBe(3500);
    const custom = checkPttVehicleCapacity({ volumeBoardFeet: 4200, transportType: "Jeep with trailer", maxBoardFeet: 5000 });
    expect(custom.maxBoardFeet).toBe(5000);
    expect(custom.finding).toBeNull();
    expect(custom.withinCapacity).toBe(true);
  });

  it("warns instead of guessing when transport capacity is unmapped", () => {
    const result = checkPttVehicleCapacity({ volumeBoardFeet: 3500, transportType: "Wing Van", maxBoardFeet: null });
    expect(result.warning).toBe("No vehicle capacity rule is configured for Wing Van.");
    expect(result.finding).toBeNull();
    expect(result.withinCapacity).toBeNull();
  });
});
