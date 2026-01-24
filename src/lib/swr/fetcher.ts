/**
 * SWR Fetcher utility
 * Standard fetcher for JSON API responses
 */

export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }

  return response.json();
}

/**
 * Fetcher with POST method for mutations
 */
export async function postFetcher<T>(url: string, { arg }: { arg: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = new Error('An error occurred while posting the data.');
    throw error;
  }

  return response.json();
}
