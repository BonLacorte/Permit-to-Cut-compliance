import { describe, expect, it } from "vitest";
import { buildExportFilename, filenamePart } from "@/lib/export-filename";

const timestamp = new Date(2026, 7, 27, 14, 30, 12);

describe("export filenames", () => {
  it("builds a PTC filename from version, region, provincial office, and timestamp", () => {
    expect(buildExportFilename({
      group: "PTC",
      versionName: "New Forms",
      region: "Region XIII",
      provincialOffice: "Agusan del Norte",
      date: timestamp
    })).toBe("PTC-New-Forms-Region-XIII-Agusan-del-Norte-20260827-143012.xlsx");
  });

  it("builds a PTT filename with all-region fallback labels", () => {
    expect(buildExportFilename({
      group: "PTT",
      versionName: "Default PTT",
      region: "All",
      provincialOffice: "All",
      date: timestamp
    })).toBe("PTT-Default-PTT-All-Regions-All-Provincial-Offices-20260827-143012.xlsx");
  });

  it("uses explicit no-region and no-provincial-office labels", () => {
    expect(buildExportFilename({
      group: "PTC",
      versionName: "Old Forms",
      region: "No Region",
      provincialOffice: "No Provincial Office",
      date: timestamp
    })).toBe("PTC-Old-Forms-No-Region-No-Provincial-Office-20260827-143012.xlsx");
  });

  it("sanitizes filename parts with special characters", () => {
    expect(filenamePart("2026/2027 & pilot: phase #1")).toBe("2026-2027-and-pilot-phase-1");
  });
});
