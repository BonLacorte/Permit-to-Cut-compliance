import { getReportData } from "@/lib/data";

export default async function CompletionSummaryPage() {
  const { completion, applications } = await getReportData();

  return (
    <div className="grid">
      <div>
        <h1>Completion Summary</h1>
        <p className="muted">Overall and per-application complete vs incomplete records.</p>
      </div>
      <section className="grid cols-4">
        <div className="card stat"><span>Total</span><strong>{completion.total}</strong></div>
        <div className="card stat"><span>Complete</span><strong>{completion.complete}</strong></div>
        <div className="card stat"><span>Incomplete</span><strong>{completion.incomplete}</strong></div>
        <div className="card stat"><span>Completion Rate</span><strong>{Math.round(completion.completionRate * 100)}%</strong></div>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Type of application</th><th>Total</th><th>Complete</th><th>Incomplete</th><th>Completion Rate</th></tr></thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.applicationTypeId}>
                <td>{app.applicationTypeName}</td>
                <td>{app.totalRecords}</td>
                <td>{app.completeRecords}</td>
                <td>{app.incompleteRecords}</td>
                <td>{Math.round(app.completionRate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
