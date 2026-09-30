"use client";

import { useRouter } from "next/navigation";
import { pttDashboardApplicationsHref, pttDashboardMetricOptions, type PttDashboardMetricId } from "@/lib/ptt-dashboard";

export function PttDashboardMetricFilter({ version, region, provincialOffice, selected }: { version: string; region: string; provincialOffice: string; selected: PttDashboardMetricId }) {
  const router = useRouter();

  return (
    <label className="compact-filter">
      <span>Dashboard View</span>
      <select value={selected} onChange={(event) => router.push(pttDashboardApplicationsHref({ version, region, provincialOffice, metric: event.target.value as PttDashboardMetricId }))}>
        {pttDashboardMetricOptions.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
      </select>
    </label>
  );
}
