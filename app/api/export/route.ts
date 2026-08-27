import { NextResponse } from "next/server";
import { buildPttApplicationsWorkbook, buildReportWorkbook } from "@/lib/excel";
import { getPttApplicationRecords, getReportData, getVersionContext } from "@/lib/data";
import { filterDashboardAuditsByProvincialOffice, filterDashboardAuditsByRegion } from "@/lib/dashboard";
import { requireUser } from "@/lib/auth";
import { filterPttRecordsByProvincialOffice, filterPttRecordsByRegion, PERMIT_GROUP_PTT } from "@/lib/ptt";
import { buildExportFilename } from "@/lib/export-filename";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const group = url.searchParams.get("group");

  if (group === PERMIT_GROUP_PTT) {
    const versionContext = await getVersionContext(url.searchParams.get("version"), PERMIT_GROUP_PTT);
    const region = url.searchParams.get("region") || "All";
    const provincialOffice = url.searchParams.get("provincialOffice") || "All";
    const records = await getPttApplicationRecords({ versionId: versionContext.selectedVersionId });
    const regionRecords = filterPttRecordsByRegion(records, region);
    const filteredRecords = filterPttRecordsByProvincialOffice(regionRecords, provincialOffice);
    const buffer = buildPttApplicationsWorkbook(filteredRecords);
    const filename = buildExportFilename({
      group: "PTT",
      versionName: versionContext.selectedVersionName,
      versionId: versionContext.selectedVersionParam,
      region,
      provincialOffice
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  }

  const versionContext = await getVersionContext(url.searchParams.get("version"));
  const region = url.searchParams.get("region") || "All";
  const provincialOffice = url.searchParams.get("provincialOffice") || "All";
  const report = await getReportData({ versionId: versionContext.selectedVersionId });
  const regionAudits = filterDashboardAuditsByRegion(report.audits, region);
  const filteredAudits = filterDashboardAuditsByProvincialOffice(regionAudits, provincialOffice);
  const buffer = buildReportWorkbook(filteredAudits, report.requiredDocuments);
  const filename = buildExportFilename({
    group: "PTC",
    versionName: versionContext.selectedVersionName,
    versionId: versionContext.selectedVersionParam,
    region,
    provincialOffice
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
