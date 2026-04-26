import type { TrainerFormMode } from '@/types/trainerForm';
import type { TrainerFormValues } from '@/types/trainerForm';

export const MAX_BIKE_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_ALBUM_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS_PER_BIKE_ENTRY = 5;
export const MAX_ALBUM_PHOTOS = 10;

export const SINGLE_BIO_MIN = 50;
export const SINGLE_BIO_MAX = 500;

export type TrainerFormFieldErrorKey = keyof TrainerFormValues | 'singleBio' | 'general';

export type TrainerFormValidationResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<TrainerFormFieldErrorKey, string>> };

export function validateBikePhotoFile(file: File, isRTL: boolean): TrainerFormValidationResult {
  if (file.size > MAX_BIKE_PHOTO_BYTES) {
    return {
      ok: false,
      errors: {
        general: isRTL
          ? `الملف أكبر من ${MAX_BIKE_PHOTO_BYTES / (1024 * 1024)} ميجابايت`
          : `File exceeds ${MAX_BIKE_PHOTO_BYTES / (1024 * 1024)} MB`,
      },
    };
  }
  return { ok: true };
}

export function validateAlbumPhotoFile(file: File, isRTL: boolean): TrainerFormValidationResult {
  if (file.size > MAX_ALBUM_PHOTO_BYTES) {
    return {
      ok: false,
      errors: {
        general: isRTL
          ? `الملف أكبر من ${MAX_ALBUM_PHOTO_BYTES / (1024 * 1024)} ميجابايت`
          : `File exceeds ${MAX_ALBUM_PHOTO_BYTES / (1024 * 1024)} MB`,
      },
    };
  }
  return { ok: true };
}

function modeDefaultHidden(mode: TrainerFormMode): (keyof TrainerFormValues)[] {
  const h = new Set<keyof TrainerFormValues>();
  if (mode === 'apply') {
    h.add('photo_album');
    h.add('status');
    h.add('assigned_training_ids');
  }
  if (mode === 'self-edit') {
    h.add('status');
    h.add('assigned_training_ids');
  }
  return [...h];
}

function isHiddenField(
  field: keyof TrainerFormValues,
  mode: TrainerFormMode,
  extraHidden: (keyof TrainerFormValues)[] | undefined,
): boolean {
  if (extraHidden?.includes(field)) return true;
  return modeDefaultHidden(mode).includes(field);
}

function isReadonlyField(
  field: keyof TrainerFormValues,
  readonly: (keyof TrainerFormValues)[] | undefined,
): boolean {
  return !!readonly?.includes(field);
}

export function validateTrainerFormSubmit(args: {
  mode: TrainerFormMode;
  values: TrainerFormValues;
  requireSingleBio?: boolean;
  singleBioDraft: string;
  hiddenFields?: (keyof TrainerFormValues)[];
  readonlyFields?: (keyof TrainerFormValues)[];
  isRTL: boolean;
}): TrainerFormValidationResult {
  const { mode, values, requireSingleBio, singleBioDraft, hiddenFields, readonlyFields, isRTL } = args;
  const errors: Partial<Record<TrainerFormFieldErrorKey, string>> = {};

  const need = (field: keyof TrainerFormValues, msgEn: string, msgAr: string) => {
    if (isHiddenField(field, mode, hiddenFields)) return;
    if (isReadonlyField(field, readonlyFields)) return;
    const v = values[field];
    if (typeof v === 'string' && !v.trim()) {
      errors[field] = isRTL ? msgAr : msgEn;
    }
    if (typeof v === 'number' && field === 'years_of_experience' && Number.isNaN(v)) {
      errors[field] = isRTL ? msgAr : msgEn;
    }
  };

  if (mode === 'admin-create' || mode === 'admin-edit') {
    need('first_name_ar', 'First name (AR) is required', 'الاسم الأول (عربي) مطلوب');
    need('last_name_ar', 'Last name (AR) is required', 'الاسم الأخير (عربي) مطلوب');
    need('first_name_en', 'First name (EN) is required', 'الاسم الأول (إنجليزي) مطلوب');
    need('last_name_en', 'Last name (EN) is required', 'الاسم الأخير (إنجليزي) مطلوب');
    need('phone', 'Phone is required', 'رقم الجوال مطلوب');
    need('email', 'Email is required', 'البريد الإلكتروني مطلوب');
    need('country', 'Country is required', 'الدولة مطلوبة');
    need('city', 'City is required', 'المدينة مطلوبة');
  }

  if (requireSingleBio) {
    const len = singleBioDraft.trim().length;
    if (len < SINGLE_BIO_MIN || len > SINGLE_BIO_MAX) {
      errors.singleBio = isRTL
        ? `النبذة يجب أن تكون بين ${SINGLE_BIO_MIN} و ${SINGLE_BIO_MAX} حرفاً`
        : `Bio must be between ${SINGLE_BIO_MIN} and ${SINGLE_BIO_MAX} characters`;
    }
  }

  if (mode === 'apply') {
    need('gender', 'Gender is required', 'الجنس مطلوب');
    need('nationality', 'Nationality is required', 'الجنسية مطلوبة');
  }

  const albumCount = (values.photo_album?.length ?? 0);
  if (!isHiddenField('photo_album', mode, hiddenFields) && albumCount > MAX_ALBUM_PHOTOS) {
    errors.photo_album = isRTL
      ? `الحد الأقصى ${MAX_ALBUM_PHOTOS} صور`
      : `Maximum ${MAX_ALBUM_PHOTOS} album photos`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
