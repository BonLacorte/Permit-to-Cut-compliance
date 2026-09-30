"use client";

import Link from "next/link";
import { useState } from "react";
import { pttDashboardApplicationsHref, type PttDashboardData } from "@/lib/ptt-dashboard";

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function metricGridClass(count: number) {
  return count === 4 ? "grid cols-4" : count === 3 ? "grid cols-3" : count === 2 ? "grid cols-2" : "grid";
}

export function PttDashboardMetrics({ data, version }: { data: PttDashboardData; version: string }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(() => new Set());

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
              <article key={metric.id} className={`card stat dashboard-stat-card ${expanded ? "expanded" : ""}`}>
                <button className="dashboard-stat-toggle" type="button" aria-expanded={expanded} onClick={() => toggle(setExpandedRows, row.id)}>
                  <span>{metric.label}</span>
                  <div className="dashboard-stat-main"><strong>{metric.valueType === "currency" ? money(metric.total) : metric.total}</strong><em>{percent(metric.share)}</em></div>
                </button>
                {expanded ? <div className="dashboard-region-list">{metric.regions.map((region) => <Link key={region.region} className="dashboard-region-row" href={pttDashboardApplicationsHref({ version, region: region.region, metric: metric.id })}><span>{region.region}</span><strong>{metric.valueType === "currency" ? money(region.count) : region.count}</strong><em>{percent(region.share)}</em></Link>)}</div> : null}
              </article>
            ))}
          </section>
        );
      })}

      <section className="panel">
        <div className="section-heading-row"><div><h2>Records by Region and Provincial Office</h2><p className="muted">Expand a Region to view Provincial Office totals. Each row opens the matching PTT Applications view.</p></div></div>
        <div className="dashboard-office-list">
          {data.officeBreakdown.map((region) => {
            const expanded = expandedRegions.has(region.region);
            return <div key={region.region} className="dashboard-office-group"><div className="dashboard-office-row"><Link href={pttDashboardApplicationsHref({ version, region: region.region, metric: "total" })}>{region.region}<strong>{region.count}</strong></Link><button className="button secondary" type="button" aria-expanded={expanded} onClick={() => toggle(setExpandedRegions, region.region)}>{expanded ? "Hide offices" : "Show offices"}</button></div>{expanded ? <div className="dashboard-office-children">{region.provincialOffices.map((office) => <Link key={office.provincialOffice} className="dashboard-region-row" href={pttDashboardApplicationsHref({ version, region: region.region, provincialOffice: office.provincialOffice, metric: "total" })}><span>{office.provincialOffice}</span><strong>{office.count}</strong><em>{percent(region.count === 0 ? 0 : office.count / region.count)}</em></Link>)}</div> : null}</div>;
          })}
          {data.officeBreakdown.length === 0 ? <p className="empty-state">No PTT records found.</p> : null}
        </div>
      </section>
    </div>
  );
}
