"use client";

import { useRouter } from "next/navigation";
import { UNCATEGORIZED_VERSION } from "@/lib/versioning";

type VersionOption = {
  id: string;
  name: string;
  active?: boolean;
};

export function VersionFilter({
  label = "Version",
  options,
  path,
  selected,
  preservedParams = {}
}: {
  label?: string;
  options: VersionOption[];
  path: string;
  selected: string;
  preservedParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const activeVersions = options.filter((option) => option.id !== UNCATEGORIZED_VERSION && option.active !== false);
  const archivedVersions = options.filter((option) => option.id !== UNCATEGORIZED_VERSION && option.active === false);
  const uncategorized = options.find((option) => option.id === UNCATEGORIZED_VERSION);

  function changeVersion(value: string) {
    const params = new URLSearchParams();
    params.set("version", value);
    for (const [key, paramValue] of Object.entries(preservedParams)) {
      if (paramValue) params.set(key, paramValue);
    }
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <label className="compact-filter version-filter">
      <span>{label}</span>
      <select value={selected} onChange={(event) => changeVersion(event.target.value)}>
        {activeVersions.length > 0 ? (
          <optgroup label="Active Versions">
            {activeVersions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </optgroup>
        ) : null}
        {archivedVersions.length > 0 ? (
          <optgroup label="Archived Versions">
            {archivedVersions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </optgroup>
        ) : null}
        {uncategorized ? (
          <optgroup label="Other">
            <option value={uncategorized.id}>{uncategorized.name}</option>
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}
