import React, { useRef, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  selectedIds?: Set<string>;
  onSelectAll?: (selected: boolean) => void;
  onSelectRow?: (id: string, selected: boolean) => void;
  selectable?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  sortBy,
  sortOrder = "asc",
  onSort,
  selectedIds = new Set(),
  onSelectAll,
  onSelectRow,
  selectable = false,
}: DataTableProps<T>) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < data.length;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  return (
    <div className="bg-card-bg border border-line rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-soft bg-page-bg">
              {selectable && (
                <th className="px-4 py-3 text-left w-12">
                  <input
                    ref={checkboxRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="rounded cursor-pointer"
                    style={{
                      accentColor: "var(--brand)",
                    }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-ink-muted ${col.className || ""}`}
                >
                  {col.sortable && onSort ? (
                    <button
                      onClick={() => onSort(col.key)}
                      className="flex items-center gap-1 hover:text-ink-secondary transition-colors"
                    >
                      {col.label}
                      {sortBy === col.key && (
                        <span className="flex-shrink-0">
                          {sortOrder === "asc" ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-8 text-center text-ink-muted"
                >
                  No results found.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-line-soft hover:bg-page-bg transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${selectedIds.has(row.id) ? "bg-ok-bg/30" : ""}`}
                  onClick={() => !selectable && onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) => onSelectRow?.(row.id, e.target.checked)}
                        className="rounded cursor-pointer"
                        style={{
                          accentColor: "var(--brand)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-ink-primary ${col.className || ""}`}
                    >
                      {col.render
                        ? col.render((row as any)[col.key], row)
                        : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
