import { mutate } from 'swr';

/** Invalidate dashboard cache after mutations (e.g. new transaction, wallet). */
export function invalidateDashboard(websiteId?: string) {
  const params = new URLSearchParams();
  if (websiteId && websiteId !== '__all__') params.set('websiteId', websiteId);
  void mutate(`/api/dashboard?${params.toString()}`);
  if (websiteId !== '__all__') void mutate('/api/dashboard');
}
