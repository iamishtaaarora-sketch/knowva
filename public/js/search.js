export const NEEDS = /\b(latest|today|current|currently|news|recent|right now|this (week|month|year)|price|score|weather|202\d)\b/i;
export async function loadProviders() {
  try { return (await (await fetch('/api/search/providers')).json()).providers; } catch { return []; }
}
export async function runSearch(query, providers, signal) {
  const r = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, providers }), signal });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Search failed');
  return r.json();
}
