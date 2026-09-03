import { FeatureKey } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, userHasFeature } from "@/lib/auth";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";
import { calculatePttFee, calculatePttValidity, checkPttVehicleCapacity, pttCapacityMaxFromCategory, pttFeeFinding, pttValidityBasisLabel, pttValidityFinding } from "@/lib/ptt-checks";
import { resolvedPttValidityRule } from "@/lib/ptt-validity-rules";
import { prisma } from "@/lib/prisma";

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInt(value: unknown) {
  const parsed = optionalNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function optionalText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function validBasis(value: unknown) {
  const text = optionalText(value);
  return text === "WithinMunicipality" || text === "WithinProvince" || text === "WithinRegion" || text === "OutsideRegionInterIsland" ? text : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid PTT checker request." }, { status: 400 });
  }

  const versionId = String(body.versionId || "");
  const checkFees = body.checkFees === true;
  const checkValidity = body.checkValidity === true;
  const checkVehicle = body.checkVehicle === true;
  if (!versionId) return NextResponse.json({ error: "Choose a PTT Version first." }, { status: 400 });
  if (!checkFees && !checkValidity && !checkVehicle) return NextResponse.json({ error: "Choose a checker to run." }, { status: 400 });
  if (checkFees && !(await userHasFeature(user, FeatureKey.PTT_FEES_CHECKER))) return NextResponse.json({ error: "You do not have access to the PTT Fees Checker." }, { status: 403 });
  if (checkValidity && !(await userHasFeature(user, FeatureKey.PTT_VALIDITY_CHECKER))) return NextResponse.json({ error: "You do not have access to the PTT Validity Checker." }, { status: 403 });
  if (checkVehicle && !(await userHasFeature(user, FeatureKey.PTT_VEHICLE_CAPACITY_CHECKER))) return NextResponse.json({ error: "You do not have access to the PTT Vehicle Capacity Checker." }, { status: 403 });

  try {
    const response: Record<string, unknown> = {};
    const volumeBoardFeet = optionalNumber(body.volumeBoardFeet);
    if (checkFees) {
      const result = calculatePttFee({ volumeBoardFeet });
      const recordedFee = optionalNumber(body.recordedFee);
      response.fee = { ...result, finding: pttFeeFinding(recordedFee, result.actualFee) };
    }
    if (checkValidity) {
      const validityRule = await resolvedPttValidityRule(versionId);
      const result = calculatePttValidity({ validityBasis: validBasis(body.validityBasis), outsideRegionValidityDays: optionalInt(body.outsideRegionValidityDays), config: validityRule.config });
      const recordedValidityDays = optionalInt(body.recordedValidityDays);
      response.validity = { ...result, basisLabel: pttValidityBasisLabel(result.validityBasis, validityRule.config), finding: pttValidityFinding(recordedValidityDays, result) };
    }
    if (checkVehicle) {
      const transportType = optionalText(body.transportType);
      const transport = transportType
        ? await prisma.pttTransportType.findFirst({ where: { versionId, group: PERMIT_GROUP_PTT, name: transportType } })
        : null;
      const maxBoardFeet = transport?.maxBoardFeet ?? pttCapacityMaxFromCategory(transport?.capacityCategory || null);
      response.vehicle = checkPttVehicleCapacity({ volumeBoardFeet, transportType, maxBoardFeet });
    }
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not calculate the PTT check." }, { status: 400 });
  }
}
