import { createApplicationTypeAction, createRequiredDocumentAction, importMasterDataAction } from "@/app/actions";
import { BulletList } from "@/components/bullet-list";
import { requireAdmin } from "@/lib/auth";
import { getApplicationTypesWithDocuments } from "@/lib/data";

export default async function MasterDataPage() {
  await requireAdmin();
  const applicationTypes = await getApplicationTypesWithDocuments();

  return (
    <div className="grid">
      <div>
        <h1>Master Data</h1>
        <p className="muted">Manage application types and required documents without changing the database schema.</p>
      </div>
      <section className="grid cols-2">
        <form action={createApplicationTypeAction} className="panel form">
          <h2>Add Application Type</h2>
          <div className="field">
            <label htmlFor="name">Type of application</label>
            <input id="name" name="name" required />
          </div>
          <button className="button" type="submit">Add Type</button>
        </form>

        <form action={createRequiredDocumentAction} className="panel form">
          <h2>Add Required Document</h2>
          <div className="field">
            <label htmlFor="applicationTypeId">Type of application</label>
            <select id="applicationTypeId" name="applicationTypeId" required>
              <option value="">Choose type</option>
              {applicationTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="docName">Type of document</label>
            <input id="docName" name="name" required />
          </div>
          <button className="button" type="submit">Add Document</button>
        </form>
      </section>

      <section className="panel">
        <h2>Import Master Data</h2>
        <div className="instruction-box">
          <h3>Excel template instructions</h3>
          <ol>
            <li>Upload an `.xlsx` or `.xls` file with one row per required document.</li>
            <li>The first sheet must contain a column named <strong>Grounds for Cutting</strong> or <strong>Type of application</strong>.</li>
            <li>The same sheet must contain a column named <strong>Additional Documents Needed</strong> or <strong>Type of document</strong>.</li>
            <li>Each unique application type will be created or updated.</li>
            <li>Each document under that application type will be created or reactivated if it already exists.</li>
            <li>The import does not delete old master data automatically, so existing records remain safe.</li>
          </ol>
        </div>
        <form action={importMasterDataAction} className="actions">
          <input name="file" type="file" accept=".xlsx,.xls" required />
          <button className="button" type="submit">Import Excel</button>
          <a className="button secondary" href="/api/export">Export Reports</a>
        </form>
      </section>

      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Type of application</th><th>Required Documents</th></tr></thead>
          <tbody>
            {applicationTypes.map((type) => (
              <tr key={type.id}>
                <td>{type.name}</td>
                <td><BulletList items={type.documents.map((doc) => doc.name)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}