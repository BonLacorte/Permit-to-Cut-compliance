export type ProcessingTier = { upTo: number; fee: number };
export type ValidityBracket = { upTo: number; days: number };

export type PtcCalculationConfig = {
  processingTiers: ProcessingTier[];
  additionalProcessingStep: number;
  additionalProcessingFee: number;
  applicationFeePerTree: number;
  replantingFeePerTree: number;
  maxTreesPerPtc: number;
  validityBrackets: ValidityBracket[];
};

export const DEFAULT_PTC_CALCULATION_CONFIG: PtcCalculationConfig = {
  processingTiers: [
    { upTo: 5, fee: 100 },
    { upTo: 50, fee: 200 },
    { upTo: 100, fee: 500 },
    { upTo: 500, fee: 1000 },
    { upTo: 1000, fee: 2000 }
  ],
  additionalProcessingStep: 50,
  additionalProcessingFee: 200,
  applicationFeePerTree: 100,
  replantingFeePerTree: 100,
  maxTreesPerPtc: 100,
  validityBrackets: [
    { upTo: 20, days: 3 },
    { upTo: 50, days: 10 },
    { upTo: 100, days: 15 }
  ]
};

function decimal(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Math.trunc(decimal(value, fallback));
  return parsed > 0 ? parsed : fallback;
}

function normalizedTiers(raw: unknown): ProcessingTier[] {
  if (!Array.isArray(raw)) return DEFAULT_PTC_CALCULATION_CONFIG.processingTiers;
  const tiers = raw
    .map((item) => ({ upTo: positiveInteger((item as ProcessingTier)?.upTo, 0), fee: Math.max(0, decimal((item as ProcessingTier)?.fee)) }))
    .filter((item) => item.upTo > 0)
    .sort((a, b) => a.upTo - b.upTo);
  return tiers.length > 0 ? tiers : DEFAULT_PTC_CALCULATION_CONFIG.processingTiers;
}

function normalizedBrackets(raw: unknown): ValidityBracket[] {
  if (!Array.isArray(raw)) return DEFAULT_PTC_CALCULATION_CONFIG.validityBrackets;
  const brackets = raw
    .map((item) => ({ upTo: positiveInteger((item as ValidityBracket)?.upTo, 0), days: positiveInteger((item as ValidityBracket)?.days, 0) }))
    .filter((item) => item.upTo > 0 && item.days > 0)
    .sort((a, b) => a.upTo - b.upTo);
  return brackets.length > 0 ? brackets : DEFAULT_PTC_CALCULATION_CONFIG.validityBrackets;
}

export function normalizePtcCalculationConfig(raw: Partial<PtcCalculationConfig>): PtcCalculationConfig {
  return {
    processingTiers: normalizedTiers(raw.processingTiers),
    additionalProcessingStep: positiveInteger(raw.additionalProcessingStep, DEFAULT_PTC_CALCULATION_CONFIG.additionalProcessingStep),
    additionalProcessingFee: Math.max(0, decimal(raw.additionalProcessingFee, DEFAULT_PTC_CALCULATION_CONFIG.additionalProcessingFee)),
    applicationFeePerTree: Math.max(0, decimal(raw.applicationFeePerTree, DEFAULT_PTC_CALCULATION_CONFIG.applicationFeePerTree)),
    replantingFeePerTree: Math.max(0, decimal(raw.replantingFeePerTree, DEFAULT_PTC_CALCULATION_CONFIG.replantingFeePerTree)),
    maxTreesPerPtc: positiveInteger(raw.maxTreesPerPtc, DEFAULT_PTC_CALCULATION_CONFIG.maxTreesPerPtc),
    validityBrackets: normalizedBrackets(raw.validityBrackets)
  };
}

export function processingFeeFromConfig(treesApproved: number, config: PtcCalculationConfig) {
  if (treesApproved <= 0) return 0;
  const tier = config.processingTiers.find((item) => treesApproved <= item.upTo);
  if (tier) return tier.fee;
  const lastTier = config.processingTiers[config.processingTiers.length - 1];
  return lastTier.fee + Math.floor((treesApproved - lastTier.upTo) / config.additionalProcessingStep) * config.additionalProcessingFee;
}

export function calculatePtcFee({ treesApproved, replantedSeedlings, config }: {
  treesApproved: number | null | undefined;
  replantedSeedlings: boolean | null | undefined;
  config: PtcCalculationConfig;
}) {
  const trees = Math.max(0, Math.trunc(decimal(treesApproved)));
  if (trees <= 0) throw new Error("Enter a number of approved trees greater than zero before calculating fees.");
  if (replantedSeedlings === null || replantedSeedlings === undefined) {
    throw new Error("Choose Yes or No for Replanted Seedlings before calculating fees.");
  }
  const processingFee = processingFeeFromConfig(trees, config);
  const applicationFee = trees * config.applicationFeePerTree;
  // A farmer who has already replanted does not pay the replacement fee.
  const replantingFee = replantedSeedlings ? 0 : trees * config.replantingFeePerTree;
  return { treesApproved: trees, processingFee, applicationFee, replantingFee, actualFee: processingFee + applicationFee + replantingFee };
}

export function calculatePtcValidity({ treesApproved, config }: { treesApproved: number | null | undefined; config: PtcCalculationConfig }) {
  const trees = Math.max(0, Math.trunc(decimal(treesApproved)));
  if (trees <= 0) throw new Error("Enter a number of approved trees greater than zero before calculating validity.");
  const bracket = config.validityBrackets.find((item) => trees <= item.upTo) || config.validityBrackets[config.validityBrackets.length - 1];
  return { treesApproved: trees, actualValidityDays: bracket.days, exceedsSinglePtcLimit: trees > config.maxTreesPerPtc, maxTreesPerPtc: config.maxTreesPerPtc };
}

export function feeFinding(recordedFee: number | null | undefined, actualFee: number) {
  const recorded = decimal(recordedFee);
  if (recorded === actualFee) return null;
  return `Fees unmatched, the recorded fee of ${formatNumber(recorded)} should be ${formatNumber(actualFee)}.`;
}

export function validityFinding(recordedValidityDays: number | null | undefined, result: ReturnType<typeof calculatePtcValidity>) {
  const findings: string[] = [];
  const recorded = recordedValidityDays === null || recordedValidityDays === undefined ? null : Math.trunc(decimal(recordedValidityDays));
  if (recorded !== result.actualValidityDays) {
    findings.push(`Validity unmatched, the recorded validity of ${recorded === null ? "Blank" : `${recorded} day${recorded === 1 ? "" : "s"}`} should be ${result.actualValidityDays} day${result.actualValidityDays === 1 ? "" : "s"}.`);
  }
  if (result.exceedsSinglePtcLimit) {
    findings.push(`PTC exceeds the ${result.maxTreesPerPtc}-tree limit for an individual permit.`);
  }
  return findings.length > 0 ? findings.join(" ") : null;
}

export function mergeRemarks(manualRemarks: string | null | undefined, findings: Array<string | null | undefined>) {
  return [manualRemarks?.trim(), ...findings.map((finding) => finding?.trim()).filter(Boolean)].filter(Boolean).join("\n\n");
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
