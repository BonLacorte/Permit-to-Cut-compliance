import { NextResponse } from "next/server";
import { buildReportWorkbook } from "@/lib/excel";
import { getReportData, getVersionContext } from "@/lib/data";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const versionContext = await getVersionContext(url.searchParams.get("version"));
  const report = await getReportData({ versionId: versionContext.selectedVersionId });
  const buffer = buildReportWorkbook(report.audits, report.requiredDocuments);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="grounds-compliance-report.xlsx"'
    }
  });
}
