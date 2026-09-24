import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildPttApplicationsWorkbook, buildPttImportTemplateWorkbook, parsePttRecordsWorkbook, PTT_IMPORT_COLUMNS } from "@/lib/excel";
import { filterPttRecordsByProvincialOffice, filterPttRecordsByRegion, hasPttSourceReference, missingPttCompletionFields, newPttApplicationPath, pttDocumentSummaryRows, pttExportRows, pttStatus } from "@/lib/ptt";

const completeRecord = {
  versionId: "ptt-version-default",
  versionName: "Default PTT",
  pttNumber: "142224",
  dateIssued: new Date("2026-05-11T00:00:00.000Z"),
  regionalOffice: "Region IV-A",
  provincialOffice: "Quezon I",
  transporterName: "ODESSA CAMPENA",
  transporterAddress: "ATIMONAN, QUEZON",
  ptcNumber: "1360372",
  volumeBoardFeet: "10000",
  originOfLumber: "KINATAKUTAN, TAGKAWAYAN, QUEZON II",
  destination: "QUEZON CITY",
  consigneeName: "",
  transportType: "10 WHEELER",
  actualTransportCategory: "TenWheelerTruck",
  vehiclePlateNumber: "CAF-5164",
  amountPaid: "3000",
  actualFee: "3000",
  validityBasis: "WithinRegion",
  officialReceiptNumber: "6110665 W",
  recordedValidityDays: 3,
  actualValidityDays: null,
  dateValidatedInspected: new Date("2026-05-11T00:00:00.000Z"),
  validatedInspectedBy: "ARVIN RAFAEL SG. LIZARDO",
  validatedInspectedBySignatureStatus: "For",
  validatedInspectedBySignatureForName: "Inspector Delegate",
  issuedByDate: new Date("2026-05-11T00:00:00.000Z"),
  issuedBy: "GABBY SCHYLER B. GALANG",
  issuedBySignatureStatus: "Blank",
  issuedBySignatureForName: "",
  remarks: "Sample record",
  createdByName: "Creator User",
  createdAt: new Date("2026-05-11T00:00:00.000Z"),
  editedByName: "Admin User",
  updatedAt: new Date("2026-05-12T01:30:00.000Z"),
  pttNumberDuplicate: true
};

