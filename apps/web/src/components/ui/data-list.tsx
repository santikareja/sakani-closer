import type { ReactNode } from "react";

export interface DataListColumn {
  key: string;
  label: string;
}

export interface DataListRow {
  key: string;
  cells: Record<string, ReactNode>;
}

export function DataList({
  columns,
  rows,
  caption,
}: {
  columns: DataListColumn[];
  rows: DataListRow[];
  caption: string;
}) {
  return (
    <div className="data-list-scroll">
      <table className="data-list">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((column) => (
                <td data-label={column.label} key={column.key}>
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
