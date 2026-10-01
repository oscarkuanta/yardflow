import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from './Skeleton.jsx';

const SKELETON_ROWS = 5;

function SkeletonRows({ columnCount }) {
  return Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
    <tr key={rowIndex}>
      {Array.from({ length: columnCount }, (_, cellIndex) => (
        <td key={cellIndex} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-32" />
        </td>
      ))}
    </tr>
  ));
}

export function DataTable({
  label,
  columns,
  rows,
  rowKey,
  isPending,
  empty,
  onRowClick,
  rowClassName,
}) {
  const showEmpty = !isPending && rows.length === 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm" aria-label={label}>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-3 font-medium ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isPending && <SkeletonRows columnCount={columns.length} />}
          {!isPending &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-tile' : ''
                } ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 align-middle ${column.wrap ? '' : 'whitespace-nowrap'} ${
                      column.className ?? ''
                    }`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {showEmpty && empty}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return null;
  }
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted"
    >
      <span className="numeric">
        {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-tile disabled:opacity-40"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="numeric px-2">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-tile disabled:opacity-40"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
