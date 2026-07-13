import type { AuditStatus } from "@/lib/reporting";

export function StatusBadge({ status }: { status: AuditStatus }) {
  const tone = status === "Complete" ? "ok" : status === "Pending" ? "neutral" : "warn";
  return <span className={`badge ${tone}`}>{status}</span>;
}