/**
 * SWR Fetcher for client-side data caching
 * Provides type-safe, error-handled data fetching
 */

export class FetchError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

/**
 * Default fetcher for SWR - handles JSON responses and errors
 */
export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    const info = await res.json().catch(() => null);
    throw new FetchError(
      info?.error || `An error occurred while fetching ${url}`,
      res.status,
      info
    );
  }

  return res.json();
};

/**
 * Fetcher with credentials for authenticated requests
 */
export const authFetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) {
    const info = await res.json().catch(() => null);
    throw new FetchError(
      info?.error || `An error occurred while fetching ${url}`,
      res.status,
      info
    );
  }

  return res.json();
};

/**
 * POST fetcher for mutations
 */
export const postFetcher = async <T>(
  url: string,
  { arg }: { arg: unknown }
): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(arg),
  });

  if (!res.ok) {
    const info = await res.json().catch(() => null);
    throw new FetchError(
      info?.error || `An error occurred while posting to ${url}`,
      res.status,
      info
    );
  }

  return res.json();
};
