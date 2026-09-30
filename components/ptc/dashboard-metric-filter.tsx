"use client";

import { useRouter } from "next/navigation";
import { dashboardApplicationsHref, dashboardMetricOptions, type DashboardMetricId } from "@/lib/dashboard";

export function DashboardMetricFilter({ version, region, provincialOffice, selected }: { version: string; region: string; provincialOffice?: string; selected: DashboardMetricId }) {
  const router = useRouter();

  return (
    <label className="compact-filter">
      <span>Dashboard View</span>
      <select value={selected} onChange={(event) => router.push(dashboardApplicationsHref({ version, region, provincialOffice, metric: event.target.value as DashboardMetricId }))}>
        {dashboardMetricOptions.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
      </select>
    </label>
  );
}
