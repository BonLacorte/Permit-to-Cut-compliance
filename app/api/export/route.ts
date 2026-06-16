import { NextResponse } from "next/server";
import { buildReportWorkbook } from "@/lib/excel";
import { getReportData } from "@/lib/data";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  await requireUser();
  const report = await getReportData();
  const buffer = buildReportWorkbook(report.audits, report.requiredDocuments);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="grounds-compliance-report.xlsx"'
    }
  });
}
