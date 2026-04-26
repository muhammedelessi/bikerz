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

function validateApplyBikeEntries(
  entries: TrainerFormValues['bike_entries'],
  isRTL: boolean,
): string | null {
  if (!Array.isArray(entries) || entries.length < 1) {
    return isRTL ? 'أضف دراجة واحدة على الأقل في الجراج.' : 'Add at least one motorcycle in the garage.';
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const typeOk = (e.type_name ?? '').trim() || String(e.type_id ?? '').trim();
    const brandOk = (e.brand ?? '').trim();
    const modelOk = (e.model ?? '').trim();
    if (!typeOk || !brandOk || !modelOk) {
      return isRTL
        ? `أكمل بيانات الدراجة رقم ${i + 1} (النوع، الماركة، الطراز) دون ترك حقول فارغة.`
        : `Complete bike #${i + 1} (type, brand, and model). Do not leave fields empty.`;
    }
  }
  return null;
}

export function validateTrainerFormSubmit(args: {
  mode: TrainerFormMode;
  values: TrainerFormValues;
  requireSingleBio?: boolean;
  singleBioDraft: string;
  hiddenFields?: (keyof TrainerFormValues)[];
  readonlyFields?: (keyof TrainerFormValues)[];
  isRTL: boolean;
  /** Apply flow: selected profile photo file (not yet in `values.photo_url`). */
  applyProfilePhotoFile?: File | null;
}): TrainerFormValidationResult {
  const { mode, values, requireSingleBio, singleBioDraft, hiddenFields, readonlyFields, isRTL, applyProfilePhotoFile } = args;
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
    need('gender', 'Gender is required', 'يرجى اختيار الجنس');
    need('nationality', 'Nationality is required', 'يرجى اختيار الجنسية');
    need('country', 'Country is required', 'يرجى اختيار الدولة');
    need('city', 'City is required', 'يرجى اختيار المدينة');
    need('phone', 'Phone number is required', 'رقم الجوال مطلوب');
    need('first_name_ar', 'First name is required', 'الاسم الأول مطلوب');
    need('last_name_ar', 'Last name is required', 'اسم العائلة مطلوب');

    if (!isHiddenField('photo_url', mode, hiddenFields) && !isReadonlyField('photo_url', readonlyFields)) {
      const hasPhoto = !!(values.photo_url && String(values.photo_url).trim()) || !!applyProfilePhotoFile;
      if (!hasPhoto) {
        errors.photo_url = isRTL ? 'يرجى إضافة صورة شخصية.' : 'Please upload a profile photo.';
      }
    }

    if (!isHiddenField('bike_entries', mode, hiddenFields) && !isReadonlyField('bike_entries', readonlyFields)) {
      const bikeMsg = validateApplyBikeEntries(values.bike_entries, isRTL);
      if (bikeMsg) errors.bike_entries = bikeMsg;
    }

    if (!isHiddenField('services', mode, hiddenFields) && !isReadonlyField('services', readonlyFields)) {
      if (!values.services?.length) {
        errors.services = isRTL ? 'أضف خدمة واحدة على الأقل يمكنك تقديمها.' : 'Add at least one service you can offer.';
      }
    }

    if (!isHiddenField('languages', mode, hiddenFields) && !isReadonlyField('languages', readonlyFields)) {
      if (!values.languages?.length) {
        errors.languages = isRTL ? 'أضف لغة واحدة على الأقل.' : 'Add at least one language.';
      }
    }
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
