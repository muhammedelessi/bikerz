import { supabase } from '@/integrations/supabase/client';

function typeStorageSlug(type: string): string {
  const s = encodeURIComponent(type.trim()).replace(/%/g, '_');
  return s.slice(0, 96) || 'bike';
}

/** Root-level profile image (same path pattern as legacy admin upload). */
export async function uploadTrainerProfilePhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadTrainerBikeFile(trainerId: string, bikeType: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const path = `bikes/${trainerId}/${typeStorageSlug(bikeType)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadTrainerAlbumFile(trainerId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const path = `album/${trainerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
  return data.publicUrl;
}

/** Apply flow: temp object under shared bucket (same bucket, distinct prefix). */
export async function uploadTrainerApplicationPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const path = `applications/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('trainer-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
  return data.publicUrl;
}
