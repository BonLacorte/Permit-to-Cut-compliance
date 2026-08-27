type ExportFilenameInput = {
  group: "PTC" | "PTT";
  versionName?: string | null;
  versionId?: string | null;
  region?: string | null;
  provincialOffice?: string | null;
  date?: Date;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function exportTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

export function filenamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return cleaned || "Blank";
}

function regionPart(region?: string | null) {
  if (!region || region === "All") return "All-Regions";
  if (region === "No Region") return "No-Region";
  return filenamePart(region);
}

function provincialOfficePart(provincialOffice?: string | null) {
  if (!provincialOffice || provincialOffice === "All") return "All-Provincial-Offices";
  if (provincialOffice === "No Provincial Office") return "No-Provincial-Office";
  return filenamePart(provincialOffice);
}

export function buildExportFilename({
  group,
  versionName,
  versionId,
  region,
  provincialOffice,
  date = new Date()
}: ExportFilenameInput) {
  const version = filenamePart(versionName || versionId || "All Versions");
  return [
    group,
    version,
    regionPart(region),
    provincialOfficePart(provincialOffice),
    exportTimestamp(date)
  ].join("-") + ".xlsx";
}
