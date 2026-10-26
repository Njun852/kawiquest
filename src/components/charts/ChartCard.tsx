"use client";

import { useState, type ReactNode } from "react";
import { Card, CardBody, CardHead, Segmented } from "@/components/ui";

export type ChartTable = { columns: string[]; rows: (string | number)[][]; numeric?: boolean[] };

/**
 * A chart in a card, with a Chart / Table switch: every value is reachable without hovering (dataviz: a table view
 * always exists).
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  table: ChartTable;
  children: ReactNode;
}) {
  const [view, setView] = useState("chart");
  return (
    <Card>
      <CardHead title={title}>
        <Segmented
          label={`${title}: view`}
          value={view}
          onChange={setView}
          items={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </CardHead>
      <CardBody className="kq-stack" style={{ gap: 12 }}>
        {subtitle && <p className="kq-muted" style={{ margin: 0, fontSize: 13 }}>{subtitle}</p>}
        {view === "chart" ? (
          <>
            {legend}
            {children}
          </>
        ) : (
          <div className="kq-table-wrap">
            <table className="kq-table">
              <caption className="kq-sr-only">{title}</caption>
              <thead>
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={table.numeric?.[i] ? "num" : undefined}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={table.numeric?.[j] ? "num" : undefined}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Legend: rect keys for bars, mirrored from the marks. Text stays in text tokens. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="kq-legend" role="list" aria-label="Legend">
      {items.map((i) => (
        <span key={i.label} role="listitem">
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return <div className="kq-chart-empty">{children}</div>;
}
