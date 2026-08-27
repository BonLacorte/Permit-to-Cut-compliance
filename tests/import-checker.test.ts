import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { PTC_IMPORT_COLUMNS, PTT_IMPORT_COLUMNS } from "@/lib/excel";
import { checkPtcImportWorkbook, checkPttImportWorkbook, type OfficeImportChoice } from "@/lib/import-checker";

const offices: OfficeImportChoice[] = [
  { name: "Region IV-A", provincialOffices: [{ name: "Quezon I" }, { name: "Quezon II" }] },
  { name: "Region XIII", provincialOffices: [{ name: "Agusan del Norte" }] }
];

function workbookBuffer(headers: readonly string[], rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[...headers], ...rows]), "Import");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("import checker", () => {
  it("accepts a valid PTC workbook without issues", () => {
    const result = checkPtcImportWorkbook(
      workbookBuffer(PTC_IMPORT_COLUMNS, [[
        "Region IV-A",
        "Quezon I",
        "1331290",
        "04/09/2025",
        "ALDRIN U. PEREZ",
        "IBA. BUKAL",
        "TAYABAS CITY",
        10,
        8,
        0,
        "Type A",
        "Owner"
      ]]),
      {
        versionId: "version-a",
        applicationTypeNames: ["Type A"],
        existingPtcNumbers: [],
        officeChoices: offices
      }
    );

    expect(result).toMatchObject({ rowsChecked: 1, readyRows: 1, errorCount: 0, warningCount: 0 });
  });

  it("reports PTC blocking errors and review warnings", () => {
    const result = checkPtcImportWorkbook(
      workbookBuffer([...PTC_IMPORT_COLUMNS, "Unused Column"], [[
        "Region IV-A",
        "Agusan del Norte",
        "1331290",
        "13/40/2025",
        "ALDRIN U. PEREZ",
        "IBA. BUKAL",
        "TAYABAS CITY",
        "many",
        8,
        0,
        "Unknown Type",
        "Tenant",
        "Ignored"
      ]]),
      {
        versionId: "version-a",
        applicationTypeNames: ["Type A"],
        existingPtcNumbers: ["1331290"],
        officeChoices: offices
      }
    );

    expect(result.errorCount).toBeGreaterThanOrEqual(2);
    expect(result.warningCount).toBeGreaterThanOrEqual(4);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Date Issued", severity: "Error" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "No. of trees applied", severity: "Error" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "LOC Exemption", severity: "Error" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "PTC Number", severity: "Warning" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Provincial Office", severity: "Warning" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Type of Application", severity: "Warning" }));
  });

  it("accepts a valid PTT workbook and warns about unknown transport types", () => {
    const result = checkPttImportWorkbook(
      workbookBuffer(PTT_IMPORT_COLUMNS, [[
        "Region XIII",
        "Agusan del Norte",
        "1194031",
        "21/02/2024",
        "Leandro N. Pendejeto",
        "P4, KAUSWAGAN",
        "1193945",
        "PCA-1",
        "20/02/2024",
        "Business address",
        "1000",
        "Yes",
        "7500",
        "Brgy. Cabayawa",
        "Langihan Road",
        "",
        "03194",
        "Unknown Truck",
        "MAP 2440",
        "Driver",
        "09170000000",
        "2250",
        "3854024",
        3,
        "",
        "21/02/2024",
        "Inspector",
        "21/02/2024",
        "Issuer",
        "Remarks"
      ]]),
      {
        versionId: "ptt-version-default",
        transportTypes: ["10 WHEELER"],
        existingPttNumbers: [],
        officeChoices: offices
      }
    );

    expect(result).toMatchObject({ rowsChecked: 1, readyRows: 1, errorCount: 0, warningCount: 1 });
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Type of Transport Used", severity: "Warning" }));
  });

  it("blocks PTT preview when the version or typed cells are invalid", () => {
    const result = checkPttImportWorkbook(
      workbookBuffer(PTT_IMPORT_COLUMNS, [[
        "Region XIII",
        "Agusan del Norte",
        "1194031",
        "not a date",
        "Leandro N. Pendejeto",
        "",
        "1193945",
        "",
        "",
        "",
        "abc",
        "maybe",
        "7500",
        "",
        "",
        "",
        "",
        "10 WHEELER",
        "",
        "",
        "",
        "not money",
        "",
        "three",
        "",
        "",
        "",
        "",
        "",
        ""
      ]]),
      {
        versionId: null,
        transportTypes: ["10 WHEELER"],
        existingPttNumbers: ["1194031"],
        officeChoices: offices
      }
    );

    expect(result.errorCount).toBeGreaterThanOrEqual(5);
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Import PTT Version", severity: "Error" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Date Issued", severity: "Error" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "Certificate of Quantity/Volume Attached", severity: "Error" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "PTT Number", severity: "Warning" }));
  });
});
