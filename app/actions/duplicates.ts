"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergeSelectionSchema } from "@/lib/duplicate-merge";
import { assertDuplicatePermission, buildMergePreview, commitDuplicateMerge, displayMergeRecord, jsonSnapshot } from "@/lib/duplicate-review";
import { revalidateReports, revalidatePttApplications } from "@/app/actions/_shared";

function message(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return "Another change occurred during this merge. Reload the group and review a new preview. Nothing was saved.";
  return error instanceof Error ? error.message : "The duplicate operation failed. Nothing was saved.";
}
export async function previewDuplicateMergeAction(input: unknown) {
  const user = await requireUser();
  try {
    const selection = mergeSelectionSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      await assertDuplicatePermission(tx, user.id);
      const preview = await buildMergePreview(tx, selection);
      return jsonSnapshot({ digest: preview.digest, final: displayMergeRecord(preview.final), checks: preview.evaluated.checks });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
    return { preview: result };
  } catch (error) { return { error: message(error) }; }
}
export async function mergeDuplicateRecordsAction(input: unknown, digest: string) {
  const user = await requireUser();
  try {
    const selection = mergeSelectionSchema.parse(input);
    const result = await prisma.$transaction((tx) => commitDuplicateMerge(tx, user.id, selection, digest), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    revalidateReports(); revalidatePttApplications(); revalidatePath("/ptt/dashboard");
    for (const group of ["ptc", "ptt"]) revalidatePath(`/${group}/applications/duplicates`);
    for (const id of [result.keeperId, ...result.deleteIds]) revalidatePath(`/${result.group.toLowerCase()}/applications/${id}`, "layout");
    return { success: true, keeperId: result.keeperId };
  } catch (error) { return { error: message(error) }; }
}
