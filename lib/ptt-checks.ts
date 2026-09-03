import { formatNumber } from "@/lib/ptc-checks";

export type PttValidityBasisValue = "WithinMunicipality" | "WithinProvince" | "WithinRegion" | "OutsideRegionInterIsland";
export type PttVehicleCapacityCategoryValue = "SmallerThanJeep" | "Jeep" | "ElfOrSixWheelerTruck" | "ForwardTruck" | "TenWheelerTruck" | "TwelveWheelerAndAbove";

export const PTT_FEE_RATE_PER_BOARD_FOOT = 0.3;

export const PTT_VALIDITY_BASIS_OPTIONS: { value: PttValidityBasisValue; label: string; days?: number }[] = [
  { value: "WithinMunicipality", label: "Within the Municipality", days: 1 },
  { value: "WithinProvince", label: "Within the Province", days: 2 },
  { value: "WithinRegion", label: "Within the Region", days: 3 },
  { value: "OutsideRegionInterIsland", label: "Outside the Region / Inter-Island" }
];

export const PTT_OUTSIDE_REGION_VALIDITY_DAYS = [5, 6, 7] as const;

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

export function pttValidityBasisLabel(value?: string | null) {
  return PTT_VALIDITY_BASIS_OPTIONS.find((option) => option.value === value)?.label || "";
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

export function calculatePttValidity({ validityBasis, outsideRegionValidityDays }: { validityBasis?: string | null; outsideRegionValidityDays?: unknown }) {
  if (!validityBasis) throw new Error("Choose a Validity Basis before calculating validity.");
  if (validityBasis === "OutsideRegionInterIsland") {
    const selectedDays = wholeDay(outsideRegionValidityDays);
    if (!selectedDays || !PTT_OUTSIDE_REGION_VALIDITY_DAYS.includes(selectedDays as typeof PTT_OUTSIDE_REGION_VALIDITY_DAYS[number])) {
      throw new Error("Choose 5, 6, or 7 days for Outside the Region / Inter-Island validity.");
    }
    return { validityBasis, actualValidityDays: selectedDays };
  }
  const option = PTT_VALIDITY_BASIS_OPTIONS.find((item) => item.value === validityBasis);
  if (!option?.days) throw new Error("Choose a valid PTT Validity Basis.");
  return { validityBasis, actualValidityDays: option.days };
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