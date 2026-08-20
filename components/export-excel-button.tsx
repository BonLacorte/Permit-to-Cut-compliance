"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";

type ExportOfficeChoice = {
  name: string;
  provincialOffices: { name: string }[];
};

type ExportExcelButtonProps = {
  className?: string;
  versionId?: string;
  group?: "PTC" | "PTT";
  regions?: string[];
  officeChoices?: ExportOfficeChoice[];
  label?: string;
  filename?: string;
};

function sortedUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function ExportExcelButton({
  className = "button secondary",
  versionId,
  group = "PTC",
  regions = [],
  officeChoices = [],
  label = "Export Excel",
  filename = group === "PTT" ? "ptt-applications.xlsx" : "grounds-compliance-report.xlsx"
}: ExportExcelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState("All");
  const [provincialOffice, setProvincialOffice] = useState("All");
  const { showToast } = useToast();

  const regionOptions = useMemo(() => {
    if (officeChoices.length > 0) return ["All", ...officeChoices.map((office) => office.name), "No Region"];
    return ["All", ...regions];
  }, [officeChoices, regions]);

  const provincialOfficeOptions = useMemo(() => {
    if (officeChoices.length === 0) return [];
    if (region === "No Region") return ["All", "No Provincial Office"];
    const source = region === "All"
      ? officeChoices.flatMap((office) => office.provincialOffices)
      : officeChoices.find((office) => office.name === region)?.provincialOffices || [];
    return ["All", ...sortedUnique(source.map((office) => office.name)), "No Provincial Office"];
  }, [officeChoices, region]);

  useEffect(() => {
    if (regionOptions.includes(region)) return;
    setRegion("All");
  }, [region, regionOptions]);

  useEffect(() => {
    if (provincialOfficeOptions.length === 0 || provincialOfficeOptions.includes(provincialOffice)) return;
    setProvincialOffice("All");
  }, [provincialOffice, provincialOfficeOptions]);

  async function exportExcel() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (group !== "PTC") params.set("group", group);
      if (versionId) params.set("version", versionId);
      if (region && region !== "All") params.set("region", region);
      if (provincialOffice && provincialOffice !== "All") params.set("provincialOffice", provincialOffice);
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
      {regionOptions.length > 1 ? (
        <label className="field compact-field">
          <span>Region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            {regionOptions.map((option) => <option key={option} value={option}>{option === "All" ? "All Regions" : option}</option>)}
          </select>
        </label>
      ) : null}
      {provincialOfficeOptions.length > 0 ? (
        <label className="field compact-field">
          <span>Provincial Office</span>
          <select value={provincialOffice} onChange={(event) => setProvincialOffice(event.target.value)}>
            {provincialOfficeOptions.map((option) => <option key={option} value={option}>{option === "All" ? "All Provincial Offices" : option}</option>)}
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
