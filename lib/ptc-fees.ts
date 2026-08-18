export const DEFAULT_REPLACEMENT_FEE_RATE = 50;

export type ReplacementFeeRate = 50 | 100;

export type PtcFeeInput = {
  trees: number;
  replantedSeedlings: boolean;
  replacementFeeRate: ReplacementFeeRate;
  damagedByNaturalCalamity: boolean;
  powerLineCorridor: boolean;
};

export type PtcFeeResult = {
  exempt: boolean;
  exemptionReason?: string;
  ptcCount: number;
  processingFee: number;
  applicationFee: number;
  replantingFee: number;
  total: number;
  validityDays: number | null;
  exceedsSinglePtcLimit: boolean;
  recommendingAuthority: string;
  approvingAuthority: string;
};

export function processingFee(trees: number) {
  if (trees <= 0) return 0;
  if (trees <= 5) return 100;
  if (trees <= 50) return 200;
  if (trees <= 100) return 500;
  if (trees <= 500) return 1000;
  if (trees <= 1000) return 2000;
  return 2000 + Math.floor((trees - 1000) / 50) * 200;
}

function authority(trees: number) {
  if (trees <= 1000) return { recommendingAuthority: "Agriculturist/SA", approvingAuthority: "Division Chief I" };
  if (trees <= 2500) return { recommendingAuthority: "Regional Manager", approvingAuthority: "Division Chief I" };
  return { recommendingAuthority: "Regional Manager", approvingAuthority: "Administrator" };
}

export function validityDaysForTrees(trees: number) {
  if (trees <= 0) return null;
  if (trees <= 20) return 3;
  if (trees <= 50) return 10;
  return 15;
}

export function calculatePtcFees(input: PtcFeeInput): PtcFeeResult {
  const trees = Number.isFinite(input.trees) ? Math.max(0, Math.trunc(input.trees)) : 0;
  const naturalCalamityExempt = input.damagedByNaturalCalamity && trees <= 10;
  const exempt = input.powerLineCorridor || naturalCalamityExempt;
  const exemptionReason = input.powerLineCorridor
    ? "Power Line Corridor applications are exempt from PTC fees."
    : naturalCalamityExempt
      ? "Natural-calamity cases of ten trees or fewer have no applicable PTC fees."
      : undefined;
  const authorities = authority(trees);

  if (exempt) {
    return {
      exempt: true,
      exemptionReason,
      ptcCount: trees === 0 ? 0 : Math.ceil(trees / 100),
      processingFee: 0,
      applicationFee: 0,
      replantingFee: 0,
      total: 0,
      validityDays: null,
      exceedsSinglePtcLimit: trees > 100,
      ...authorities
    };
  }

  const processing = processingFee(trees);
  const application = trees * 100;
  const replanting = input.replantedSeedlings ? 0 : trees * input.replacementFeeRate;

  return {
    exempt: false,
    ptcCount: trees === 0 ? 0 : Math.ceil(trees / 100),
    processingFee: processing,
    applicationFee: application,
    replantingFee: replanting,
    total: processing + application + replanting,
    validityDays: validityDaysForTrees(trees),
    exceedsSinglePtcLimit: trees > 100,
    ...authorities
  };
}
