"use client";

import { useState } from "react";
import type { DashboardData } from "@/lib/dashboard";


function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function metricValue(metric: { total: number; valueType?: "count" | "currency" }) {
  return metric.valueType === "currency" ? money(metric.total) : String(metric.total);
}

function regionValue(region: { count: number }, valueType?: "count" | "currency") {
  return valueType === "currency" ? money(region.count) : String(region.count);
}
function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function metricGridClass(count: number) {
  if (count === 1) return "grid";
  if (count === 2) return "grid cols-2";
  return count === 3 ? "grid cols-3" : "grid cols-4";
}

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const missingRows = data.topMissingByRegion.All || [];
  const applicationRows = data.topApplicationsByRegion.All || [];

  function toggleRow(rowId: string) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  return (
    <div className="grid">
      {data.metricRows.map((row) => {
        const expanded = expandedRows.has(row.id);
        return (
          <section key={row.id} className={metricGridClass(row.metrics.length)}>
            {row.metrics.map((metric) => (
              <button
                key={metric.id}
                className={`card stat dashboard-stat-card ${expanded ? "expanded" : ""}`}
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleRow(row.id)}
              >
                <span>{metric.label}</span>
                <div className="dashboard-stat-main">
                  <strong>{metricValue(metric)}</strong>
                  <em>{percent(metric.share)}</em>
                </div>
                {expanded ? (
                  <div className="dashboard-region-list">
                    {metric.regions.map((region) => (
                      <div key={region.region} className="dashboard-region-row">
                        <span>{region.region}</span>
                        <strong>{regionValue(region, metric.valueType)}</strong>
                        <em>{percent(region.share)}</em>
                      </div>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </section>
        );
      })}

      <section className="grid cols-2">
        <div className="panel">
          <div className="section-heading-row">
            <div>
              <h2>Top Missing Documents</h2>
              <p className="muted">Most frequently missing required documents by selected region.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Document</th><th>Missing Count</th></tr></thead>
              <tbody>
                {missingRows.map((doc) => (
                  <tr key={doc.requiredDocumentId}>
                    <td>{doc.requiredDocumentName}</td>
                    <td>{doc.missingCount}</td>
                  </tr>
                ))}
                {missingRows.length === 0 ? <tr><td colSpan={2}>No missing documents yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-heading-row">
            <div>
              <h2>Top Application Summary</h2>
              <p className="muted">Most submitted types of application by selected region.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type of Application</th>
                  <th>Total</th>
                  <th>Complete</th>
                  <th>Incomplete</th>
                  <th>Pending</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {applicationRows.map((app) => (
                  <tr key={app.applicationTypeId || "pending"}>
                    <td>{app.applicationTypeName}</td>
                    <td>{app.totalRecords}</td>
                    <td>{app.completeRecords}</td>
                    <td>{app.incompleteRecords}</td>
                    <td>{app.pendingRecords}</td>
                    <td>{percent(app.share)}</td>
                  </tr>
                ))}
                {applicationRows.length === 0 ? <tr><td colSpan={6}>No application records yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}