import { VersionFilter } from "@/components/version-filter";
import { getReportData, getVersionContext } from "@/lib/data";

export default async function CompletionSummaryPage({ searchParams }: { searchParams?: { version?: string | string[] } }) {
  const versionContext = await getVersionContext(searchParams?.version);
  const { completion, applications } = await getReportData({ versionId: versionContext.selectedVersionId });

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Completion Summary</h1>
          <p className="muted">Overall and per-application complete, incomplete, and pending records.</p>
        </div>
        <VersionFilter options={versionContext.options} selected={versionContext.selectedVersionParam} path="/reports/completion-summary" />
      </div>
      <section className="grid cols-4">
        <div className="card stat"><span>Total</span><strong>{completion.total}</strong></div>
        <div className="card stat"><span>Complete</span><strong>{completion.complete}</strong></div>
        <div className="card stat"><span>Incomplete</span><strong>{completion.incomplete}</strong></div>
        <div className="card stat"><span>Pending</span><strong>{completion.pending}</strong></div>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Type of application</th><th>Total</th><th>Complete</th><th>Incomplete</th><th>Pending</th><th>Completion Rate</th></tr></thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.applicationTypeId}>
                <td>{app.applicationTypeName}</td>
                <td>{app.totalRecords}</td>
                <td>{app.completeRecords}</td>
                <td>{app.incompleteRecords}</td>
                <td>{app.pendingRecords}</td>
                <td>{Math.round(app.completionRate * 100)}%</td>
              </tr>
            ))}
            {applications.length === 0 ? <tr><td colSpan={6}>No records found.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
