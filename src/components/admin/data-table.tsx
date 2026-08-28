"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { BulkActionBar, type BulkAction } from "@/components/admin/bulk-action-bar";
import { EmptyState } from "@/components/admin/empty-state";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => BulkAction[];
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  selectable = false,
  bulkActions,
  onSortChange,
  emptyTitle = "Kayit bulunamadi",
  emptyDescription,
  emptyAction
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const allIds = useMemo(() => data.map(getRowId), [data, getRowId]);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(key: string) {
    const direction = sort?.key === key && sort.direction === "asc" ? "desc" : "asc";
    setSort({ key, direction });
    onSortChange?.(key, direction);
  }

  const clearSelection = () => setSelected(new Set());

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-admin-border bg-admin-surface">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectable && bulkActions && (
        <BulkActionBar count={selected.size} actions={bulkActions(Array.from(selected), clearSelection)} />
      )}
      <div className="overflow-x-auto rounded-lg border border-admin-border bg-admin-surface">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-admin-border text-left text-xs uppercase tracking-wide text-admin-text-muted">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-admin-text"
                    >
                      {col.header}
                      {sort?.key === col.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const id = getRowId(row);
              return (
                <tr key={id} className="border-b border-admin-border last:border-0 hover:bg-admin-bg/50">
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleRow(id)}
                        className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-admin-text ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
