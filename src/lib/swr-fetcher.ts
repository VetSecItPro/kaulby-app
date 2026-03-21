/**
 * Shared SWR fetcher for client-side data fetching.
 * Returns parsed JSON or throws on non-OK responses.
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Fetch failed");
    throw error;
  }
  return res.json();
};
