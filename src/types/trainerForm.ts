import type { BikeEntry } from '@/hooks/useUserProfile';

export type TrainerFormMode = 'admin-create' | 'admin-edit' | 'apply' | 'self-edit';

export interface TrainerFormValues {
  photo_url: string | null;
  photo_album: string[];
  first_name_ar: string;
  last_name_ar: string;
  first_name_en: string;
  last_name_en: string;
  phone: string;
  phone_country_code: string;
  email: string;
  date_of_birth: string | null;
  bio_ar: string;
  bio_en: string;
  country: string;
  city: string;
  /** Profile values: Male | Female | Other (same as `profiles.gender`). */
  gender: string;
  /** ISO country code, same as `profiles.nationality`. */
  nationality: string;
  /** Garage rows (same shape as profile `BikeEntry`). */
  bike_entries: BikeEntry[];
  years_of_experience: number;
  languages: { code: string; level: string }[];
  services: string[];
  status?: 'active' | 'inactive';
  assigned_training_ids?: string[];
  /** Admin create/edit passthrough (no dedicated inputs in v1 form UI). */
  license_type?: string;
  profit_ratio?: number;
}


export interface TrainerFormSubmission {
  values: TrainerFormValues;
  profilePhotoFile: File | null;
  pendingAlbumFiles: { file: File; preview: string }[];
}
