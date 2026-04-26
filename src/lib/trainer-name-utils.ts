export function splitFullName(full: string): { first: string; last: string } {
  const s = (full || '').trim();
  const i = s.indexOf(' ');
  if (i === -1) return { first: s, last: '' };
  return { first: s.slice(0, i).trim(), last: s.slice(i + 1).trim() };
}

export function joinFullName(first: string, last: string): string {
  return [first, last].map((p) => p.trim()).filter(Boolean).join(' ');
}
