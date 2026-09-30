"use client";

import { useRouter } from "next/navigation";

export function ProvincialOfficeFilter({
  options,
  path,
  selected,
  version,
  preservedParams = {}
}: {
  options: string[];
  path: string;
  selected: string;
  version: string;
  preservedParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function changeProvincialOffice(provincialOffice: string) {
    const params = new URLSearchParams();
    params.set("version", version);
    if (provincialOffice !== "All") params.set("provincialOffice", provincialOffice);
    for (const [key, value] of Object.entries(preservedParams)) {
      if (value) params.set(key, value);
    }
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <label className="compact-filter">
      <span>Provincial Office</span>
      <select value={selected} onChange={(event) => changeProvincialOffice(event.target.value)}>
        {options.map((provincialOffice) => <option key={provincialOffice} value={provincialOffice}>{provincialOffice}</option>)}
      </select>
    </label>
  );
}
