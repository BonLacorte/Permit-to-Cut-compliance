import { NextResponse } from "next/server";
import { buildPtcImportTemplateWorkbook, buildPttImportTemplateWorkbook } from "@/lib/excel";
import { requireAdmin } from "@/lib/auth";
import { PERMIT_GROUP_PTC } from "@/lib/ptc";
import { PERMIT_GROUP_PTT } from "@/lib/ptt";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const group = url.searchParams.get("group");

  if (group === PERMIT_GROUP_PTC) {
    const buffer = buildPtcImportTemplateWorkbook();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ptc-import-template.xlsx"'
      }
    });
  }

  if (group !== PERMIT_GROUP_PTT) {
    return NextResponse.json({ error: "Unsupported import template." }, { status: 400 });
  }

  const buffer = buildPttImportTemplateWorkbook();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ptt-import-template.xlsx"'
    }
  });
}
