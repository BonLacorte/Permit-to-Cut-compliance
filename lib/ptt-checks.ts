import { formatNumber } from "@/lib/ptc-checks";

export type PttValidityBasisValue = "WithinMunicipality" | "WithinProvince" | "WithinRegion" | "OutsideRegionInterIsland";
export type PttVehicleCapacityCategoryValue = "SmallerThanJeep" | "Jeep" | "ElfOrSixWheelerTruck" | "ForwardTruck" | "TenWheelerTruck" | "TwelveWheelerAndAbove";
export type PttValidityRuleConfig = {
  withinMunicipalityDays: number;
  withinProvinceDays: number;
  withinRegionDays: number;
  outsideRegionAllowedDays: number[];
};

export const PTT_FEE_RATE_PER_BOARD_FOOT = 0.3;

export const DEFAULT_PTT_VALIDITY_RULE_CONFIG: PttValidityRuleConfig = {
  withinMunicipalityDays: 1,
  withinProvinceDays: 2,
  withinRegionDays: 3,
  outsideRegionAllowedDays: [5, 6, 7]
};

export const PTT_VEHICLE_CAPACITY_OPTIONS: { value: PttVehicleCapacityCategoryValue; label: string; maxBoardFeet: number }[] = [
  { value: "SmallerThanJeep", label: "Smaller than a Jeep", maxBoardFeet: 2000 },
  { value: "Jeep", label: "Jeep", maxBoardFeet: 3500 },
  { value: "ElfOrSixWheelerTruck", label: "Elf or Six-Wheeler Truck", maxBoardFeet: 4000 },
  { value: "ForwardTruck", label: "Forward Truck", maxBoardFeet: 7000 },
  { value: "TenWheelerTruck", label: "Ten-Wheeler Truck", maxBoardFeet: 12000 },
  { value: "TwelveWheelerAndAbove", label: "Twelve-Wheeler and above", maxBoardFeet: 18000 }
];

