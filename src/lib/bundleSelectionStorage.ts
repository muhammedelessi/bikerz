export const BUNDLE_SELECTION_KEY = 'bikerz_bundle_selection';

export function loadBundleSelectionIds(): string[] {
  try {
    const raw = localStorage.getItem(BUNDLE_SELECTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

export function saveBundleSelectionIds(ids: string[]): void {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) {
    localStorage.removeItem(BUNDLE_SELECTION_KEY);
    return;
  }
  localStorage.setItem(BUNDLE_SELECTION_KEY, JSON.stringify(uniq));
}

export function clearBundleSelection(): void {
  localStorage.removeItem(BUNDLE_SELECTION_KEY);
}
