"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

type ExportExcelButtonProps = {
  className?: string;
  versionId?: string;
  group?: "PTC" | "PTT";
  regions?: string[];
  label?: string;
  filename?: string;
};

export function ExportExcelButton({
  className = "button secondary",
  versionId,
  group = "PTC",
  regions = [],
  label = "Export Excel",
  filename = group === "PTT" ? "ptt-applications.xlsx" : "grounds-compliance-report.xlsx"
}: ExportExcelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState("All");
  const { showToast } = useToast();

  async function exportExcel() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (group !== "PTC") params.set("group", group);
      if (versionId) params.set("version", versionId);
      if (region && region !== "All") params.set("region", region);
      const query = params.toString();
      const response = await fetch(query ? `/api/export?${query}` : "/api/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error("Export failed.");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showToast("success", "Excel report exported.");
    } catch {
      showToast("error", "Could not export the Excel report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="export-control">
      {regions.length > 0 ? (
        <label className="field compact-field">
          <span>Region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="All">All Regions</option>
            {regions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ) : null}
      <button className={className} type="button" onClick={exportExcel} disabled={loading} aria-busy={loading}>
        {loading ? <span className="spinner" aria-hidden="true" /> : null}
        {loading ? "Exporting..." : label}
      </button>
    </div>
  );
}
