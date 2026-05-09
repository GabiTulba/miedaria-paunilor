// After deleting a row from a paginated list, decide whether to step the current page
// back (if we just removed the last item on a non-first page) or just refetch the
// current page. Returns the action the caller should perform.
//
// Usage:
//   const after = afterDeleteAction(items.length, page);
//   if (after === 'prev-page') setPage(page - 1); else refetch();
export function afterDeleteAction(itemsRemaining: number, currentPage: number): 'prev-page' | 'refetch' {
    return itemsRemaining === 1 && currentPage > 1 ? 'prev-page' : 'refetch';
}
