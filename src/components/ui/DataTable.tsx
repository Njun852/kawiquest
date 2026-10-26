import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  /** "num": right-aligned mono; "kawi": the form column in Noto Sans Kawi; "mono": code points and versions. */
  kind?: "num" | "kawi" | "mono";
};

// Header on surface-2 in label style, line hairlines, selected row on copper-tint.
// No hooks, so it renders on the server; pass onRowClick only from a client component.
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  selectedKey,
  onRowClick,
  empty = "Nothing here yet.",
  caption,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectedKey?: string | null;
  onRowClick?: (row: Row) => void;
  empty?: ReactNode;
  caption?: string;
}) {
  return (
    <div className="kq-table-wrap">
      <table className="kq-table">
        {caption && <caption className="kq-sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cx(c.kind === "num" && "num")} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="kq-empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={cx(key === selectedKey && "is-selected", onRowClick && "is-clickable")}
                aria-selected={onRowClick ? key === selectedKey : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(c.kind === "num" && "num", c.kind === "kawi" && "kq-k", c.kind === "mono" && "kq-mono")}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
