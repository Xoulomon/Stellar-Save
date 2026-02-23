import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  maxVisiblePages?: number;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  maxVisiblePages = 5,
  disabled = false,
}: PaginationProps) {
  // Edge case: no pages
  if (totalPages === 0) {
    return null;
  }

  // Edge case: ensure current page is within bounds
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || disabled) {
      return;
    }
    onPageChange(page);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onPageSizeChange && !disabled) {
      onPageSizeChange(Number(e.target.value));
    }
  };

  // Calculate visible page numbers
  const getVisiblePages = (): (number | string)[] => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, safePage - halfVisible);
    let endPage = Math.min(totalPages, safePage + halfVisible);

    // Adjust if we're near the start or end
    if (safePage <= halfVisible) {
      endPage = Math.min(totalPages, maxVisiblePages);
    } else if (safePage >= totalPages - halfVisible) {
      startPage = Math.max(1, totalPages - maxVisiblePages + 1);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) {
        pages.push('...');
      }
    }

    // Add visible pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis and last page if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div className={`pagination ${disabled ? 'pagination-disabled' : ''}`}>
      <div className="pagination-info">
        Showing {startItem}-{endItem} of {totalItems}
      </div>

      <div className="pagination-controls">
        <button
          className="pagination-btn pagination-btn-prev"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={safePage === 1 || disabled}
          aria-label="Previous page"
        >
          ‹
        </button>

        <div className="pagination-pages">
          {visiblePages.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                className={`pagination-btn pagination-page ${
                  page === safePage ? 'pagination-page-active' : ''
                }`}
                onClick={() => handlePageChange(page as number)}
                disabled={disabled}
                aria-label={`Page ${page}`}
                aria-current={page === safePage ? 'page' : undefined}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          className="pagination-btn pagination-btn-next"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={safePage === totalPages || disabled}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      {showPageSizeSelector && onPageSizeChange && (
        <div className="pagination-size-selector">
          <label htmlFor="page-size-select" className="pagination-size-label">
            Per page:
          </label>
          <select
            id="page-size-select"
            className="pagination-size-select"
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={disabled}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