describe("PTT helpers", () => {
  it("returns to a new PTT form with the selected Version after creation", () => {
    expect(newPttApplicationPath("ptt version/2026")).toBe("/ptt/applications/new?version=ptt%20version%2F2026");
    expect(newPttApplicationPath(null)).toBe("/ptt/applications/new");
  });

  it("marks a blank shell record as Pending", () => {
    expect(pttStatus({ versionId: "ptt-version-default" })).toBe("Pending");
  });

  it("marks a started record with missing required fields as Incomplete", () => {
    expect(pttStatus({ pttNumber: "142224", transporterName: "ODESSA CAMPENA" })).toBe("Incomplete");
  });

  it("requires offices and transport type for completion", () => {
    expect(missingPttCompletionFields({ ...completeRecord, regionalOffice: "", provincialOffice: "", transportType: "" })).toEqual([
      "regionalOffice",
      "provincialOffice",
      "transportType"
    ]);
  });

  it("marks complete records as Complete with required offices, transport type, and recorded validity", () => {
    expect(pttStatus(completeRecord)).toBe("Complete");
    expect(missingPttCompletionFields(completeRecord)).toEqual([]);
  });

  it("requires Recorded Validity but not Actual Validity for completion", () => {
    expect(missingPttCompletionFields({ ...completeRecord, recordedValidityDays: null })).toContain("recordedValidityDays");
    expect(pttStatus({ ...completeRecord, actualValidityDays: null })).toBe("Complete");
  });

  it("does not require Consignee Name for completion", () => {
    expect(pttStatus({ ...completeRecord, consigneeName: "" })).toBe("Complete");
  });

  it("accepts either PTC number or PCA registration certificate number as the source reference", () => {
    expect(hasPttSourceReference({ ptcNumber: "1360372" })).toBe(true);
    expect(hasPttSourceReference({ pcaRegistrationCertificateNumber: "R4-1000657" })).toBe(true);
    expect(hasPttSourceReference({ ptcNumber: "", pcaRegistrationCertificateNumber: "" })).toBe(false);
  });

  it("exports PTT rows with status, duplicate flag, validity, and issued-by date", () => {
    expect(pttExportRows([completeRecord])[0]).toMatchObject({
      "PTT Number": "142224",
      "Duplicate PTT Number": "Yes",
      Name: "ODESSA CAMPENA",
      "Regional Office": "Region IV-A",
      "Provincial Office": "Quezon I",
      "PTC Number": "1360372",
      "Recorded Fee": "3,000",
      "Actual Fee": "3,000",
      "Recorded Type of Transport Used": "10 WHEELER",
      "Actual Type of Transport Used": "Ten-Wheeler Truck",
      "Validity Basis": "Within the Region",
      "Recorded Validity": "3",
      "Actual Validity": "",
      "Validated/Inspected By Signature": "For",
      "Validated/Inspected By Signature For": "Inspector Delegate",
      "Issued By Date": "2026-05-11",
      "Issued By Signature": "Blank",
      Status: "Complete",
      "Created By": "Creator User",
      "Created At": "2026-05-11 08:00 PHT",
      "Edited By": "Admin User",
      "Edited At": "2026-05-12 09:30 PHT"
    });
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Transport Type");
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Valid Until");
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Province");
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Validated/Inspected By Designation");
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Issued By Designation");
  });

  it("leaves unedited PTT audit fields blank in exports", () => {
    expect(pttExportRows([{ ...completeRecord, editedByName: "", updatedAt: new Date("2026-05-13T00:00:00.000Z") }])[0]).toMatchObject({
      "Created By": "Creator User",
      "Edited By": "",
      "Edited At": ""
    });
  });

  it("filters PTT records by Region for export", () => {
    const records = [
      completeRecord,
      { ...completeRecord, pttNumber: "999", regionalOffice: "Region VIII" },
      { ...completeRecord, pttNumber: "777", regionalOffice: "Region XIII" },
      { ...completeRecord, pttNumber: "888", regionalOffice: null }
    ];

    expect(filterPttRecordsByRegion(records, "All")).toHaveLength(4);
    expect(filterPttRecordsByRegion(records, "Region IV-A").map((record) => record.pttNumber)).toEqual(["142224"]);
    expect(filterPttRecordsByRegion(records, "Region XIII").map((record) => record.pttNumber)).toEqual(["777"]);
    expect(filterPttRecordsByRegion(records, "No Region").map((record) => record.pttNumber)).toEqual(["888"]);
  });


  it("filters PTT records by Provincial Office for export", () => {
    const records = [
      completeRecord,
      { ...completeRecord, pttNumber: "999", regionalOffice: "Region VIII", provincialOffice: "Leyte" },
      { ...completeRecord, pttNumber: "777", regionalOffice: "Region XIII", provincialOffice: "Agusan del Norte" },
      { ...completeRecord, pttNumber: "888", regionalOffice: null, provincialOffice: null }
    ];

    expect(filterPttRecordsByProvincialOffice(records, "All")).toHaveLength(4);
    expect(filterPttRecordsByProvincialOffice(records, "Quezon I").map((record) => record.pttNumber)).toEqual(["142224"]);
    expect(filterPttRecordsByProvincialOffice(records, "Agusan del Norte").map((record) => record.pttNumber)).toEqual(["777"]);
    expect(filterPttRecordsByProvincialOffice(records, "No Provincial Office").map((record) => record.pttNumber)).toEqual(["888"]);
  });

  it("builds a PTT Document Summary sheet from Certificate of Quantity/Volume Attached", () => {
    const records = [
      { ...completeRecord, certificateOfQuantityVolumeAttached: true },
      { ...completeRecord, pttNumber: "999", certificateOfQuantityVolumeAttached: false },
      { ...completeRecord, pttNumber: "888", certificateOfQuantityVolumeAttached: null }
    ];

    expect(pttDocumentSummaryRows(records)).toEqual([{
      Document: "Certificate of Quantity/Volume Attached",
      "Total Records": 3,
      "Submitted/Attached": 1,
      "Missing/Not Attached": 1,
      Blank: 1,
      "Submitted Rate": 1 / 3,
      "Missing Rate": 1 / 3
    }]);

    const workbook = XLSX.read(buildPttApplicationsWorkbook(records), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["PTT Applications", "Document Summary"]);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Document Summary"]);
    expect(rows[0]).toMatchObject({
      Document: "Certificate of Quantity/Volume Attached",
      "Total Records": 3,
      "Submitted/Attached": 1,
      "Missing/Not Attached": 1,
      Blank: 1
    });
  });
  it("parses PTT import workbooks with dates, decimals, booleans, blanks, and text fields", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [...PTT_IMPORT_COLUMNS],
      [
        "Region IV-A",
        "Quezon I",
        "142224",
        new Date("2026-05-11T00:00:00.000Z"),
        "ODESSA CAMPENA",
        "ATIMONAN, QUEZON",
        "1360372",
        "R4-1000657",
        "2026-05-01",
        "Business address",
        "10,000.50",
        "Yes",
        2500,
        "KINATAKUTAN",
        "QUEZON CITY",
        "",
        "PCA-123",
        "10 WHEELER",
        "CAF-5164",
        "Driver Name",
        "09170000000",
        "3,000",
        "3000",
        "6110665 W",
        "Within the Region",
        3,
        "",
        "2026-05-10",
        "Inspector",
        "2026-05-11",
        "Issuer",
        "Imported remarks"
      ]
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "PTT Import");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(parsePttRecordsWorkbook(buffer)[0]).toMatchObject({
      regionalOffice: "Region IV-A",
      provincialOffice: "Quezon I",
      pttNumber: "142224",
      transporterName: "ODESSA CAMPENA",
      boardFeetGranted: "10000.50",
      certificateOfQuantityVolumeAttached: true,
      volumeBoardFeet: "2500",
      transportType: "10 WHEELER",
      amountPaid: "3000",
      actualFee: "3000",
      validityBasis: "WithinRegion",
      recordedValidityDays: 3,
      actualValidityDays: undefined,
      issuedByDate: new Date("2026-05-11T00:00:00.000Z"),
      consigneeName: undefined,
      remarks: "Imported remarks"
    });
  });

  it("builds the expected PTT import template columns", () => {
    const workbook = XLSX.read(buildPttImportTemplateWorkbook(), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["PTT Import"], { header: 1 });
    expect(rows[0]).toEqual([...PTT_IMPORT_COLUMNS]);
    expect(rows[0]).toContain("Recorded Fee");
    expect(rows[0]).toContain("Actual Fee");
    expect(rows[0]).toContain("Validity Basis");
    expect(rows[0]).toContain("Recorded Validity");
    expect(rows[0]).toContain("Actual Validity");
    expect(rows[0]).toContain("Issued By Date");
    expect(rows[0]).not.toContain("Valid Until");
  });
});
