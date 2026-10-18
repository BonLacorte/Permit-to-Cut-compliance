export type PermitGroup = "PTC" | "PTT";

export function normalizePermitNumber(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function duplicateNumberSet(values: unknown[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const number = normalizePermitNumber(value);
    if (number) counts.set(number, (counts.get(number) || 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([number]) => number));
}
