import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildPtcImportTemplateWorkbook, buildPttImportTemplateWorkbook, PTC_IMPORT_COLUMNS, PTT_IMPORT_COLUMNS } from "@/lib/excel";

describe("import templates", () => {
  it("builds the expected PTC import template columns", () => {
    const workbook = XLSX.read(buildPtcImportTemplateWorkbook(), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["PTC Import"], { header: 1 });

    expect(workbook.SheetNames).toEqual(["PTC Import"]);
    expect(rows[0]).toEqual([...PTC_IMPORT_COLUMNS]);
  });

  it("keeps the expected PTT import template columns", () => {
    const workbook = XLSX.read(buildPttImportTemplateWorkbook(), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["PTT Import"], { header: 1 });

    expect(workbook.SheetNames).toEqual(["PTT Import"]);
    expect(rows[0]).toEqual([...PTT_IMPORT_COLUMNS]);
  });
});
