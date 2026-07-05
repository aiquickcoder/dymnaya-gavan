import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  /** доп. класс шапки (напр. "th-actions") */
  headerClassName?: string;
  /** доп. класс ячейки */
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * Универсальная таблица (.dtable) с клиентской сортировкой по sortable-колонкам.
 * Сортировка идёт по сырому значению row[key]; render — только для показа.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = "Нет данных",
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * cmp(cell(a, sort.key), cell(b, sort.key)));
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <div className="dtable">
      <table>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const cls = [
                c.sortable ? "sortable" : "",
                active ? "sorted" : "",
                c.headerClassName ?? "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <th
                  key={c.key}
                  className={cls || undefined}
                  style={{ textAlign: c.align ?? "left" }}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.title}
                  {c.sortable && (
                    <span className="caret" aria-hidden="true">
                      {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td className="dt-empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? "rowlink" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.cellClassName}
                    style={{ textAlign: c.align ?? "left" }}
                  >
                    {c.render ? c.render(row) : asText(cell(row, c.key))}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function cell<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function asText(v: unknown): ReactNode {
  if (v === null || v === undefined) return "";
  return String(v);
}

function cmp(a: unknown, b: unknown): number {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ru");
}
