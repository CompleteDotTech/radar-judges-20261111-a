export function createShortlist(storage, runId) {
  const key = `radar:${runId}:shortlist`;
  let ids = new Set();
  try {
    const parsed = JSON.parse(storage.getItem(key));
    if (Array.isArray(parsed)) ids = new Set(parsed.filter(id => typeof id === 'string' && id.length > 0));
  } catch { /* Storage may be unavailable; retain an in-memory shortlist. */ }
  return {
    list: () => [...ids],
    values: () => [...ids],
    has: id => ids.has(id),
    toggle(id) {
      if (typeof id !== 'string' || !id) return false;
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      try { storage.setItem(key, JSON.stringify([...ids])); } catch { /* Keep session changes. */ }
      return ids.has(id);
    }
  };
}
