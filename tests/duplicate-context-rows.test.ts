import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PtcContextRows, type PtcContextRecord } from "@/components/duplicates/ptc-context-rows";
import { duplicateMergeFields, selectMergedRecord } from "@/lib/duplicate-merge";

const records: PtcContextRecord[] = [
  { id: "typed", applicationType: { name: "Regular Application" }, progressDocuments: [{ requiredDocument: { name: "Ownership Certificate" } }, { requiredDocument: { name: "Inspection Report" } }] },
  { id: "empty", applicationType: null, progressDocuments: [] },
  { id: "partial", applicationType: { name: "Archived Type" }, progressDocuments: [{ requiredDocument: { name: "Older Document" } }] }
];
const render = (keeperId: string, rows = records) => renderToStaticMarkup(React.createElement("table", null, React.createElement("tbody", null, React.createElement(PtcContextRows, { records: rows, keeperId }))));
describe("display-only duplicate record context", () => {
  it("renders both named rows with populated values, document counts/lists, and None for missing values", () => {
    const html = render("");
    expect(html).toContain("Type of Application"); expect(html).toContain("Submitted Documents");
    expect(html).toContain("Regular Application"); expect(html).toContain("2 submitted"); expect(html).toContain("Ownership Certificate"); expect(html).toContain("Inspection Report");
    expect(html).toContain("Archived Type"); expect(html).toContain("Older Document"); expect(html.match(/<td>None<\/td>/g)).toHaveLength(2);
    expect(html).not.toContain("<input"); expect(html).not.toContain("checkbox"); expect(html).toContain("Display only — not copied");
  });
  it("uses only the selected survivor's context in both final-result cells", () => {
    const html = render("empty");
    expect(html.match(/class="merge-result">None<small>Retained record only — unchanged/g)).toHaveLength(2);
    const populated = render("typed"); expect(populated).toContain('class="merge-result">Regular Application');
    expect(populated).toContain('class="merge-result"><span>2 submitted</span>');
  });
  it("handles absent/blank related data without failing", () => {
    const html = render("missing", [{ id: "missing", applicationType: { name: "  " }, progressDocuments: [{ requiredDocument: null }] }, { id: "absent" }]);
    expect(html.match(/<td>None<\/td>/g)).toHaveLength(4); expect(html).not.toContain("undefined");
  });
  it.each(["applicationTypeId", "applicationType", "progressDocuments", "selectedDocumentIds"])("keeps %s outside the transfer allowlist and rejects forged copying", (field) => {
    expect(duplicateMergeFields("PTC").some((item) => item.key === field)).toBe(false);
    expect(() => selectMergedRecord(records.map((record) => ({ ...record, group: "PTC", ptcNumber: "same" })), { group: "PTC", keeperId: "empty", deleteIds: ["typed"], transfers: [{ field, sourceId: "typed" }] })).toThrow("Protected fields cannot be transferred");
  });
});
