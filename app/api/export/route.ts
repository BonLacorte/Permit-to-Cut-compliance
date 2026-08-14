import { NextResponse } from "next/server";
import { buildPttApplicationsWorkbook, buildReportWorkbook } from "@/lib/excel";
import { getPttApplicationRecords, getReportData, getVersionContext } from "@/lib/data";
import { filterDashboardAuditsByRegion } from "@/lib/dashboard";
import { requireUser } from "@/lib/auth";
import { filterPttRecordsByRegion, PERMIT_GROUP_PTT } from "@/lib/ptt";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const group = url.searchParams.get("group");
  if (group === PERMIT_GROUP_PTT) {
    const versionContext = await getVersionContext(url.searchParams.get("version"), PERMIT_GROUP_PTT);
    const records = await getPttApplicationRecords({ versionId: versionContext.selectedVersionId });
    const filteredRecords = filterPttRecordsByRegion(records, url.searchParams.get("region") || "All");
    const buffer = buildPttApplicationsWorkbook(filteredRecords);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ptt-applications.xlsx"'
      }
    });
  }

  const versionContext = await getVersionContext(url.searchParams.get("version"));
  const report = await getReportData({ versionId: versionContext.selectedVersionId });
  const filteredAudits = filterDashboardAuditsByRegion(report.audits, url.searchParams.get("region") || "All");
  const buffer = buildReportWorkbook(filteredAudits, report.requiredDocuments);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="grounds-compliance-report.xlsx"'
    }
  });
}
