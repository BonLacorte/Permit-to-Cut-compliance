export function StatusBadge({ status }: { status: "Complete" | "Incomplete" }) {
  return <span className={`badge ${status === "Complete" ? "ok" : "warn"}`}>{status}</span>;
}
