import type { ImportPreviewResult } from "@/lib/import-checker";

export function forceImportRequested(value: FormDataEntryValue | null) {
  return value === "true";
}

type ImportPolicyOptions = {
  forceImport?: boolean;
  requiredSelectionPresent?: boolean;
};

export function canImportPreview(preview: ImportPreviewResult, options: ImportPolicyOptions = {}) {
  return preview.rowsChecked > 0
    && options.requiredSelectionPresent !== false
    && (options.forceImport || preview.errorCount === 0);
}
