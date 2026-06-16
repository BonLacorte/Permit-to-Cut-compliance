import { createApplicationTypeAction, createRequiredDocumentAction } from "@/app/actions";
import { BulletList } from "@/components/bullet-list";
import { ExportExcelButton } from "@/components/export-excel-button";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { getApplicationTypesWithDocuments } from "@/lib/data";

export default async function MasterDataPage() {
  await requireAdmin();
  const applicationTypes = await getApplicationTypesWithDocuments();

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <h1>Master Data</h1>
          <p className="muted">Manage application types and required documents without changing the database schema.</p>
        </div>
        <ExportExcelButton />
      </div>
      <section className="grid cols-2">
        <form action={createApplicationTypeAction} className="panel form">
          <h2>Add Application Type</h2>
          <div className="field">
            <label htmlFor="name">Type of application</label>
            <input id="name" name="name" required />
          </div>
          <SubmitButton pendingText="Adding type...">Add Type</SubmitButton>
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
          <SubmitButton pendingText="Adding document...">Add Document</SubmitButton>
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