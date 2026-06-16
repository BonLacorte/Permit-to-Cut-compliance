import Link from "next/link";
import { getReportData } from "@/lib/data";

export default async function DashboardPage() {
  const report = await getReportData();
  const topMissing = report.documents
    .filter((doc) => doc.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, 5);

  return (
    <div className="grid">
      <div>
        <h1>Compliance Dashboard</h1>
        <p className="muted">Live audit view powered by application records and required documents.</p>
      </div>

      <section className="grid cols-4">
        <div className="card stat"><span>Total Records</span><strong>{report.completion.total}</strong></div>
        <div className="card stat"><span>Complete Records</span><strong>{report.completion.complete}</strong></div>
        <div className="card stat"><span>Incomplete Records</span><strong>{report.completion.incomplete}</strong></div>
        <div className="card stat"><span>Completion Rate</span><strong>{Math.round(report.completion.completionRate * 100)}%</strong></div>
      </section>

      <section className="grid cols-2">
        <div className="panel">
          <h2>Top Missing Documents</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Document</th><th>Missing Count</th></tr></thead>
              <tbody>
                {topMissing.map((doc) => (
                  <tr key={doc.requiredDocumentId}>
                    <td>{doc.requiredDocumentName}</td>
                    <td>{doc.missingCount}</td>
                  </tr>
                ))}
                {topMissing.length === 0 ? <tr><td colSpan={2}>No missing documents yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Quick Actions</h2>
          <div className="actions">
            <Link className="button" href="/applications/new">New Application</Link>
            <Link className="button secondary" href="/reports/missing-documents">Review Missing Documents</Link>
            <Link className="button secondary" href="/api/export">Export Excel</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
