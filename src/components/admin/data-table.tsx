"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { BulkActionBar, type BulkAction } from "@/components/admin/bulk-action-bar";
import { EmptyState } from "@/components/admin/empty-state";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** Kolonun "Sütunlar" panelinden gizlenebilir olup olmadığı. Varsayılan true. */
  hideable?: boolean;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => BulkAction[];
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  initialSort?: { key: string; direction: "asc" | "desc" } | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Verilince tabloya "Sütunlar" göster/gizle paneli eklenir, tercih bu anahtarla localStorage'a yazılır. */
  columnVisibilityStorageKey?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  selectable = false,
  bulkActions,
  onSortChange,
  initialSort = null,
  emptyTitle = "Kayit bulunamadi",
  emptyDescription,
  emptyAction,
  columnVisibilityStorageKey
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(initialSort);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnVisibilityStorageKey) return;
    try {
      const raw = localStorage.getItem(columnVisibilityStorageKey);
      if (raw) setHiddenKeys(new Set(JSON.parse(raw)));
    } catch {
      // localStorage erişilemiyorsa (gizli sekme vb.) sessizce varsayılana dön
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnVisibilityStorageKey]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setColumnsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnsMenuOpen]);

  function toggleColumn(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (columnVisibilityStorageKey) {
        try {
          localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(Array.from(next)));
        } catch {
          // yazilamazsa tercih sadece bu oturumda gecerli olur
        }
      }
      return next;
    });
  }

  const hideableColumns = columns.filter((c) => c.hideable !== false);
  const visibleColumns = columns.filter((c) => c.hideable === false || !hiddenKeys.has(c.key));

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
      {columnVisibilityStorageKey && hideableColumns.length > 0 && (
        <div className="flex justify-end">
          <div ref={columnsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setColumnsMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-admin-border bg-admin-surface px-3 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg"
            >
              <Columns3 size={14} />
              Sütunlar
            </button>
            {columnsMenuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-admin-border bg-admin-surface p-2 shadow-lg">
                {hideableColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-admin-text hover:bg-admin-bg"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenKeys.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                    />
                    {col.header || col.key}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
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
              {visibleColumns.map((col) => (
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
                  {visibleColumns.map((col) => (
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
