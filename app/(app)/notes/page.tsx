export default function NotesPage() {
  return (
    <div className="grid">
      <div>
        <h1>Notes</h1>
        <p className="muted">Workflow guide for the web version of the compliance workbook.</p>
      </div>
      <section className="panel">
        <ol>
          <li>Create an application record with the applicant name and type of application.</li>
          <li>Open the record and append progress as documents are submitted.</li>
          <li>Documents already selected by any user are marked as already selected and cannot be duplicated.</li>
          <li>Reports update from database records and no longer depend on fixed Excel columns.</li>
          <li>Admins can import master data from Excel and export report workbooks when office workflows need them.</li>
        </ol>
      </section>
    </div>
  );
}
