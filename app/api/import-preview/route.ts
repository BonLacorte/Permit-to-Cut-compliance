import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkPtcImportWorkbook, checkPttImportWorkbook, type ImportGroup, type ImportPreviewResult } from "@/lib/import-checker";
import { ptcImportCheckContext, pttImportCheckContext } from "@/lib/import-checker-context";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

function errorPreview(group: ImportGroup, message: string): ImportPreviewResult {
  return {
    group,
    rowsChecked: 0,
    readyRows: 0,
    errorCount: 1,
    warningCount: 0,
    issues: [{ row: 1, field: "Workbook", severity: "Error", message, value: "" }]
  };
}

function nullableVersionId(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!text || text === UNCATEGORIZED_VERSION) return null;
  return text;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 400 });
  }

  const group = String(formData.get("group") || "").toUpperCase() as ImportGroup;
  if (group !== "PTC" && group !== "PTT") {
    return NextResponse.json({ error: "Unsupported import checker group." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(errorPreview(group, `Upload a ${group} Excel file.`));
  }

  const versionId = nullableVersionId(formData.get("versionId"));
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = group === "PTT"
      ? checkPttImportWorkbook(buffer, await pttImportCheckContext(versionId))
      : checkPtcImportWorkbook(buffer, await ptcImportCheckContext(versionId));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(errorPreview(group, error instanceof Error ? error.message : "Could not check the workbook."));
  }
}
