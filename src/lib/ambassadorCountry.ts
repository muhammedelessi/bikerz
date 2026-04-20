import { COUNTRIES } from "@/data/countryCityData";
import type { ChampionWithVideos } from "@/hooks/useChampions";

export const AMBASSADOR_COUNTRY_FILTER_ALL = "all" as const;
export const AMBASSADOR_COUNTRY_FILTER_UNSET = "__ambassador_country_unset__" as const;

export function displayAmbassadorCountry(
  country: string | null | undefined,
  isRTL: boolean,
): string {
  const raw = (country ?? "").trim();
  if (!raw) return isRTL ? "بدون دولة" : "No country";
  const entry = COUNTRIES.find((c) => c.en === raw || c.ar === raw || c.code === raw);
  if (entry) return isRTL ? entry.ar : entry.en;
  return raw;
}

export function ambassadorCountrySearchBlob(country: string | null | undefined): string {
  const raw = (country ?? "").trim();
  if (!raw) return "";
  const entry = COUNTRIES.find((c) => c.en === raw || c.ar === raw || c.code === raw);
  const parts: string[] = [raw];
  if (entry) {
    parts.push(entry.en, entry.ar, entry.code);
  }
  return parts.join(" ").toLowerCase();
}

function sortKey(stored: string): string {
  const raw = stored.trim();
  if (!raw) return "";
  const entry = COUNTRIES.find((c) => c.en === raw || c.ar === raw || c.code === raw);
  return (entry?.en ?? raw).toLowerCase();
}

/** Distinct stored `country` values for champions that have at least one video. Empty string = no country. */
export function distinctAmbassadorCountryValues(champions: ChampionWithVideos[]): string[] {
  const seen = new Set<string>();
  for (const c of champions) {
    if (!c.videos?.length) continue;
    seen.add((c.country ?? "").trim());
  }
  const values = [...seen];
  values.sort((a, b) => {
    const emptyA = !a;
    const emptyB = !b;
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;
    return sortKey(a).localeCompare(sortKey(b), "en", { sensitivity: "base" });
  });
  return values;
}
