/**
 * Supabase Storage image delivery (transform → WebP) for smaller LCP payloads.
 * Only applies to public object URLs; returns undefined otherwise.
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */
const OBJECT_PUBLIC = "/storage/v1/object/public/";
const RENDER_IMAGE = "/storage/v1/render/image/public/";

export function isSupabaseStoragePublicObjectUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(OBJECT_PUBLIC) && !url.includes("/object/sign/");
}

export function getSupabaseStorageWebpUrl(
  publicObjectUrl: string | null | undefined,
  opts?: { width?: number; height?: number; quality?: number },
): string | undefined {
  if (!isSupabaseStoragePublicObjectUrl(publicObjectUrl)) return undefined;
  const width = opts?.width ?? 1280;
  const height = opts?.height ?? 720;
  const quality = opts?.quality ?? 82;
  const base = publicObjectUrl!.replace(OBJECT_PUBLIC, RENDER_IMAGE);
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}width=${width}&height=${height}&resize=cover&format=webp&quality=${quality}`;
}
