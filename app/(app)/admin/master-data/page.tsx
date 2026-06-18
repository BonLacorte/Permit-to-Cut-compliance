import { createApplicationTypeAction, createRequiredDocumentAction, importPtcRecordsAction } from "@/app/actions";
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
          <p className="muted">Manage PTC application types, required documents, imports, and report exports.</p>
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

      <section className="grid cols-2">
        <form action={importPtcRecordsAction} className="panel form" encType="multipart/form-data">
          <h2>Import PTC Excel File</h2>
          <div className="instruction-box">
            <p><strong>Expected first-sheet column order:</strong></p>
            <ol>
              <li>Regional Office</li>
              <li>Provincial Office</li>
              <li>PTC Number</li>
              <li>Date Issued</li>
              <li>Name of Applicant</li>
              <li>Barangay</li>
              <li>Municipality</li>
              <li>No. of trees applied</li>
              <li>No. of trees approved</li>
              <li>No. of Seedlings Replacement</li>
            </ol>
            <p className="muted">Rows can be blank or incomplete. Imported rows are appended as new PTC records and duplicate PTC Numbers are allowed but flagged.</p>
          </div>
          <div className="field">
            <label htmlFor="ptcFile">PTC Excel file</label>
            <input id="ptcFile" name="file" type="file" accept=".xlsx,.xls" required />
          </div>
          <SubmitButton pendingText="Importing PTC records...">Import PTC Excel File</SubmitButton>
        </form>

        <div className="panel form disabled-panel">
          <h2>Import PTT Excel File</h2>
          <p className="muted">Coming soon. The PTT import workflow will be implemented in a future batch after the PTT record rules are finalized.</p>
          <button className="button secondary" type="button" disabled>Import PTT Excel File</button>
        </div>
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
