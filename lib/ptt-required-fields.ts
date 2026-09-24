export type PttRequiredDateSource = {
  dateIssued?: string | Date | null;
  dateValidatedInspected?: string | Date | null;
};

function hasValue(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

export function pttRequiredDateMessages(record: PttRequiredDateSource) {
  return [
    hasValue(record.dateIssued) ? null : "There's no date in Date Issued field.",
    hasValue(record.dateValidatedInspected) ? null : "There's no date in Date Validated/Inspected field."
  ].filter((message): message is string => Boolean(message));
}

export function pttRequiredDateFinding(record: PttRequiredDateSource) {
  const messages = pttRequiredDateMessages(record);
  return messages.length > 0 ? messages.join("\n") : null;
}
