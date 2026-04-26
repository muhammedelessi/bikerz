import { PHONE_COUNTRIES } from '@/data/phoneCountryCodes';

/** Key format: `{prefix}_{ISO}` e.g. `+966_SA` — matches PhoneField options. */
export function parseTrainerPhone(fullPhone: string | null | undefined): { prefixKey: string; local: string } {
  if (!fullPhone) return { prefixKey: '+966_SA', local: '' };
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const c of sorted) {
    if (fullPhone.startsWith(c.prefix)) {
      return { prefixKey: `${c.prefix}_${c.code}`, local: fullPhone.slice(c.prefix.length) };
    }
  }
  return { prefixKey: '+966_SA', local: fullPhone.replace(/^\+/, '') };
}

export function composeTrainerPhone(prefixKey: string, local: string): string {
  const prefix = prefixKey.split('_')[0] || '+966';
  const digits = local.replace(/[^0-9]/g, '');
  const normalized = digits.replace(/^0+/, '');
  return normalized ? `${prefix}${normalized}` : '';
}
