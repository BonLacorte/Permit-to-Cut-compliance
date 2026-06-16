"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

export function ExportExcelButton({ className = "button secondary" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function exportExcel() {
    setLoading(true);
    try {
      const response = await fetch("/api/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error("Export failed.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "grounds-compliance-report.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("success", "Excel report exported.");
    } catch {
      showToast("error", "Could not export the Excel report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className={className} type="button" onClick={exportExcel} disabled={loading} aria-busy={loading}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {loading ? "Exporting..." : "Export Excel"}
    </button>
  );
}