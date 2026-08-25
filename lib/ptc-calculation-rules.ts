import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PTC_CALCULATION_CONFIG, normalizePtcCalculationConfig, type PtcCalculationConfig } from "@/lib/ptc-checks";

type RuleLike = {
  processingTiers: Prisma.JsonValue;
  additionalProcessingStep: number;
  additionalProcessingFee: unknown;
  applicationFeePerTree: unknown;
  replantingFeePerTree: unknown;
  maxTreesPerPtc: number;
  validityBrackets: Prisma.JsonValue;
};

function decimal(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ruleConfig(rule: RuleLike): PtcCalculationConfig {
  return normalizePtcCalculationConfig({
    processingTiers: rule.processingTiers as PtcCalculationConfig["processingTiers"],
    additionalProcessingStep: rule.additionalProcessingStep,
    additionalProcessingFee: decimal(rule.additionalProcessingFee),
    applicationFeePerTree: decimal(rule.applicationFeePerTree),
    replantingFeePerTree: decimal(rule.replantingFeePerTree),
    maxTreesPerPtc: rule.maxTreesPerPtc,
    validityBrackets: rule.validityBrackets as PtcCalculationConfig["validityBrackets"]
  });
}

export function defaultRuleData() {
  return {
    processingTiers: DEFAULT_PTC_CALCULATION_CONFIG.processingTiers,
    additionalProcessingStep: DEFAULT_PTC_CALCULATION_CONFIG.additionalProcessingStep,
    additionalProcessingFee: DEFAULT_PTC_CALCULATION_CONFIG.additionalProcessingFee,
    applicationFeePerTree: DEFAULT_PTC_CALCULATION_CONFIG.applicationFeePerTree,
    replantingFeePerTree: DEFAULT_PTC_CALCULATION_CONFIG.replantingFeePerTree,
    maxTreesPerPtc: DEFAULT_PTC_CALCULATION_CONFIG.maxTreesPerPtc,
    validityBrackets: DEFAULT_PTC_CALCULATION_CONFIG.validityBrackets
  };
}

export async function resolvedPtcCalculationRule(versionId: string, applicationTypeId: string | null | undefined) {
  const override = applicationTypeId
    ? await prisma.ptcCalculationRule.findFirst({ where: { versionId, applicationTypeId } })
    : null;
  const rule = override || await prisma.ptcCalculationRule.findFirst({ where: { versionId, applicationTypeId: null } });
  if (!rule) throw new Error("No calculation rules are configured for the selected PTC Version.");
  return { rule, config: ruleConfig(rule), usingApplicationTypeOverride: Boolean(override) };
}
