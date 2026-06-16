"use client";

import { useMemo, useState } from "react";
import { BulletList } from "@/components/bullet-list";

type CellValue = string | number | string[];

type Column<Row> = {
  key: keyof Row & string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: "text" | "number" | "percent" | "list";
};

type Sort<Row> = { key: keyof Row & string; direction: "asc" | "desc" } | null;

function renderValue(value: CellValue, type: Column<any>["type"]) {
  if (type === "list") return <BulletList items={Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim())} />;
  if (type === "percent" && typeof value === "number") return `${Math.round(value * 100)}%`;
  return value || <span className="muted">None</span>;
}

export function ReportTable<Row extends Record<string, CellValue>>({
  rows,
  columns,
  empty = "No records found."
}: {
  rows: Row[];
  columns: Column<Row>[];
  empty?: string;
}) {
  const firstSortable = columns.find((column) => column.sortable)?.key || null;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort<Row>>(firstSortable ? { key: firstSortable, direction: "asc" } : null);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filterable = columns.filter((column) => column.filterable !== false);
    const base = !text
      ? rows
      : rows.filter((row) =>
          filterable.some((column) => String(row[column.key] || "").toLowerCase().includes(text))
        );

    if (!sort) return base;
    return [...base].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left || "").localeCompare(String(right || ""));
      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, columns, query, sort]);

  function sortBy(column: Column<Row>) {
    if (!column.sortable) return;
    setSort((current) => ({
      key: column.key,
      direction: current?.key === column.key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  return (
    <>
      <div className="table-toolbar">
        <label className="table-search">
          <span>Filter</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search table" />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  {column.sortable ? (
                    <button className="th-button" type="button" onClick={() => sortBy(column)}>
                      {column.label}{sort?.key === column.key ? (sort.direction === "asc" ? " asc" : " desc") : ""}
                    </button>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={column.key}>{renderValue(row[column.key], column.type)}</td>)}
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan={columns.length}>{empty}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}