function decimal(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function wholeDay(value: unknown) {
  const parsed = Math.trunc(decimal(value, 0));
  return parsed > 0 ? parsed : null;
}

function positiveDay(value: unknown, fallback: number) {
  return wholeDay(value) ?? fallback;
}

function allowedDaysLabel(days: number[]) {
  if (days.length === 0) return "configured days";
  if (days.length === 1) return `${days[0]} day${days[0] === 1 ? "" : "s"}`;
  return `${days.slice(0, -1).join(", ")}, or ${days[days.length - 1]} days`;
}

export function normalizePttValidityRuleConfig(value?: Partial<PttValidityRuleConfig> | null): PttValidityRuleConfig {
  const outsideDays = Array.isArray(value?.outsideRegionAllowedDays)
    ? value.outsideRegionAllowedDays.map((day) => wholeDay(day)).filter((day): day is number => day !== null)
    : DEFAULT_PTT_VALIDITY_RULE_CONFIG.outsideRegionAllowedDays;
  const uniqueOutsideDays = Array.from(new Set(outsideDays)).sort((a, b) => a - b);
  return {
    withinMunicipalityDays: positiveDay(value?.withinMunicipalityDays, DEFAULT_PTT_VALIDITY_RULE_CONFIG.withinMunicipalityDays),
    withinProvinceDays: positiveDay(value?.withinProvinceDays, DEFAULT_PTT_VALIDITY_RULE_CONFIG.withinProvinceDays),
    withinRegionDays: positiveDay(value?.withinRegionDays, DEFAULT_PTT_VALIDITY_RULE_CONFIG.withinRegionDays),
    outsideRegionAllowedDays: uniqueOutsideDays.length > 0 ? uniqueOutsideDays : DEFAULT_PTT_VALIDITY_RULE_CONFIG.outsideRegionAllowedDays
  };
}

export function pttOutsideRegionValidityDays(config?: Partial<PttValidityRuleConfig> | null) {
  return normalizePttValidityRuleConfig(config).outsideRegionAllowedDays;
}

export function pttValidityBasisOptions(config?: Partial<PttValidityRuleConfig> | null): { value: PttValidityBasisValue; label: string; days?: number }[] {
  const rule = normalizePttValidityRuleConfig(config);
  return [
    { value: "WithinMunicipality", label: `Within the Municipality (${rule.withinMunicipalityDays} day${rule.withinMunicipalityDays === 1 ? "" : "s"})`, days: rule.withinMunicipalityDays },
    { value: "WithinProvince", label: `Within the Province (${rule.withinProvinceDays} day${rule.withinProvinceDays === 1 ? "" : "s"})`, days: rule.withinProvinceDays },
    { value: "WithinRegion", label: `Within the Region (${rule.withinRegionDays} day${rule.withinRegionDays === 1 ? "" : "s"})`, days: rule.withinRegionDays },
    { value: "OutsideRegionInterIsland", label: `Outside the Region / Inter-Island (${allowedDaysLabel(rule.outsideRegionAllowedDays)})` }
  ];
}

export const PTT_VALIDITY_BASIS_OPTIONS = pttValidityBasisOptions(DEFAULT_PTT_VALIDITY_RULE_CONFIG);
export const PTT_OUTSIDE_REGION_VALIDITY_DAYS = DEFAULT_PTT_VALIDITY_RULE_CONFIG.outsideRegionAllowedDays;

export function pttValidityBasisLabel(value?: string | null, _config?: Partial<PttValidityRuleConfig> | null) {
  if (value === "WithinMunicipality") return "Within the Municipality";
  if (value === "WithinProvince") return "Within the Province";
  if (value === "WithinRegion") return "Within the Region";
  if (value === "OutsideRegionInterIsland") return "Outside the Region / Inter-Island";
  return "";
}

export function pttCapacityCategoryLabel(value?: string | null) {
  return PTT_VEHICLE_CAPACITY_OPTIONS.find((option) => option.value === value)?.label || "";
}

export function pttCapacityMaxFromCategory(value?: string | null) {
  return PTT_VEHICLE_CAPACITY_OPTIONS.find((option) => option.value === value)?.maxBoardFeet ?? null;
}

export function calculatePttFee({ volumeBoardFeet, ratePerBoardFoot = PTT_FEE_RATE_PER_BOARD_FOOT }: { volumeBoardFeet: unknown; ratePerBoardFoot?: number }) {
  const volume = decimal(volumeBoardFeet);
  if (volume <= 0) throw new Error("Enter Volume of Lumber to be Transported greater than zero before calculating fees.");
  const actualFee = money(volume * ratePerBoardFoot);
  return { volumeBoardFeet: volume, ratePerBoardFoot, actualFee };
}

export function pttFeeFinding(recordedFee: unknown, actualFee: number) {
  const recorded = money(decimal(recordedFee));
  if (recorded === actualFee) return null;
  return `PTT fee unmatched, the recorded fee of ${formatNumber(recorded)} should be ${formatNumber(actualFee)}.`;
}

export function calculatePttValidity({ validityBasis, outsideRegionValidityDays, config }: { validityBasis?: string | null; outsideRegionValidityDays?: unknown; config?: Partial<PttValidityRuleConfig> | null }) {
  const rule = normalizePttValidityRuleConfig(config);
  if (!validityBasis) throw new Error("Choose a Validity Basis before calculating validity.");
  if (validityBasis === "OutsideRegionInterIsland") {
    const selectedDays = wholeDay(outsideRegionValidityDays);
    if (!selectedDays || !rule.outsideRegionAllowedDays.includes(selectedDays)) {
      throw new Error(`Choose ${allowedDaysLabel(rule.outsideRegionAllowedDays)} for Outside the Region / Inter-Island validity.`);
    }
    return { validityBasis, actualValidityDays: selectedDays };
  }
  if (validityBasis === "WithinMunicipality") return { validityBasis, actualValidityDays: rule.withinMunicipalityDays };
  if (validityBasis === "WithinProvince") return { validityBasis, actualValidityDays: rule.withinProvinceDays };
  if (validityBasis === "WithinRegion") return { validityBasis, actualValidityDays: rule.withinRegionDays };
  throw new Error("Choose a valid PTT Validity Basis.");
}

export function pttValidityFinding(recordedValidityDays: unknown, result: ReturnType<typeof calculatePttValidity>) {
  const recorded = wholeDay(recordedValidityDays);
  if (recorded === result.actualValidityDays) return null;
  return `PTT validity unmatched, the recorded validity of ${recorded === null ? "Blank" : `${recorded} day${recorded === 1 ? "" : "s"}`} should be ${result.actualValidityDays} day${result.actualValidityDays === 1 ? "" : "s"}.`;
}

export function checkPttVehicleCapacity({ volumeBoardFeet, transportType, maxBoardFeet }: { volumeBoardFeet: unknown; transportType?: string | null; maxBoardFeet?: unknown }) {
  const typeName = String(transportType || "").trim();
  if (!typeName) throw new Error("Choose a Type of Transport Used before checking vehicle capacity.");
  const volume = decimal(volumeBoardFeet);
  if (volume <= 0) throw new Error("Enter Volume of Lumber to be Transported greater than zero before checking vehicle capacity.");
  const max = maxBoardFeet === null || maxBoardFeet === undefined || String(maxBoardFeet).trim() === "" ? null : decimal(maxBoardFeet);
  if (!max || max <= 0) {
    return {
      transportType: typeName,
      volumeBoardFeet: volume,
      maxBoardFeet: null,
      withinCapacity: null as boolean | null,
      warning: `No vehicle capacity rule is configured for ${typeName}.`,
      finding: null as string | null
    };
  }
  const withinCapacity = volume <= max;
  return {
    transportType: typeName,
    volumeBoardFeet: volume,
    maxBoardFeet: max,
    withinCapacity,
    warning: null as string | null,
    finding: withinCapacity ? null : `Volume of boardfeet (${formatNumber(volume)}) exceeds the maximum capacity of the Type of Transport used (${formatNumber(max)}).`
  };
}