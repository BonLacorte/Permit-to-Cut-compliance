"use client";

import { useRouter } from "next/navigation";

export function DashboardRegionFilter({
  options,
  path,
  selected,
  version
}: {
  options: string[];
  path: string;
  selected: string;
  version: string;
}) {
  const router = useRouter();

  function changeRegion(region: string) {
    const params = new URLSearchParams();
    params.set("version", version);
    if (region !== "All") params.set("region", region);
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <label className="compact-filter">
      <span>Region</span>
      <select value={selected} onChange={(event) => changeRegion(event.target.value)}>
        {options.map((region) => <option key={region} value={region}>{region}</option>)}
      </select>
    </label>
  );
}