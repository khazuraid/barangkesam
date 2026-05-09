'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Columns3,
  Search,
} from 'lucide-react';
import * as React from 'react';

export interface DataTableProps<TData, TValue> {
  /** Column definitions from TanStack Table */
  columns: ColumnDef<TData, TValue>[];
  /** Row data */
  data: TData[];
  /** Loading state shows skeleton rows */
  isLoading?: boolean;
  /** Number of skeleton rows while loading */
  skeletonRows?: number;
  /** Placeholder for the global search input. Pass null to hide the input */
  searchPlaceholder?: string | null;
  /** Initial page size (default 10) */
  pageSize?: number;
  /** Fires when a row is double-clicked. Use to navigate to detail, etc. */
  onRowDoubleClick?: (row: TData) => void;
  /** Fires when a row is single-clicked (optional) */
  onRowClick?: (row: TData) => void;
  /** Shown when data is empty */
  emptyMessage?: React.ReactNode;
  /** Additional actions rendered next to the search bar (e.g. "Tambah" button) */
  toolbarActions?: React.ReactNode;
  /** Hide the column-visibility dropdown */
  hideColumnToggle?: boolean;
  /** Extra className for the outer wrapper */
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  skeletonRows = 6,
  searchPlaceholder = 'Cari...',
  pageSize = 10,
  onRowDoubleClick,
  onRowClick,
  emptyMessage = 'Tidak ada data',
  toolbarActions,
  hideColumnToggle = false,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount() || 1;

  return (
    <div className={className}>
      {/* Toolbar */}
      {(searchPlaceholder !== null || toolbarActions || !hideColumnToggle) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {searchPlaceholder !== null && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 h-10"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {toolbarActions}
            {!hideColumnToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      <Columns3 className="w-4 h-4 mr-2" />
                      Kolom
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Tampilkan Kolom</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllColumns()
                    .filter((col) => col.getCanHide())
                    .map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        className="capitalize"
                        checked={col.getIsVisible()}
                        onCheckedChange={(v) => col.toggleVisibility(!!v)}
                      >
                        {(col.columnDef.meta as { label?: string } | undefined)?.label ?? col.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} style={{ width: header.getSize?.() }}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors group"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-slate-400 group-hover:text-slate-600">
                            {sortDir === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5" />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
                            )}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton static list
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  {table.getAllLeafColumns().map((col) => (
                    <TableCell key={col.id}>
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    onRowDoubleClick || onRowClick ? 'cursor-pointer select-none' : undefined
                  }
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onDoubleClick={
                    onRowDoubleClick ? () => onRowDoubleClick(row.original) : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm">
        <div className="text-slate-500">
          Menampilkan{' '}
          <span className="font-medium text-slate-900">
            {totalRows === 0
              ? 0
              : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          </span>
          {' – '}
          <span className="font-medium text-slate-900">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              totalRows,
            )}
          </span>{' '}
          dari <span className="font-medium text-slate-900">{totalRows}</span> data
        </div>
        <div className="flex items-center gap-2">
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / hal
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 text-xs text-slate-600 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(totalPages - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
