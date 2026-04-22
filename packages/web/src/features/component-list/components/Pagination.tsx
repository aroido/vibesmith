/**
 * Pagination Component
 * 페이지네이션 컨트롤
 */

import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  const { t } = useTranslation('components');

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // 최대 표시 페이지 수

    if (totalPages <= maxVisible) {
      // 모든 페이지 표시
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 페이지 수가 많을 때
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <nav
      className="vs-frost-panel flex items-center justify-between rounded-xl px-4 py-3"
      aria-label={t('list.paginationAria')}
      data-testid="component-list-pagination"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm text-theme-secondary">
          {t('list.paginationInfo', {
            start: startItem,
            end: endItem,
            total: totalItems,
          })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          data-testid="component-list-pagination-prev-button"
          className="px-3 py-1.5 rounded-lg btn-theme-surface text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('list.previousPage')}
        >
          {t('list.previous')}
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-theme-tertiary">
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                data-testid={`component-list-pagination-page-${pageNum}`}
                className={`min-w-[2.5rem] px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'btn-theme-primary-soft'
                    : 'btn-theme-surface text-theme-secondary'
                }`}
                aria-label={t('list.goToPage', { page: pageNum })}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          data-testid="component-list-pagination-next-button"
          className="px-3 py-1.5 rounded-lg btn-theme-surface text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('list.nextPage')}
        >
          {t('list.next')}
        </button>
      </div>
    </nav>
  );
}
