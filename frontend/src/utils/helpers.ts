/**
 * Strip HTML tags from a string
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 */
export const stripHtml = (html: string | undefined): string => {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

/**
 * Load all paginated items from an API with optional progressive updates
 * @param fetchFunction - Function that fetches a page of data
 * @param limit - Number of items per page
 * @param onBatch - Optional callback called after each batch loads (for progressive UI updates)
 * @param maxItems - Optional maximum number of items to load (prevents loading too much data)
 * @returns Array of all items
 */
export const loadAllPages = async <T>(
  fetchFunction: (params: { offset: number; limit: number }) => Promise<{ items: T[]; total: number }>,
  limit: number = 100,
  onBatch?: (items: T[]) => void,
  maxItems?: number
): Promise<T[]> => {
  let allItems: T[] = [];
  let offset = 0;
  let total = 0;
  
  do {
    const response = await fetchFunction({ offset, limit });
    allItems = [...allItems, ...response.items];
    total = response.total;
    offset += limit;
    
    // Call callback after each batch for progressive UI updates
    if (onBatch) {
      onBatch([...allItems]);
    }
    
    // Stop if we've reached the maximum
    if (maxItems && allItems.length >= maxItems) {
      allItems = allItems.slice(0, maxItems);
      if (total > maxItems) {
        console.warn(`Loaded ${maxItems} of ${total} items (max limit reached)`);
      }
      break;
    }
  } while (allItems.length < total);
  
  return allItems;
};

