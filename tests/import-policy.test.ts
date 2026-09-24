import { describe, expect, it } from "vitest";
import { canImportPreview, forceImportRequested } from "@/lib/import-policy";
import type { ImportPreviewResult } from "@/lib/import-checker";

const preview = (overrides: Partial<ImportPreviewResult> = {}): ImportPreviewResult => ({
  group: "PTC",
  rowsChecked: 1,
  readyRows: 0,
  errorCount: 1,
  warningCount: 0,
  issues: [],
  ...overrides
});

describe("import policy", () => {
  it("blocks checker errors during a normal import but permits an explicit forced import", () => {
    expect(canImportPreview(preview())).toBe(false);
    expect(canImportPreview(preview(), { forceImport: true })).toBe(true);
  });

  it("does not permit empty workbooks, even when force import is requested", () => {
    expect(canImportPreview(preview({ rowsChecked: 0 }), { forceImport: true })).toBe(false);
  });

  it("keeps the required PTT Version blocking even when force import is requested", () => {
    expect(canImportPreview(preview({ group: "PTT" }), { forceImport: true, requiredSelectionPresent: false })).toBe(false);
  });

  it("recognizes only the confirmed force-import form value", () => {
    expect(forceImportRequested("true")).toBe(true);
    expect(forceImportRequested("false")).toBe(false);
    expect(forceImportRequested(null)).toBe(false);
  });
});
