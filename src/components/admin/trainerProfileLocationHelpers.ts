import { COUNTRIES } from '@/data/countryCityData';

export function parseAssignmentLocation(location: string): { countryCode: string; city: string } {
  const loc = (location || '').trim();
  if (!loc) return { countryCode: '', city: '' };
  const idx = loc.indexOf(' - ');
  if (idx === -1) return { countryCode: '', city: loc };
  const countryPart = loc.slice(0, idx).trim();
  const cityPart = loc.slice(idx + 3).trim();
  const country = COUNTRIES.find((c) => c.en === countryPart || c.ar === countryPart);
  return { countryCode: country?.code || '', city: cityPart };
}

export function buildTrainerCourseLocation(countryCode: string, city: string): string {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return (city || '').trim();
  return `${country.en} - ${(city || '').trim()}`;
}

export function courseLocationDisplayLine(location: string | null | undefined, isRTL: boolean): string {
  const { countryCode, city } = parseAssignmentLocation(String(location ?? ''));
  if (!countryCode && !String(city).trim()) return '';
  const ce = COUNTRIES.find((c) => c.code === countryCode);
  const displayCountry = ce ? (isRTL ? ce.ar : ce.en) : '';
  const cityEntry = ce?.cities.find((c) => c.en === city || c.ar === city);
  const displayCity = cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : city;
  const parts = [displayCity, displayCountry].filter(Boolean);
  return parts.join(isRTL ? '، ' : ', ');
}
