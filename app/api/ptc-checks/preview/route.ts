import { FeatureKey } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, userHasFeature } from "@/lib/auth";
import { calculatePtcFee, calculatePtcValidity, feeFinding, validityFinding } from "@/lib/ptc-checks";
import { resolvedPtcCalculationRule } from "@/lib/ptc-calculation-rules";
import { prisma } from "@/lib/prisma";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid calculator request." }, { status: 400 });
  }
  const versionId = String(body.versionId || "");
  const applicationTypeId = String(body.applicationTypeId || "");
  const checkFees = body.checkFees === true;
  const checkValidity = body.checkValidity === true;
  if (!versionId || !applicationTypeId) return NextResponse.json({ error: "Choose a Version and Type of Application first." }, { status: 400 });
  if (!checkFees && !checkValidity) return NextResponse.json({ error: "Choose a checker to run." }, { status: 400 });
  if (checkFees && !(await userHasFeature(user, FeatureKey.PTC_FEES_CHECKER))) return NextResponse.json({ error: "You do not have access to the PTC Fees Checker." }, { status: 403 });
  if (checkValidity && !(await userHasFeature(user, FeatureKey.PTC_VALIDITY_CHECKER))) return NextResponse.json({ error: "You do not have access to the PTC Validity Checker." }, { status: 403 });

  try {
    const applicationType = await prisma.applicationType.findFirst({
      where: { id: applicationTypeId, versionId, group: PERMIT_GROUP_PTC, active: true }
    });
    if (!applicationType) return NextResponse.json({ error: "The selected Type of Application does not belong to the selected Version." }, { status: 400 });
    const { config, usingApplicationTypeOverride } = await resolvedPtcCalculationRule(versionId, applicationTypeId);
    const treesApproved = body.treesApproved === null || body.treesApproved === undefined || body.treesApproved === "" ? null : Number(body.treesApproved);
    const response: Record<string, unknown> = { usingApplicationTypeOverride };
    if (checkFees) {
      const replantedSeedlings = body.replantedSeedlings === true ? true : body.replantedSeedlings === false ? false : null;
      const result = calculatePtcFee({ treesApproved, replantedSeedlings, config });
      const recordedFee = body.recordedFee === null || body.recordedFee === undefined || body.recordedFee === "" ? null : Number(body.recordedFee);
      response.fee = { ...result, finding: feeFinding(recordedFee, result.actualFee) };
    }
    if (checkValidity) {
      const result = calculatePtcValidity({ treesApproved, config });
      const recordedValidityDays = body.recordedValidityDays === null || body.recordedValidityDays === undefined || body.recordedValidityDays === "" ? null : Number(body.recordedValidityDays);
      response.validity = { ...result, finding: validityFinding(recordedValidityDays, result) };
    }
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not calculate the PTC check." }, { status: 400 });
  }
}
