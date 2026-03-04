const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;

export type PageParams = {
  page: number;
  pageSize: number;
  offset: number;
};

/**
 * Parse page and pageSize from URL searchParams.
 * page starts at 1.
 * pageSize default 10; allowed 10, 20, 50.
 */
export function parsePageParams(
  searchParams: URLSearchParams,
  defaultPageSize: number = DEFAULT_PAGE_SIZE
): PageParams {
  const pageRaw = searchParams.get('page');
  const pageSizeRaw = searchParams.get('pageSize');

  let page = 1;
  if (pageRaw != null) {
    const n = parseInt(pageRaw, 10);
    if (!isNaN(n) && n >= 1) page = n;
  }

  let pageSize = defaultPageSize;
  if (pageSizeRaw != null) {
    const n = parseInt(pageSizeRaw, 10);
    if (!isNaN(n) && ALLOWED_PAGE_SIZES.includes(n as (typeof ALLOWED_PAGE_SIZES)[number]))
      pageSize = n;
  } else if (!ALLOWED_PAGE_SIZES.includes(pageSize as (typeof ALLOWED_PAGE_SIZES)[number])) {
    pageSize = DEFAULT_PAGE_SIZE;
  }

  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function getDefaultPageSize(route: 'transactions' | 'bonuses' | 'transfers' | 'credit-cuts'): number {
  return route === 'transactions' ? 20 : 10;
}

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export function buildPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    items,
    page,
    pageSize,
    totalCount,
  };
}
