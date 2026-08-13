import { describe, expect, it } from "vitest";
import { hasPttSourceReference, missingPttCompletionFields, pttExportRows, pttStatus } from "@/lib/ptt";

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
  vehiclePlateNumber: "CAF-5164",
  amountPaid: "3000",
  officialReceiptNumber: "6110665 W",
  validUntil: new Date("2026-05-11T00:00:00.000Z"),
  issuedBy: "GABBY SCHYLER B. GALANG",
  remarks: "Sample record",
  editedByName: "Admin User",
  pttNumberDuplicate: true
};

describe("PTT helpers", () => {
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

  it("marks complete records as Complete with required offices and transport type", () => {
    expect(pttStatus(completeRecord)).toBe("Complete");
    expect(missingPttCompletionFields(completeRecord)).toEqual([]);
  });

  it("does not require Consignee Name for completion", () => {
    expect(pttStatus({ ...completeRecord, consigneeName: "" })).toBe("Complete");
  });

  it("accepts either PTC number or PCA registration certificate number as the source reference", () => {
    expect(hasPttSourceReference({ ptcNumber: "1360372" })).toBe(true);
    expect(hasPttSourceReference({ pcaRegistrationCertificateNumber: "R4-1000657" })).toBe(true);
    expect(hasPttSourceReference({ ptcNumber: "", pcaRegistrationCertificateNumber: "" })).toBe(false);
  });

  it("exports PTT rows with status and duplicate flag", () => {
    expect(pttExportRows([completeRecord])[0]).toMatchObject({
      "PTT Number": "142224",
      "Duplicate PTT Number": "Yes",
      Name: "ODESSA CAMPENA",
      "Regional Office": "Region IV-A",
      "Provincial Office": "Quezon I",
      "PTC Number": "1360372",
      "Amount Paid": "3,000",
      Status: "Complete",
      "Edited By": "Admin User"
    });
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Province");
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Validated/Inspected By Designation");
    expect(pttExportRows([completeRecord])[0]).not.toHaveProperty("Issued By Designation");
  });
});
