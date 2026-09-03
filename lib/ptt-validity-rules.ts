import { Prisma } from "@prisma/client";
import { DEFAULT_PTT_VALIDITY_RULE_CONFIG, normalizePttValidityRuleConfig, type PttValidityRuleConfig } from "@/lib/ptt-checks";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import { prisma } from "@/lib/prisma";

export function defaultPttValidityRuleData(): Omit<Prisma.PttValidityRuleUncheckedCreateInput, "id" | "versionId" | "createdAt" | "updatedAt"> {
  return {
    withinMunicipalityDays: DEFAULT_PTT_VALIDITY_RULE_CONFIG.withinMunicipalityDays,
    withinProvinceDays: DEFAULT_PTT_VALIDITY_RULE_CONFIG.withinProvinceDays,
    withinRegionDays: DEFAULT_PTT_VALIDITY_RULE_CONFIG.withinRegionDays,
    outsideRegionAllowedDays: DEFAULT_PTT_VALIDITY_RULE_CONFIG.outsideRegionAllowedDays
  };
}

export function pttValidityRuleConfig(rule?: {
  withinMunicipalityDays?: number | null;
  withinProvinceDays?: number | null;
  withinRegionDays?: number | null;
  outsideRegionAllowedDays?: Prisma.JsonValue | PttValidityRuleConfig["outsideRegionAllowedDays"] | null;
} | null): PttValidityRuleConfig {
  const rawOutsideDays = Array.isArray(rule?.outsideRegionAllowedDays) ? rule.outsideRegionAllowedDays : undefined;
  return normalizePttValidityRuleConfig({
    withinMunicipalityDays: rule?.withinMunicipalityDays ?? undefined,
    withinProvinceDays: rule?.withinProvinceDays ?? undefined,
    withinRegionDays: rule?.withinRegionDays ?? undefined,
    outsideRegionAllowedDays: rawOutsideDays as number[] | undefined
  });
}

export async function resolvedPttValidityRule(versionId: string) {
  const rule = await prisma.pttValidityRule.findUnique({ where: { versionId } });
  if (rule) return { rule, config: pttValidityRuleConfig(rule) };
  const version = await prisma.ptcVersion.findFirst({ where: { id: versionId, group: PERMIT_GROUP_PTT } });
  if (!version) return { rule: null, config: DEFAULT_PTT_VALIDITY_RULE_CONFIG };
  const created = await prisma.pttValidityRule.create({ data: { versionId, ...defaultPttValidityRuleData() } });
  return { rule: created, config: pttValidityRuleConfig(created) };
}