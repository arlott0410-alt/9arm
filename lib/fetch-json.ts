/** Safely parse JSON from fetch response. Handles HTML/plain text error pages. */
export async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: res.ok ? 'Invalid response' : `Server error (${res.status})` } as T;
  }
}
