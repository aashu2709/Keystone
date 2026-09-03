import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/Table"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react"

export function DataTable({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  searchKeys = [],
  pageSize = 10,
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = "No data found",
  emptyDescription = "There are no records to display.",
  className,
  headerActions,
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchQuery.trim() || searchKeys.length === 0) return data
    const q = searchQuery.toLowerCase()
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = key.split('.').reduce((o, k) => o?.[k], row)
        return val && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, searchQuery, searchKeys])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedData = filteredData.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  )

  // Reset to page 1 when search changes
  const handleSearch = (value) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {searchable && <Skeleton className="h-9 w-72" />}
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search + Actions Bar */}
      {(searchable || headerActions) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {searchable && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
          {headerActions && <div className="flex gap-2">{headerActions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((col, i) => (
                <TableHead key={i} className={cn("text-xs font-semibold uppercase tracking-wider", col.className)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="rounded-full bg-muted p-3 mb-3">
                      <EmptyIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                    <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <TableRow key={row.id || rowIndex}>
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex} className={cn("text-sm", col.cellClassName)}>
                      {col.cell ? col.cell(row, rowIndex) : row[col.accessorKey]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredData.length > pageSize && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filteredData.length)} of {filteredData.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (safeCurrentPage <= 3) {
                pageNum = i + 1
              } else if (safeCurrentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = safeCurrentPage - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={safeCurrentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable
