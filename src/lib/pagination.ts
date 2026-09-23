export interface BitbucketPage<T> {
  values: T[];
  isLastPage: boolean;
  nextPageStart?: number | null;
}

/**
 * Bitbucket Data Center REST API paginates most list endpoints (start/nextPageStart/isLastPage).
 * Walks every page up to maxPages as a safety cap against runaway/malformed pagination.
 */
export async function paginateAll<T>(
  fetchPage: (start: number) => Promise<BitbucketPage<T>>,
  maxPages = 50
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(start);
    all.push(...page.values);
    if (page.isLastPage || page.nextPageStart === undefined || page.nextPageStart === null) {
      break;
    }
    start = page.nextPageStart;
  }
  return all;
}
